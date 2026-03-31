// calibration.go - 校准模式处理
// 对应 Python mkp_core/calibration.py
// 基准版本：Wisteria 5.8.5

package calibration

import (
	"bufio"
	"fmt"
	"math"
	"os"
	"path/filepath"
	"regexp"
	"runtime"
	"strconv"
	"strings"

	"github.com/mkp/mkp-go/internal/para"
)

// DetectCalibrationMode 扫描 gcode 内容，识别校准模式。
// 对应 Python detect_calibration_mode(content)。
// 返回 "Precise"|"Rough"|"ZOffset"|"Repetition"|""（空=正常打印）。
func DetectCalibrationMode(lines []string) string {
	for _, line := range lines {
		switch {
		case strings.Contains(line, "Precise Calibration"):
			return "Precise"
		case strings.Contains(line, "Rough Calibration"):
			return "Rough"
		case strings.Contains(line, "ZOffset Calibration"):
			return "ZOffset"
		case strings.Contains(line, "LShape Repetition"):
			return "Repetition"
		}
	}
	return ""
}

// detectMachine 从校准 gcode 头部识别机型。
func detectMachine(lines []string) string {
	for _, line := range lines {
		switch {
		case strings.Contains(line, ";===== machine: A1 mini"):
			return "A1mini"
		case strings.Contains(line, ";===== machine: A1 ="):
			return "A1"
		case strings.Contains(line, ";===== machine: X1"):
			return "X1"
		case strings.Contains(line, ";===== machine: P1"):
			return "P1"
		}
	}
	return ""
}

// ProcessCalibration 根据检测到的模式输出校准 G-code 到 outPath。
// 对应 Python process_calibration(content, para, output_file)。
func ProcessCalibration(lines []string, cfg *para.Config, outPath string) error {
	mode := DetectCalibrationMode(lines)
	if mode == "" {
		return nil // 非校准文件，跳过
	}
	machine := detectMachine(lines)

	out, err := os.Create(outPath)
	if err != nil {
		return fmt.Errorf("create calibration output: %w", err)
	}
	defer out.Close()
	w := bufio.NewWriter(out)
	defer w.Flush()

	for _, line := range lines {
		fmt.Fprintln(w, strings.TrimRight(line, "\r\n"))
		trigger := strings.Contains(line, "; filament end gcode") &&
			!strings.Contains(line, "=")
		if !trigger {
			continue
		}
		switch mode {
		case "Precise", "Rough":
			outputXYCalibration(w, cfg, mode, machine)
		case "ZOffset":
			outputZCalibration(w, cfg, machine)
		case "Repetition":
			if err := outputRepetitionCalibration(w, cfg, machine); err != nil {
				return err
			}
		}
	}
	return nil
}

