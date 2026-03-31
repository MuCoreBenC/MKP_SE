package processor

import (
	"bufio"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"os"
	"regexp"
	"strconv"
	"strings"

	gcodeutil "github.com/mkp/mkp-go/internal/gcode"
	"github.com/mkp/mkp-go/internal/machine"
	"github.com/mkp/mkp-go/internal/para"
)

type JSONMessage struct {
	Type    string `json:"type"`
	Percent int    `json:"percent,omitempty"`
	Message string `json:"message,omitempty"`
	Hint    string `json:"hint,omitempty"`
}

type ProgressMsg struct {
	Percent int
	Message string
}

type LayerInfo struct {
	LastLayerHeight float64
	InPosCmd        string
	Thickness       float64
}

type Processor struct {
	Cfg              *para.Config
	LayerHeightIndex map[float64]LayerInfo
	ProgressCh       chan<- ProgressMsg
	JSONOutput       bool
	Stdout           io.Writer
	MachineType      string
}

func New(cfg *para.Config, progressCh chan<- ProgressMsg) *Processor {
	if cfg.WipingGcode == "" {
		cfg.WipingGcode = DefaultWipingGcode
	}
	if cfg.TowerBaseLayerGcode == "" {
		cfg.TowerBaseLayerGcode = DefaultTowerBaseLayerGcode
	}

	return &Processor{
		Cfg:              cfg,
		LayerHeightIndex: make(map[float64]LayerInfo),
		ProgressCh:       progressCh,
		JSONOutput:       false,
		Stdout:           os.Stdout,
		MachineType:      "A1mini",
	}
}

func (p *Processor) Run(inputPath, outputPath string) error {
	allLines, err := readAllLines(inputPath)
	if err != nil {
		return fmt.Errorf("read gcode: %w", err)
	}

	ParseSlicerParams(allLines, p.Cfg)
	ParseCustomGcodeFlags(p.Cfg)

	p.Cfg.MaxSpeed = p.Cfg.MaxSpeed * 60

	for _, line := range allLines {
		if mt := machine.DetectMachine(line); mt != "" {
			p.MachineType = mt
			machine.ApplyProfile(mt, p.Cfg)
			break
		}
	}

	if p.Cfg.UseWipingTowers {
		hint := CheckWiperCollision(allLines, p.Cfg, 0, len(allLines))
		if hint != "" {
			fmt.Fprintf(os.Stderr, "WIPER_CONFLICT:%s\n", hint)
			if p.JSONOutput {
				p.writeJSON(JSONMessage{Type: "wiper_conflict", Hint: hint})
			}
		}
	}

	tempPath := outputPath + ".te"
	p.sendProgress(0, "第一遍扫描：识别支撑接触面...")
	layerHeightIndex, err := p.firstPass(allLines, tempPath)
	if err != nil {
		return fmt.Errorf("first pass: %w", err)
	}
	p.LayerHeightIndex = layerHeightIndex

	p.sendProgress(50, "第二遍处理：插入擦嘴塔 G-code...")
	if err := p.secondPass(tempPath, outputPath); err != nil {
		return fmt.Errorf("second pass: %w", err)
	}

	os.Remove(tempPath)

	if !p.Cfg.DebugMode {
		if err := os.Remove(inputPath); err != nil && !os.IsNotExist(err) {
			return fmt.Errorf("remove original: %w", err)
		}
		if err := os.Rename(outputPath, inputPath); err != nil {
			return fmt.Errorf("rename output: %w", err)
		}
	}

	p.sendProgress(100, "处理完成")
	return nil
}

func ParseSlicerParams(lines []string, cfg *para.Config) {
	count := 0
	for _, line := range lines {
		switch {
		case strings.Contains(line, "; travel_speed ="):
			if nums := gcodeutil.NumStrip(line); len(nums) > 0 {
				cfg.TravelSpeed = nums[0]
				count++
			}
		case strings.Contains(line, "; nozzle_diameter = "):
			if nums := gcodeutil.NumStrip(line); len(nums) > 0 {
				cfg.NozzleDiameter = nums[0]
				count++
				if cfg.NozzleDiameter >= 0.15 && cfg.NozzleDiameter <= 0.3 {
					cfg.MinorNozzleFlag = true
				}
			}
		case strings.Contains(line, "; initial_layer_print_height ="):
			if nums := gcodeutil.NumStrip(line); len(nums) > 0 {
				cfg.FirstLayerHeight = nums[0]
				count++
			}
		case strings.Contains(line, "; layer_height = "):
			if nums := gcodeutil.NumStrip(line); len(nums) > 0 {
				cfg.TypicalLayerHeight = nums[0]
				count++
			}
		case strings.Contains(line, "; initial_layer_speed ="):
			if nums := gcodeutil.NumStrip(line); len(nums) > 0 {
				cfg.FirstLayerSpeed = nums[0]
				count++
			}
		case strings.Contains(line, "; outer_wall_speed ="):
			count++
		case strings.Contains(line, "; retraction_length = "):
			if nums := gcodeutil.NumStrip(line); len(nums) > 0 {
				cfg.RetractLength = nums[0]
				count++
			}
		case strings.Contains(line, "; nozzle_temperature = "):
			if nums := gcodeutil.NumStrip(line); len(nums) > 0 {
				cfg.NozzleSwitchTemp = nums[0]
				count++
			}
		case strings.Contains(line, "; filament_settings_id "):
			if strings.Contains(strings.ToUpper(line), "PETG") {
				cfg.FilamentType = "PETG"
			} else {
				cfg.FilamentType = "PLA"
			}
		}
		if count >= 9 {
			break
		}
	}
}

