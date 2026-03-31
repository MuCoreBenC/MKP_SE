// machine.go - 机型识别与边界应用
// 对应 Python mkp_core/machine.py

package machine

import (
	"strings"

	"github.com/mkp/mkp-go/internal/para"
)

// Boundary 定义机器打印范围（mm）。
type Boundary struct {
	MaxX, MinX float64
	MaxY, MinY float64
}

// profiles 对应 Python MACHINE_PROFILES。
var profiles = map[string]Boundary{
	"X1":     {MaxX: 255, MinX: 0, MaxY: 265, MinY: 0},
	"P1Lite": {MaxX: 255, MinX: 0, MaxY: 265, MinY: 0},
	"A1":     {MaxX: 260, MinX: -40, MaxY: 255, MinY: 0},
	"A1mini": {MaxX: 180, MinX: -10, MaxY: 180, MinY: 0},
}

// DetectMachine 从 gcode 注释行识别机型。
// 对应 Python detect_machine(gcode_line)。
// 匹配格式：;===== machine: X1 / A1 mini / A1 / P1
// 返回 profiles 中的 key，未识别返回 ""。
func DetectMachine(line string) string {
	if !strings.Contains(line, ";===== machine:") {
		return ""
	}
	lower := strings.ToLower(line)
	switch {
	case strings.Contains(lower, "a1 mini"):
		return "A1mini"
	case strings.Contains(lower, "a1"):
		return "A1"
	case strings.Contains(lower, "x1"):
		return "X1"
	case strings.Contains(lower, "p1"):
		return "P1Lite"
	}
	return ""
}

// ApplyProfile 将机型边界写入 cfg，对应 Python apply_machine_profile。
func ApplyProfile(machineType string, cfg *para.Config) {
	b, ok := profiles[machineType]
	if !ok {
		return
	}
	cfg.MachineMaxX = b.MaxX
	cfg.MachineMinX = b.MinX
	cfg.MachineMaxY = b.MaxY
	cfg.MachineMinY = b.MinY
}