// outputXYCalibration 输出 XY 校准序列（Precise/Rough 模式）。
// 对应 Python _output_xy_calibration。
// Precise: 0.2mm 步长, ±1.0mm 范围
// Rough:   0.5mm 步长, ±2.5mm 范围
func outputXYCalibration(w *bufio.Writer, cfg *para.Config, mode, machine string) {
	fmt.Fprintf(w, "G1 X100 Y100 Z10 F3000\n")
	fmt.Fprintf(w, "G1 Z%.3f\n", round3(cfg.FirstLayerHeight+cfg.ZOffset+6))
	fmt.Fprintln(w, ";Mounting Toolhead")
	fmt.Fprintln(w, strings.TrimSpace(cfg.CustomMountGcode))
	fmt.Fprintln(w, ";Toolhead Mounted")

	var yX, yXe, yY, xY, xYe, xX float64
	switch machine {
	case "A1mini":
		yX, yXe, yY = 66.523, 76.523, 76.830
		xY, xYe, xX = 66.830, 76.830, 76.523
	case "A1":
		yX, yXe, yY = 104.530, 114.530, 114.830
		xY, xYe, xX = 104.830, 114.830, 114.523
	default: // X1, P1
		yX, yXe, yY = 104.530, 114.530, 112.830
		xY, xYe, xX = 104.830, 114.830, 114.523
	}

	step := 0.2
	startCali := -1.0
	if mode == "Rough" {
		step = 0.5
		startCali = -2.5
	}

	travelF := int(cfg.TravelSpeed * 60)

	// 11 条 Y 方向线
	cali := startCali
	off := 0.0
	for i := 0; i < 11; i++ {
		fmt.Fprintf(w, "G1 F%d\n", travelF)
		fmt.Fprintf(w, "G1 X%.3f Y%.3f\n", round3(yX), round3(yY+off+cfg.YOffset+cali))
		fmt.Fprintf(w, "G1 Z%.3f\n", round3(cfg.FirstLayerHeight+cfg.ZOffset+3))
		fmt.Fprintln(w, "G1 F300")
		fmt.Fprintf(w, "G1 X%.3f Y%.3f Z%.3f\n",
			round3(yXe), round3(yY+off+cfg.YOffset+cali), round3(cfg.FirstLayerHeight+cfg.ZOffset))
		off += 4
		cali += step
		fmt.Fprintf(w, "G1 Z%.3f\n", round3(cfg.FirstLayerHeight+cfg.ZOffset+3))
	}

	// 11 条 X 方向线
	cali = startCali
	off = 0.0
	for i := 0; i < 11; i++ {
		fmt.Fprintf(w, "G1 F%d\n", travelF)
		fmt.Fprintf(w, "G1 X%.3f Y%.3f\n", round3(xX+off+cfg.XOffset+cali), round3(xY))
		fmt.Fprintf(w, "G1 Z%.3f\n", round3(cfg.FirstLayerHeight+cfg.ZOffset+3))
		fmt.Fprintln(w, "G1 F300")
		fmt.Fprintf(w, "G1 X%.3f Y%.3f Z%.3f\n",
			round3(xX+off+cfg.XOffset+cali), round3(xYe), round3(cfg.FirstLayerHeight+cfg.ZOffset))
		off += 4
		cali += step
		fmt.Fprintf(w, "G1 Z%.3f\n", round3(cfg.FirstLayerHeight+cfg.ZOffset+3))
	}

	fmt.Fprintln(w, ";Unmounting Toolhead")
	fmt.Fprintln(w, strings.TrimSpace(cfg.CustomUnmountGcode))
	fmt.Fprintln(w, ";Toolhead Unmounted")
	fmt.Fprintln(w, "G1 X100 Y100 Z100")
}

// outputZCalibration 输出 Z 偏移校准序列。
// 对应 Python _output_z_calibration。
func outputZCalibration(w *bufio.Writer, cfg *para.Config, machine string) {
	fmt.Fprintf(w, "G1 X100 Y100 Z10 F3000\n")
	fmt.Fprintf(w, "G1 Z%.3f\n", round3(cfg.FirstLayerHeight+cfg.ZOffset+6))
	fmt.Fprintln(w, ";Mounting Toolhead")
	fmt.Fprintln(w, strings.TrimSpace(cfg.CustomMountGcode))
	fmt.Fprintln(w, ";Toolhead Mounted")

	frX, frY := 68.210, 126.373
	if machine == "A1mini" {
		frX, frY = 30.210, 88.373
	}

	if machine == "A1" || machine == "A1mini" {
		fmt.Fprintln(w, ";Floating Z Calibration")
		for i := 0; i < 5; i++ {
			fmt.Fprintln(w, "G1 Z3.4")
			fmt.Fprintln(w, "G1 Z5")
		}
	}

	travelF := int(cfg.TravelSpeed * 60)
	zAcc := 0.5
	off := 0.0
	for i := 0; i < 11; i++ {
		fmt.Fprintf(w, "G1 F%d\n", travelF)
		fmt.Fprintf(w, "G1 X%.3f Y%.3f\n", round3(frX+off+cfg.XOffset), round3(frY+cfg.YOffset))
		fmt.Fprintf(w, "G1 F%.0f\n", cfg.MaxSpeed)
		fmt.Fprintf(w, "G1 Z%.3f\n", round3(0.4+cfg.ZOffset+zAcc))
		zAcc -= 0.1
		off += 11
		fmt.Fprintf(w, "G1 Z%.3f\n", round3(cfg.ZOffset+6))
		fmt.Fprintln(w, "G4 P10000")
	}

	fmt.Fprintln(w, ";Unmounting Toolhead")
	fmt.Fprintln(w, strings.TrimSpace(cfg.CustomUnmountGcode))
	fmt.Fprintln(w, ";Toolhead Unmounted")
	fmt.Fprintln(w, "G1 X100 Y100 Z100")
}