func ParseCustomGcodeFlags(cfg *para.Config) {
	if strings.Contains(cfg.CustomMountGcode, "NOCOOLDOWN") &&
		!strings.Contains(cfg.CustomMountGcode, ";L803") {
		cfg.L803LeakPreventFlag = false
	} else {
		cfg.L803LeakPreventFlag = true
	}

	if strings.Contains(cfg.CustomUnmountGcode, "G4") {
		for _, line := range strings.Split(cfg.CustomUnmountGcode, "\n") {
			if strings.Contains(line, "G4") {
				cfg.WaitForDryingCmd = strings.TrimSpace(line)
				break
			}
		}
	}

	if strings.Contains(cfg.CustomMountGcode, "G1 E") {
		for _, line := range strings.Split(cfg.CustomMountGcode, "\n") {
			if strings.Contains(line, "G1 E") {
				nums := gcodeutil.NumStrip(line)
				if len(nums) >= 2 {
					cfg.MKPRetract = nums[1]
					if cfg.MKPRetract > 0 {
						cfg.MKPRetract = -cfg.MKPRetract
					}
				}
				break
			}
		}
	}

	if strings.Contains(cfg.CustomUnmountGcode, "SILICONE_WIPE") &&
		!strings.Contains(cfg.CustomUnmountGcode, ";SILICONE_WIPE") &&
		!cfg.UseWipingTowers {
		cfg.SiliconeWipeFlag = true
	}
}

func CheckWiperCollision(lines []string, cfg *para.Config, startIdx, endIdx int) string {
	total := endIdx - startIdx
	var interval, maxPts int
	switch {
	case total > 10000:
		interval, maxPts = 500, 500
	case total > 5000:
		interval, maxPts = 150, 150
	default:
		interval, maxPts = 50, 100
	}

	type point struct{ x, y float64 }
	var calPoints []point
	conflictCount := 0
	processedCount := 0
	allow := false

	for i := startIdx; i < endIdx && i < len(lines); i++ {
		line := strings.TrimRight(lines[i], "\r\n")
		if strings.HasPrefix(line, "; FEATURE") {
			allow = strings.HasPrefix(line, "; FEATURE: Outer wall") ||
				strings.HasPrefix(line, "; FEATURE: Brim") ||
				strings.HasPrefix(line, "; FEATURE: Support")
			continue
		}
		if !allow {
			continue
		}
		if strings.HasPrefix(line, "G1 X") && strings.Contains(line, " E") {
			nums := gcodeutil.NumStrip(line)
			if len(nums) >= 3 {
				x, y := nums[1], nums[2]
				processedCount++
				if processedCount%interval == 0 && len(calPoints) < maxPts {
					calPoints = append(calPoints, point{x, y})
				}
				if x >= cfg.WiperX-3 && x <= cfg.WiperX+26 &&
					y >= cfg.WiperY-3 && y <= cfg.WiperY+26 {
					conflictCount++
				}
			}
		}
	}

	if conflictCount == 0 || len(calPoints) == 0 {
		return ""
	}

	var sumX, sumY float64
	for _, p := range calPoints {
		sumX += p.x
		sumY += p.y
	}
	avgX := sumX / float64(len(calPoints))
	avgY := sumY / float64(len(calPoints))
	wipeCX := (cfg.WiperX - 1 + cfg.WiperX + 24) / 2
	wipeCY := (cfg.WiperY - 1 + cfg.WiperY + 24) / 2

	xd := ""
	if avgX > wipeCX {
		xd = "right"
	} else {
		xd = "left"
	}
	yd := ""
	if avgY > wipeCY {
		yd = "up"
	} else {
		yd = "down"
	}

	type key struct{ x, y string }
	dirMap := map[key]string{
		{"", "up"}:       "向上",
		{"", "down"}:     "向下",
		{"right", ""}:    "向右",
		{"left", ""}:     "向左",
		{"right", "up"}:  "向右上",
		{"right", "down"}: "向右下",
		{"left", "up"}:   "向左上",
		{"left", "down"}: "向左下",
	}
	return dirMap[key{xd, yd}]
}

