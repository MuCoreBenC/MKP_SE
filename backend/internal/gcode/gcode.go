package gcode

import (
	"fmt"
	"math"
	"regexp"
	"strconv"
	"strings"

	"github.com/mkp/mkp-go/internal/para"
)

var xyzeAxisPat = regexp.MustCompile(`([XYZExyze])([-]?\d+\.?\d*)`)
var numPat = regexp.MustCompile(`-?\d+\.?\d*`)

var pseudoRandomSeq = []int{3, 7, 2, 8, 1, 5, 9, 4, 6}
var pseudoRandomIdx int

func GetPseudoRandom() int {
	v := pseudoRandomSeq[pseudoRandomIdx]
	pseudoRandomIdx = (pseudoRandomIdx + 1) % len(pseudoRandomSeq)
	return v
}

func ResetPseudoRandom() {
	pseudoRandomIdx = 0
}

func FormatXYZE(line string) string {
	return xyzeAxisPat.ReplaceAllStringFunc(line, func(match string) string {
		axis := string(match[0])
		valStr := match[1:]
		val, err := strconv.ParseFloat(valStr, 64)
		if err != nil {
			return match
		}
		return fmt.Sprintf("%s%.3f", strings.ToUpper(axis), val)
	})
}

func NumStrip(line string) []float64 {
	matches := numPat.FindAllString(line, -1)
	result := make([]float64, 0, len(matches))
	for _, m := range matches {
		if v, err := strconv.ParseFloat(m, 64); err == nil {
			result = append(result, v)
		}
	}
	return result
}

func ProcessGCodeOffset(cmd string, dx, dy, dz float64, mode string, cfg *para.Config) string {
	if idx := strings.Index(cmd, ";"); idx >= 0 {
		cmd = cmd[:idx]
	}
	cmd = strings.TrimSpace(cmd)

	// 移除所有G命令中的F参数，与Python代码保持一致
	cmd = removeFParam(cmd)

	var newX, newY, newZ *float64
	var hasE bool
	var eVal float64

	parts := strings.Fields(cmd)
	newParts := make([]string, 0, len(parts))

	for _, p := range parts {
		upper := strings.ToUpper(p)
		switch {
		case upper == "G1" || upper == "G0":
			newParts = append(newParts, upper)
		case strings.HasPrefix(upper, "X"):
			v := parseAxisVal(p[1:])
			v += dx
			v = clamp(v, cfg.MachineMinX, cfg.MachineMaxX)
			newX = &v
		case strings.HasPrefix(upper, "Y"):
			v := parseAxisVal(p[1:])
			v += dy
			v = clamp(v, cfg.MachineMinY, cfg.MachineMaxY)
			newY = &v
		case strings.HasPrefix(upper, "Z"):
			v := parseAxisVal(p[1:])
			if mode != "ironing" {
				v += dz
			}
			newZ = &v
		case strings.HasPrefix(upper, "E"):
			v := parseAxisVal(p[1:])
			switch mode {
			case "ironing":
				hasE = true
				eVal = v
			case "tower":
				hasE = true
				eVal = v
			default:
				// normal模式：不保留E参数
			}
		}
	}

	if len(newParts) == 0 {
		newParts = append(newParts, "G1")
	}
	if newX != nil {
		newParts = append(newParts, fmt.Sprintf("X%.3f", *newX))
	}
	if newY != nil {
		newParts = append(newParts, fmt.Sprintf("Y%.3f", *newY))
	}
	if newZ != nil {
		newParts = append(newParts, fmt.Sprintf("Z%.3f", *newZ))
	}
	if hasE {
		switch mode {
		case "ironing":
			eVal *= cfg.IronExtrudeRatio
			newParts = append(newParts, fmt.Sprintf("E%.3f", eVal))
		case "tower":
			eVal *= cfg.TowerExtrudeRatio
			newParts = append(newParts, fmt.Sprintf("E%.3f", eVal))
		default:
			// normal模式：不输出E参数
		}
	}

	return strings.Join(newParts, " ")
}

func CheckValidityInterfaceSet(iface []string) bool {
	for _, line := range iface {
		upper := strings.ToUpper(line)
		if !strings.HasPrefix(upper, "G1") {
			continue
		}
		if !strings.Contains(upper, "X") && !strings.Contains(upper, "Y") {
			continue
		}
		if strings.Contains(upper, " Z") {
			continue
		}
		eIdx := strings.Index(upper, " E")
		if eIdx == -1 {
			continue
		}
		ePart := upper[eIdx+2:]
		if len(ePart) > 0 && ePart[0] == '-' {
			continue
		}
		nums := NumStrip(line)
		for _, n := range nums {
			if n > 0 {
				return true
			}
		}
	}
	return false
}

func DeleteWipe(iface []string) []string {
	wipeStartIdx := -1
	wipeEndIdx := -1

	for i := len(iface) - 1; i >= 0; i-- {
		if strings.Contains(iface[i], "; WIPE_END") || strings.Contains(iface[i], ";WIPE_END") {
			wipeEndIdx = i
			break
		}
		if i < len(iface)-15 {
			break
		}
	}

	followFlag := false
	if wipeEndIdx >= 0 {
		for i := wipeEndIdx; i < len(iface); i++ {
			if (strings.Contains(iface[i], "G1 X") || strings.Contains(iface[i], "G1 Y")) &&
				strings.Contains(iface[i], "E") {
				followFlag = true
				break
			}
		}
	}

	if wipeEndIdx > 0 && !followFlag {
		for i := wipeEndIdx; i >= 0; i-- {
			if strings.Contains(iface[i], "; WIPE_START") || strings.Contains(iface[i], ";WIPE_START") {
				wipeStartIdx = i
				break
			}
		}
		if wipeStartIdx >= 0 {
			result := make([]string, wipeStartIdx)
			copy(result, iface[:wipeStartIdx])
			result = append(result, ";ZJUMP_START")
			return result
		}
	}

	if len(iface) > 0 {
		lastLine := iface[len(iface)-1]
		if (strings.Contains(lastLine, "G1 X") || strings.Contains(lastLine, "G1 Y")) &&
			strings.Contains(lastLine, "F") && !strings.Contains(lastLine, "E") {
			iface = iface[:len(iface)-1]
		}
	}

	result := make([]string, len(iface))
	copy(result, iface)
	result = append(result, ";ZJUMP_START")

	for i := len(iface) - 1; i >= 0; i-- {
		if strings.Contains(iface[i], "; WIPE_END") || strings.Contains(iface[i], ";WIPE_END") {
			result = append(result[:i+1], result[i+1:]...)
			break
		}
	}

	return result
}

func parseAxisVal(s string) float64 {
	v, _ := strconv.ParseFloat(s, 64)
	return v
}

func clamp(v, lo, hi float64) float64 {
	return math.Max(lo, math.Min(hi, v))
}

func removeFParam(line string) string {
	fPat := regexp.MustCompile(`\bF\d+\.?\d*\b`)
	result := fPat.ReplaceAllString(line, "")
	fields := strings.Fields(result)
	return strings.Join(fields, " ")
}