// outputRepetitionCalibration 输出 L 形精度重复性测试序列。
// 对应 Python _output_repetition_calibration。
// 从 resources/ 目录读取 A1miniL.gcode 或 A1X1P1L.gcode。
func outputRepetitionCalibration(w *bufio.Writer, cfg *para.Config, machine string) error {
	// 获取 resources/ 目录（相对于当前可执行文件）
	exe, err := os.Executable()
	if err != nil {
		exe = os.Args[0]
	}
	resDir := filepath.Join(filepath.Dir(exe), "resources")
	// 开发环境 fallback：向上两级找 resources/
	if _, err := os.Stat(resDir); os.IsNotExist(err) {
		_, file, _, _ := runtime.Caller(0)
		resDir = filepath.Join(filepath.Dir(file), "..", "..", "..", "resources")
	}

	fname := "A1X1P1L.gcode"
	if machine == "A1mini" {
		fname = "A1miniL.gcode"
	}
	lshapeLines, err := readLines(filepath.Join(resDir, fname))
	if err != nil {
		return fmt.Errorf("load lshape gcode %s: %w", fname, err)
	}

	fmt.Fprintf(w, "G1 Z%.3f\n", round3(cfg.FirstLayerHeight+cfg.ZOffset))
	fmt.Fprintln(w, ";LShape Repetition Calibration")
	fmt.Fprintf(w, "G1 F%.0f\n", cfg.MaxSpeed)

	yAdj := 0.0
	if machine != "A1mini" && machine != "A1" {
		yAdj = -2
	}

	axisShiftPat := regexp.MustCompile(`([XYZ])(-?\d+\.?\d*)`)
	for _, line := range lshapeLines {
		s := strings.TrimRight(line, "\r\n")
		upper := strings.ToUpper(s)
		if strings.HasPrefix(upper, "G1 ") &&
			!strings.Contains(upper, "G1 E") &&
			!strings.Contains(upper, "G1 F") {
			s = axisShiftPat.ReplaceAllStringFunc(s, func(m string) string {
				tag := string(m[0])
				val, _ := strconv.ParseFloat(m[1:], 64)
				switch strings.ToUpper(tag) {
				case "X":
					val += cfg.XOffset
				case "Y":
					val += cfg.YOffset + yAdj
				case "Z":
					val += cfg.ZOffset
				}
				return fmt.Sprintf("%s%.3f", strings.ToUpper(tag), round3(val))
			})
		}
		fmt.Fprintln(w, s)
	}

	fmt.Fprintln(w, ";Unmounting Toolhead")
	fmt.Fprintln(w, strings.TrimSpace(cfg.CustomUnmountGcode))
	fmt.Fprintln(w, ";Toolhead Unmounted")
	fmt.Fprintln(w, "G1 X100 Y100 Z100")
	return nil
}

// ── 工具函数 ──────────────────────────────────────────────────────

func round3(v float64) float64 {
	return math.Round(v*1000) / 1000
}

func readLines(path string) ([]string, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	var lines []string
	sc := bufio.NewScanner(f)
	for sc.Scan() {
		lines = append(lines, sc.Text())
	}
	return lines, sc.Err()
}