func (p *Processor) firstPass(lines []string, tempPath string) (map[float64]LayerInfo, error) {
	outF, err := os.Create(tempPath)
	if err != nil {
		return nil, err
	}
	defer outF.Close()
	w := bufio.NewWriter(outF)
	defer w.Flush()

	cfg := p.Cfg
	layerHeightIndex := make(map[float64]LayerInfo)

	copyFlag := false
	actFlag := false
	lastXYCmdFEFlag := true
	var iface []string
	currentZ := 0.0
	lastZ := 0.0
	layerThickness := 0.0
	firstLayerDone := false
	var lastXYCmdInOtherFeatures string
	var rebuildPressureLines []string
	inconsistentCount := 47

	total := float64(len(lines))
	for i, raw := range lines {
		if i%20000 == 0 {
			pct := int(float64(i) / total * 50)
			p.sendProgress(pct, "")
		}

		line := strings.TrimRight(raw, "\r\n")

		if strings.HasPrefix(line, "; BambuStudio") {
			cfg.Slicer = "BambuStudio"
		}

		if strings.Contains(line, "; Z_HEIGHT: ") {
			lastZ = currentZ
			if nums := gcodeutil.NumStrip(line); len(nums) > 0 {
				currentZ = nums[0]
			}
			layerThickness = currentZ - lastZ
			if currentZ > cfg.FirstLayerHeight {
				firstLayerDone = true
			}
		}

		upper := strings.ToUpper(line)
		if (strings.Contains(line, "G1 X") || strings.Contains(line, "G1 Y")) &&
			!strings.Contains(upper, " E") && lastXYCmdFEFlag {
			lastXYCmdInOtherFeatures = line
		}

		if strings.HasPrefix(line, "; FEATURE:") {
			if copyFlag && len(iface) > 0 {
				valid := gcodeutil.CheckValidityInterfaceSet(iface)
				if valid {
					actFlag = true
				} else {
					iface = nil
				}
			}
			if strings.Contains(line, "Support interface") {
				copyFlag = true
				lastXYCmdFEFlag = false
				iface = append(iface, line)
			} else {
				copyFlag = false
			}
			if strings.Contains(line, "Sparse infill") || strings.Contains(line, "Internal solid infill") {
				rebuildPressureLines = nil
			}
			fmt.Fprintln(w, line)
			continue
		}

		if copyFlag {
			iface = append(iface, line)
		}

		if cfg.IroningRemovalFlag && strings.Contains(line, "; FEATURE: Ironing") {
			continue
		}

		if strings.Contains(line, "; layer num/total_layer_count:") || strings.Contains(line, "; total_layer_count ") {
			if len(iface) > 0 && !actFlag {
				valid := gcodeutil.CheckValidityInterfaceSet(iface)
				if valid {
					actFlag = true
				} else {
					iface = nil
				}
			}
		}

		if (strings.Contains(line, "; layer num/total_layer_count:") || strings.Contains(line, "; total_layer_count ")) &&
			actFlag && firstLayerDone {

			actFlag = false
			lastXYCmdFEFlag = true
			iface = gcodeutil.DeleteWipe(iface)

			if inconsistentCount > 0 {
				inconsistentCount--
			} else {
				inconsistentCount = 0
			}

			fmt.Fprintln(w, ";Pre-glue preparation")

			p.writeFanControl(w)

			p.writeRetractMove(w, currentZ)

			if cfg.NozzleCoolingFlag {
				fmt.Fprintln(w, ";Pervent Leakage")
				fmt.Fprintf(w, "M104 S%.0f\n", cfg.NozzleSwitchTemp-30)
			}

			fmt.Fprintln(w, ";Rising Nozzle a little")
			if currentZ < 3 {
				fmt.Fprintf(w, "G1 Z%.3f\n", round3(currentZ+cfg.ZOffset+6))
			} else {
				fmt.Fprintf(w, "G1 Z%.3f\n", round3(currentZ+cfg.ZOffset+3))
			}

			fmt.Fprintln(w, ";Mounting Toolhead")
			p.writeCustomMountGcode(w, currentZ)

			fmt.Fprintln(w, ";Toolhead Mounted")
			fmt.Fprintf(w, "G1 Z%.3f\n", round3(lastZ+cfg.ZOffset+3))

			fmt.Fprintln(w, ";Glueing Started")
			fmt.Fprintln(w, ";Inposition")
			fmt.Fprintf(w, "G1 F%.0f\n", cfg.TravelSpeed*60)

			if lastXYCmdInOtherFeatures != "" {
				inposCmd := gcodeutil.ProcessGCodeOffset(
					lastXYCmdInOtherFeatures, cfg.XOffset, cfg.YOffset, cfg.ZOffset+3, "normal", cfg,
				)
				fmt.Fprintln(w, inposCmd)
			}

			fmt.Fprintf(w, "G1 Z%.3f\n", round3(lastZ+cfg.ZOffset))
			fmt.Fprintf(w, "G1 F%.0f\n", cfg.MaxSpeed)

			firstXYFlag := true
			if inconsistentCount >= 30 {
				inconsistentCount = 0
				fmt.Fprintln(w, ";Gluepen Revitalization Start")
				revitalizationCount := 10

				for ii := 0; ii < min(len(iface), revitalizationCount); ii++ {
					ifLine := iface[ii]
					if strings.Contains(ifLine, "G1 ") &&
						!strings.Contains(ifLine, "G1 E") &&
						!strings.Contains(ifLine, "G1 F") {
						if strings.Contains(ifLine, "G1 X") || strings.Contains(ifLine, "G1 Y") {
							_ = gcodeutil.ProcessGCodeOffset(ifLine, 0, 0, cfg.ZOffset+3, "normal", cfg)
							if firstXYFlag {
								firstXYFlag = false
							}
						}
						processed := gcodeutil.ProcessGCodeOffset(ifLine, cfg.XOffset, cfg.YOffset, cfg.ZOffset, "normal", cfg)
						fmt.Fprintln(w, processed)
					}
				}
				fmt.Fprintln(w, ";Gluepen Revitalization End")
			}

			for ii, ifLine := range iface {
				if strings.Contains(ifLine, "G1 ") &&
					!strings.Contains(ifLine, "G1 E") &&
					!strings.Contains(ifLine, "G1 F") {

					if strings.Contains(ifLine, "G1 X") || strings.Contains(ifLine, "G1 Y") {
						_ = gcodeutil.ProcessGCodeOffset(ifLine, 0, 0, cfg.ZOffset+3, "normal", cfg)
						if firstXYFlag {
							firstXYFlag = false
						}
					}

					processed := gcodeutil.ProcessGCodeOffset(ifLine, cfg.XOffset, cfg.YOffset, cfg.ZOffset, "normal", cfg)
					fmt.Fprintln(w, processed)
				} else if strings.Contains(ifLine, ";ZJUMP_START") {
					nextStartIndex := ii + 1
					if ii+1 < len(iface) {
						for jj := ii + 1; jj < len(iface); jj++ {
							if strings.Contains(iface[jj], "G1 X") || strings.Contains(iface[jj], "G1 Y") {
								nextStartIndex = jj
								break
							}
						}
						fmt.Fprintf(w, "G1 Z%.3f\n", round3(currentZ+cfg.ZOffset+3))
						fmt.Fprintf(w, "G1 F%.0f\n", cfg.TravelSpeed*60)
						if nextStartIndex < len(iface) {
							jumpCmd := gcodeutil.ProcessGCodeOffset(iface[nextStartIndex], cfg.XOffset, cfg.YOffset, cfg.ZOffset+3, "normal", cfg)
							fmt.Fprintln(w, jumpCmd)
						}
						fmt.Fprintf(w, "G1 Z%.3f\n", round3(lastZ+cfg.ZOffset))
						fmt.Fprintf(w, "G1 F%.0f\n", cfg.MaxSpeed*cfg.SmallFeatureFactor)
					}
				}
			}

			fmt.Fprintln(w, ";Glueing Finished")
			fmt.Fprintf(w, "G1 Z%.3f\n", round3(currentZ+cfg.ZOffset+3))
			fmt.Fprintf(w, ";Lift-z:%.3f\n", round3(currentZ+cfg.ZOffset+3))

			if cfg.FirstPenRevitalizationFlag {
				cfg.FirstPenRevitalizationFlag = false
				fmt.Fprintln(w, ";Waiting for Glue Settling")
				fmt.Fprintln(w, "G4 P9000")
			}

			fmt.Fprintln(w, ";Unmounting Toolhead")
			p.writeCustomUnmountGcode(w)
			fmt.Fprintln(w, ";Toolhead Unmounted")

			if !cfg.UseWipingTowers {
				fmt.Fprintln(w, "; FEATURE: Outer wall")
				if cfg.NozzleCoolingFlag {
					fmt.Fprintf(w, "M104 S%.0f\n", cfg.NozzleSwitchTemp)
				}
				if cfg.UserDryTime != 0 {
					fmt.Fprintln(w, ";User Dry Time Activated")
					fmt.Fprintf(w, "G4 P%.0f\n", cfg.UserDryTime*1000)
				}
				fmt.Fprintln(w, ";Print sparse/solid infill first")
				fmt.Fprintf(w, "G1 F%.0f\n", cfg.TravelSpeed*60)
				for _, rb := range rebuildPressureLines {
					fmt.Fprintln(w, rb)
				}
			} else {
				// 使用擦嘴塔时，输出Prepare for next tower标记
				prepCmd := gcodeutil.ProcessGCodeOffset("G1 X20 Y10.19", cfg.WiperX-5, cfg.WiperY-5, currentZ+3, "normal", cfg)
				fmt.Fprintln(w, prepCmd)
				fmt.Fprintln(w, ";Prepare for next tower")
				if cfg.NozzleCoolingFlag {
					if cfg.UserDryTime != 0 {
						fmt.Fprintf(w, "M104 S%.0f\n", cfg.NozzleSwitchTemp)
					} else {
						fmt.Fprintf(w, "M109 S%.0f\n", cfg.NozzleSwitchTemp)
					}
				}
				if cfg.UserDryTime != 0 {
					fmt.Fprintln(w, ";User Dry Time Activated")
					fmt.Fprintf(w, "G4 P%.0f\n", cfg.UserDryTime*1000)
				}
			}

			layerHeightIndex[currentZ] = LayerInfo{
				LastLayerHeight: lastZ,
				InPosCmd:        lastXYCmdInOtherFeatures,
				Thickness:       layerThickness,
			}

			iface = nil
		}

		if (strings.Contains(cfg.Slicer, "Orca") || strings.Contains(cfg.Slicer, "Bambu")) &&
			strings.HasPrefix(upper, "G1 E") {
			rebuildPressureLines = append(rebuildPressureLines, line)
			if len(rebuildPressureLines) > 3 {
				rebuildPressureLines = rebuildPressureLines[len(rebuildPressureLines)-3:]
			}
		}

		fmt.Fprintln(w, line)
	}

	return layerHeightIndex, nil
}

func (p *Processor) writeFanControl(w *bufio.Writer) {
	mt := p.MachineType
	if mt == "X1" || mt == "P1lite" {
		fmt.Fprintln(w, "M106 P1 S255")
	} else if mt == "A1" || mt == "A1mini" {
		fmt.Fprintln(w, "M106 S255")
	}
}

func (p *Processor) writeRetractMove(w *bufio.Writer, currentZ float64) {
	cfg := p.Cfg
	mt := p.MachineType

	var xCoord float64
	switch mt {
	case "P1Lite":
		xCoord = 20
	case "A1":
		xCoord = 252
	case "A1mini":
		xCoord = 160
	default:
		xCoord = 160
	}

	fmt.Fprintf(w, "G1 X%.0f Z%.3f E%.3f F%.0f\n",
		xCoord, round3(currentZ+1), cfg.MKPRetract, cfg.TravelSpeed*60)
}

func (p *Processor) writeCustomMountGcode(w *bufio.Writer, currentZ float64) {
	cfg := p.Cfg
	lines := strings.Split(strings.TrimRight(cfg.CustomMountGcode, "\n"), "\n")

	for _, line := range lines {
		trimmed := strings.TrimSpace(line)

		if strings.Contains(trimmed, "G1 E") {
			continue
		}

		if strings.Contains(trimmed, "L801") {
			var zAdj float64
			if currentZ < 3 {
				zAdj = currentZ + cfg.ZOffset + 4
			} else {
				zAdj = currentZ + cfg.ZOffset + 3
			}
			fmt.Fprintf(w, "G1 Z%.3f;L801\n", zAdj)
		} else {
			fmt.Fprintln(w, trimmed)
		}
	}
}

func (p *Processor) writeCustomUnmountGcode(w *bufio.Writer) {
	cfg := p.Cfg
	lines := strings.Split(strings.TrimRight(cfg.CustomUnmountGcode, "\n"), "\n")
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)

		if strings.Contains(trimmed, ";Wipe") {
			if !cfg.UseWipingTowers && !cfg.SiliconeWipeFlag {
				fmt.Fprintln(w, trimmed)
			}
			continue
		}

		if strings.Contains(trimmed, ";Brush") {
			if cfg.SiliconeWipeFlag {
				if strings.Contains(trimmed, "L801") {
					fmt.Fprintf(w, "G1 Z%.3f;L801\n", 0.0)
				} else {
					fmt.Fprintln(w, trimmed)
				}
			}
			continue
		}

		if strings.Contains(trimmed, "M106 S[AUTO]") {
			fmt.Fprintf(w, "M106 S%.0f\n", cfg.FanSpeed)
			continue
		}
		if strings.Contains(trimmed, "M106 P1 S[AUTO]") {
			fmt.Fprintf(w, "M106 P1 S%.0f\n", cfg.FanSpeed)
			continue
		}

		fmt.Fprintln(w, trimmed)
	}
}

func (p *Processor) secondPass(tempPath, outputPath string) error {
	inF, err := os.Open(tempPath)
	if err != nil {
		return err
	}
	defer inF.Close()

	outF, err := os.Create(outputPath)
	if err != nil {
		return err
	}
	defer outF.Close()
	w := bufio.NewWriter(outF)
	defer w.Flush()

	cfg := p.Cfg
	
	var lines []string
	sc := bufio.NewScanner(inF)
	sc.Buffer(make([]byte, 4*1024*1024), 4*1024*1024)
	for sc.Scan() {
		lines = append(lines, sc.Text())
	}

	currentZ := 0.0
	lastZ := 0.0
	allowPrint := true
	lineNum := 0
	layerThickness := 0.25

	currMaxTowerHeight := cfg.FirstLayerHeight
	lastMaxTowerHeight := 0.0
	firstLayerTowerFlag := true
	towerFlag := false
	suggestedLH := 0.0
	cfg.TowerExtrudeRatio = 1.0
	nextTJ := false
	cfg.SwitchTowerType = 0
	cfg.RemoveG3Flag = false
	cfg.RemoveWrapDetectFlag = false

	triggerSet := make(map[float64]bool)
	for z := range p.LayerHeightIndex {
		if z > 0.4 {
			triggerSet[z] = false
		}
	}

	var lastKey float64
	for k := range p.LayerHeightIndex {
		if k > lastKey {
			lastKey = k
		}
	}

	for i := 0; i < len(lines); i++ {
		lineNum++
		if lineNum%20000 == 0 {
			p.sendProgress(50, "")
		}

		line := strings.TrimRight(lines[i], "\r\n")

		if strings.Contains(line, "; LAYER_HEIGHT: ") {
			if nums := gcodeutil.NumStrip(line); len(nums) > 0 {
				layerThickness = nums[0]
			}
		}

		if strings.Contains(line, "; Z_HEIGHT: ") {
			lastZ = currentZ
			if nums := gcodeutil.NumStrip(line); len(nums) > 0 {
				currentZ = nums[0]
			}
			layerThickness = currentZ - lastZ
			if layerThickness <= 0 {
				layerThickness = 0.25
			}

			if _, ok := triggerSet[currentZ]; ok && currentZ > 0.4 {
				towerFlag = true
			}

			if cfg.UseWipingTowers && firstLayerTowerFlag && currentZ > 0.01 {
				firstLayerTowerFlag = false
			}

			// 先检测接下来的20行是否有";Rising Nozzle a little"，与Python代码保持一致
			for j := i; j < min(i+20, len(lines)); j++ {
				if strings.Contains(lines[j], ";Rising Nozzle a little") {
					nextTJ = true
					cfg.SwitchTowerType = 1
					break
				}
			}

			// 然后再计算suggestedLH
			if !nextTJ {
				suggestedLH = 0.65 * cfg.NozzleDiameter
			} else {
				suggestedLH = round3(currentZ - lastZ)
				if suggestedLH < 0.2*cfg.NozzleDiameter {
					suggestedLH = 0.2 * cfg.NozzleDiameter
				}
			}

			lastMaxTowerHeight = currMaxTowerHeight
			if currentZ < lastKey+0.4 {
				if currMaxTowerHeight+suggestedLH < currentZ || nextTJ {
					nextTJ = false
					currMaxTowerHeight = round3(currMaxTowerHeight + suggestedLH)
					cfg.SwitchTowerType = 1
				}

				if lastMaxTowerHeight < currMaxTowerHeight {
					towerFlag = true
				}
			}
		}

		if strings.Contains(line, "; CHANGE_LAYER") && firstLayerTowerFlag && cfg.UseWipingTowers {
			firstLayerTowerFlag = false

			cfg.TowerExtrudeRatio = round3((cfg.FirstLayerHeight / 0.2) * 0.8)

			fmt.Fprintf(w, "G1 F%.0f\n", cfg.TravelSpeed*60)

			if cfg.DebugMode {
				fmt.Fprintf(w, ";DEBUG TowerBaseLayerGcode length: %d, contains WIPE_START: %v\n", len(cfg.TowerBaseLayerGcode), strings.Contains(cfg.TowerBaseLayerGcode, "WIPE_START"))
			}

			towerLines := strings.Split(strings.TrimRight(cfg.TowerBaseLayerGcode, "\n"), "\n")
			for _, tline := range towerLines {
				tlineTrim := strings.TrimSpace(tline)
				switch {
				case strings.Contains(tline, "EXTRUDER_REFILL"):
					fmt.Fprintln(w, "G92 E0")
					fmt.Fprintf(w, "G1 E%.3f\n", cfg.RetractLength)
					fmt.Fprintln(w, "G92 E0")

				case strings.Contains(tline, "NOZZLE_HEIGHT_ADJUST"):
					fmt.Fprintf(w, "G1 Z%.3f;Tower Z\n", cfg.FirstLayerHeight)

				case strings.Contains(tline, "EXTRUDER_RETRACT"):
					fmt.Fprintln(w, "G92 E0")

				case tlineTrim == "G92 E0":
					fmt.Fprintln(w, "G92 E0")

				case tlineTrim == "G1 F9600":
					fmt.Fprintf(w, "G1 F%.0f\n", cfg.FirstLayerSpeed*60)

				case strings.Contains(tline, "G1 ") && !strings.Contains(tline, "G1 E") && !strings.Contains(tline, " F"):
					processed := gcodeutil.ProcessGCodeOffset(
						tline, cfg.WiperX-5, cfg.WiperY-5, 0, "tower", cfg,
					)
					if strings.TrimSpace(processed) != "" {
						fmt.Fprintln(w, processed)
					}

				case strings.Contains(tline, "G1 ") && !strings.Contains(tline, "G1 E"):
					processed := gcodeutil.ProcessGCodeOffset(
						tline, cfg.WiperX-5, cfg.WiperY-5, 0, "tower", cfg,
					)
					if strings.TrimSpace(processed) != "" {
						fmt.Fprintln(w, processed)
					}

				default:
					if tlineTrim != "" {
						fmt.Fprintln(w, tline)
					}
				}
			}

			fmt.Fprintf(w, "G1 F%.0f\n", cfg.TravelSpeed*60)
			fmt.Fprintln(w, line)
			continue
		}

		if strings.Contains(line, "; update layer progress") &&
			cfg.UseWipingTowers &&
			towerFlag &&
			!firstLayerTowerFlag &&
			currentZ != cfg.FirstLayerHeight {

			towerFlag = false
			fmt.Fprintf(w, "G1 F%.0f\n", cfg.TravelSpeed*60)

			cfg.TowerExtrudeRatio = round3(suggestedLH / 0.2)

			if suggestedLH == 0.65*cfg.NozzleDiameter {
				moveCmd := gcodeutil.ProcessGCodeOffset("G1 X20 Y20", cfg.WiperX-5, cfg.WiperY-5, currMaxTowerHeight+3, "tower", cfg)
				fmt.Fprintf(w, "%s Z%.3f\n", moveCmd, round3(currentZ+0.6))
			}

			fmt.Fprintln(w, "; FEATURE: Inner wall")
			fmt.Fprintln(w, "; LINE_WIDTH: 0.42")
			fmt.Fprintf(w, ";Extruding Ratio: %.3f\n", cfg.TowerExtrudeRatio)
			fmt.Fprintf(w, "; LAYER_HEIGHT: %.3f\n", suggestedLH)

			towerLines := strings.Split(strings.TrimRight(cfg.WipingGcode, "\n"), "\n")
			for _, tline := range towerLines {
				switch {
				case strings.Contains(tline, "G1 F9600"):
					if cfg.SwitchTowerType == 1 {
						speed := math.Min(cfg.WipeTowerPrintSpeed, 35)
						fmt.Fprintf(w, "G1 F%.0f\n", speed*60)
					} else {
						fmt.Fprintf(w, "G1 F%.0f\n", cfg.WipeTowerPrintSpeed*60)
						cfg.SwitchTowerType = 2
					}

				case strings.Contains(tline, "TOWER_ZP_ST"):
					// skip

				case strings.Contains(tline, "NOZZLE_HEIGHT_ADJUST"):
					fmt.Fprintf(w, "G1 Z%.3f;Tower Z\n", currMaxTowerHeight)

				case strings.Contains(tline, "EXTRUDER_REFILL"):
					fmt.Fprintln(w, "G92 E0")
					fmt.Fprintf(w, "G1 E%.3f\n", cfg.RetractLength)
					fmt.Fprintln(w, "G92 E0")

				case strings.Contains(tline, "EXTRUDER_RETRACT"):
					fmt.Fprintln(w, "G92 E0")
					retractVal := math.Abs(cfg.RetractLength - 0.31)
					fmt.Fprintf(w, "G1 E-%.3f\n", round3(retractVal))
					fmt.Fprintln(w, "G92 E0")

				case strings.Contains(tline, "G1 E-.21 F5400"):
					fmt.Fprintln(w, "G1 E-.21 F5400")

				case strings.Contains(tline, "G1 E.3 F5400"):
					fmt.Fprintln(w, "G1 E.3 F5400")

				case strings.Contains(tline, "G92 E0"):
					fmt.Fprintln(w, "G92 E0")

				default:
					if strings.TrimSpace(tline) != "" {
						processed := tline
						if strings.HasPrefix(strings.TrimSpace(tline), "G1") {
							processed = gcodeutil.ProcessGCodeOffset(
								tline, cfg.WiperX-5, cfg.WiperY-5, 0, "tower", cfg,
							)
							if strings.TrimSpace(processed) == "G1" {
								continue
							}
						}
						fmt.Fprintln(w, processed)
					}
				}
			}

			fmt.Fprintf(w, "G1 F%.0f\n", cfg.TravelSpeed*60)
			leaveCmd := gcodeutil.ProcessGCodeOffset("G1 X33 Y33", cfg.WiperX-5, cfg.WiperY-5, currMaxTowerHeight+0.7, "tower", cfg)
			fmt.Fprintf(w, "%s Z%.3f ;Leaving Wiping Tower\n", leaveCmd, round3(currMaxTowerHeight+0.7))

			fmt.Fprintf(w, "; LAYER_HEIGHT: %.3f\n", layerThickness)

			cfg.RemoveG3Flag = true
		}

		if cfg.RemoveWrapDetectFlag && strings.Contains(line, "wrap_detect") {
			continue
		}

		if cfg.RemoveG3Flag && strings.HasPrefix(strings.TrimSpace(line), "G3 ") {
			continue
		}

		if strings.HasPrefix(line, "; SKIPTYPE: head_wrap_detect") {
			allowPrint = false
			cfg.RemoveWrapDetectFlag = true
		}
		if cfg.RemoveWrapDetectFlag && strings.Contains(line, "; SKIPPABLE_END") {
			cfg.RemoveWrapDetectFlag = false
			allowPrint = true
			continue
		}

		// 处理Shielding Nozzle标记，使用伪随机数生成空驶路径
		if cfg.WipeTravelEnabled && strings.Contains(line, ";Shielding Nozzle") {
			// 输出G1 X25 Y25，添加坐标偏移
			processed := gcodeutil.ProcessGCodeOffset("G1 X25 Y25", cfg.WiperX-5, cfg.WiperY-5, lastMaxTowerHeight, "normal", cfg)
			fmt.Fprintln(w, processed)
			fmt.Fprintf(w, "G1 Z%.3f\n", lastMaxTowerHeight)
			
			// 生成伪随机空驶路径
			randomNum := gcodeutil.GetPseudoRandom()
			variableWipeCode := fmt.Sprintf("G1 X15 Y2%d F%.0f", randomNum, cfg.WipeTravelSpeed*60)
			
			if cfg.FilamentType == "PLA" {
				processed = gcodeutil.ProcessGCodeOffset(variableWipeCode, cfg.WiperX-5, cfg.WiperY-5, currMaxTowerHeight+3, "normal", cfg)
				fmt.Fprintln(w, processed)
				processed = gcodeutil.ProcessGCodeOffset(fmt.Sprintf("G1 X25 Y25 F%.0f", cfg.WipeTravelSpeed*60), cfg.WiperX-5, cfg.WiperY-5, currMaxTowerHeight+3, "normal", cfg)
				fmt.Fprintln(w, processed)
				processed = gcodeutil.ProcessGCodeOffset(variableWipeCode, cfg.WiperX-5, cfg.WiperY-5, currMaxTowerHeight+3, "normal", cfg)
				fmt.Fprintln(w, processed)
				processed = gcodeutil.ProcessGCodeOffset(fmt.Sprintf("G1 X25 Y25 F%.0f", cfg.WipeTravelSpeed*60), cfg.WiperX-5, cfg.WiperY-5, currMaxTowerHeight+3, "normal", cfg)
				fmt.Fprintln(w, processed)
			}
			
			processed = gcodeutil.ProcessGCodeOffset(variableWipeCode, cfg.WiperX-5, cfg.WiperY-5, currMaxTowerHeight+3, "normal", cfg)
			fmt.Fprintln(w, processed)
			processed = gcodeutil.ProcessGCodeOffset(fmt.Sprintf("G1 X25 Y25 F%.0f", cfg.WipeTravelSpeed*60), cfg.WiperX-5, cfg.WiperY-5, currMaxTowerHeight+3, "normal", cfg)
			fmt.Fprintln(w, processed)
			processed = gcodeutil.ProcessGCodeOffset(variableWipeCode, cfg.WiperX-5, cfg.WiperY-5, currMaxTowerHeight+3, "normal", cfg)
			fmt.Fprintln(w, processed)
			processed = gcodeutil.ProcessGCodeOffset(fmt.Sprintf("G1 X15 Y15 F%.0f", cfg.WipeTravelSpeed*60), cfg.WiperX-5, cfg.WiperY-5, currMaxTowerHeight+3, "normal", cfg)
			fmt.Fprintln(w, processed)
			
			randomNum = gcodeutil.GetPseudoRandom()
			processed = gcodeutil.ProcessGCodeOffset(fmt.Sprintf("G1 X20 Y1%d F%.0f", randomNum, cfg.WipeTravelSpeed*60), cfg.WiperX-5, cfg.WiperY-5, lastMaxTowerHeight+3, "normal", cfg)
			fmt.Fprintln(w, processed)
		}

		// 处理Prepare for next tower标记，使用伪随机数生成空驶路径
		if cfg.WipeTravelEnabled && strings.Contains(line, ";Prepare for next tower") {
			fmt.Fprintf(w, "G1 Z%.3f\n", currMaxTowerHeight)
			
			// 生成伪随机空驶路径
			randomNum := gcodeutil.GetPseudoRandom()
			variableWipeCode := fmt.Sprintf("G1 X15 Y2%d F%.0f", randomNum, cfg.WipeTravelSpeed*60)
			
			if cfg.FilamentType == "PLA" {
				processed := gcodeutil.ProcessGCodeOffset(variableWipeCode, cfg.WiperX-5, cfg.WiperY-5, currMaxTowerHeight+3, "normal", cfg)
				fmt.Fprintln(w, processed)
				processed = gcodeutil.ProcessGCodeOffset(fmt.Sprintf("G1 X25 Y25 F%.0f", cfg.WipeTravelSpeed*60), cfg.WiperX-5, cfg.WiperY-5, currMaxTowerHeight+3, "normal", cfg)
				fmt.Fprintln(w, processed)
				processed = gcodeutil.ProcessGCodeOffset(variableWipeCode, cfg.WiperX-5, cfg.WiperY-5, currMaxTowerHeight+3, "normal", cfg)
				fmt.Fprintln(w, processed)
				processed = gcodeutil.ProcessGCodeOffset(fmt.Sprintf("G1 X25 Y25 F%.0f", cfg.WipeTravelSpeed*60), cfg.WiperX-5, cfg.WiperY-5, currMaxTowerHeight+3, "normal", cfg)
				fmt.Fprintln(w, processed)
			}
			
			processed := gcodeutil.ProcessGCodeOffset(variableWipeCode, cfg.WiperX-5, cfg.WiperY-5, currMaxTowerHeight+3, "normal", cfg)
			fmt.Fprintln(w, processed)
			processed = gcodeutil.ProcessGCodeOffset(fmt.Sprintf("G1 X25 Y25 F%.0f", cfg.WipeTravelSpeed*60), cfg.WiperX-5, cfg.WiperY-5, currMaxTowerHeight+3, "normal", cfg)
			fmt.Fprintln(w, processed)
			processed = gcodeutil.ProcessGCodeOffset(variableWipeCode, cfg.WiperX-5, cfg.WiperY-5, currMaxTowerHeight+3, "normal", cfg)
			fmt.Fprintln(w, processed)
			processed = gcodeutil.ProcessGCodeOffset(fmt.Sprintf("G1 X15 Y15 F%.0f", cfg.WipeTravelSpeed*60), cfg.WiperX-5, cfg.WiperY-5, currMaxTowerHeight+3, "normal", cfg)
			fmt.Fprintln(w, processed)
			
			randomNum = gcodeutil.GetPseudoRandom()
			processed = gcodeutil.ProcessGCodeOffset(fmt.Sprintf("G1 X20 Y1%d F%.0f", randomNum, cfg.WipeTravelSpeed*60), cfg.WiperX-5, cfg.WiperY-5, lastMaxTowerHeight+3, "normal", cfg)
			fmt.Fprintln(w, processed)
		}

		// 处理Adjust cooling distance标记
		if strings.Contains(line, ";Adjust cooling distance") {
			fmt.Fprintf(w, "G1 Z%.3f\n", currMaxTowerHeight+2)
		}

		if allowPrint {
			if cfg.SupportExtrusionMultiplier != 1.0 {
				line = applyExtrusionMultiplier(line, cfg.SupportExtrusionMultiplier)
			}
			if strings.Contains(line, "M1006") && strings.Contains(line, " E") {
				line = processM1006Command(line)
			}
			fmt.Fprintln(w, line)
		}
	}

	return sc.Err()
}

func (p *Processor) sendProgress(pct int, msg string) {
	fmt.Fprintf(os.Stderr, "PROGRESS:%d\n", pct)
	if p.JSONOutput {
		p.writeJSON(JSONMessage{Type: "progress", Percent: pct, Message: msg})
	}
	if p.ProgressCh != nil {
		select {
		case p.ProgressCh <- ProgressMsg{Percent: pct, Message: msg}:
		default:
		}
	}
}

func (p *Processor) writeJSON(msg JSONMessage) {
	if p.Stdout == nil {
		return
	}
	data, err := json.Marshal(msg)
	if err != nil {
		return
	}
	p.Stdout.Write(append(data, '\n'))
}

func readAllLines(path string) ([]string, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	var lines []string
	sc := bufio.NewScanner(f)
	sc.Buffer(make([]byte, 4*1024*1024), 4*1024*1024)
	for sc.Scan() {
		lines = append(lines, sc.Text())
	}
	return lines, sc.Err()
}

func round3(v float64) float64 {
	return math.Round(v*1000) / 1000
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func applyExtrusionMultiplier(line string, mult float64) string {
	upper := strings.ToUpper(line)
	if !strings.Contains(upper, " E") {
		return line
	}
	parts := strings.Fields(line)
	for i, p := range parts {
		if strings.HasPrefix(strings.ToUpper(p), "E") {
			if v, err := strconv.ParseFloat(p[1:], 64); err == nil {
				parts[i] = fmt.Sprintf("E%.5f", v*mult)
			}
		}
	}
	return strings.Join(parts, " ")
}

func processM1006Command(line string) string {
	var cVal, eVal float64
	var cFound, eFound bool

	parts := strings.Fields(line)
	for _, p := range parts {
		upper := strings.ToUpper(p)
		if strings.HasPrefix(upper, "C") {
			if v, err := strconv.ParseFloat(p[1:], 64); err == nil {
				cVal = v
				cFound = true
			}
		}
		if strings.HasPrefix(upper, "E") {
			if v, err := strconv.ParseFloat(p[1:], 64); err == nil {
				eVal = v
				eFound = true
			}
		}
	}

	if eFound && eVal != 0 && cFound {
		ePattern := regexp.MustCompile(`\bE[-]?\d+\.?\d*\b`)
		line = ePattern.ReplaceAllString(line, fmt.Sprintf("E%d", int(cVal)))
	}

	return line
}
