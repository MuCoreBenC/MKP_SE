// main.go - MKPSupport CLI 入口
// 用法：mkpsupport.exe --Toml <path> --Gcode <path> [--Config] [--Debug]
// 与 Python 版本 CLI 接口完全兼容，Bambu Studio 后处理脚本直接调用。
//
// GUI 模式：加 --Config 标志，写入 flag 文件通知 Electron 打开配置窗口。
// CLI 模式：直接处理 G-code，进度输出到 stderr（格式 "PROGRESS:nn"）。

package main

import (
	"bufio"
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"path/filepath"

	"github.com/mkp/mkp-go/internal/calibration"
	"github.com/mkp/mkp-go/internal/config"
	"github.com/mkp/mkp-go/internal/para"
	"github.com/mkp/mkp-go/internal/processor"
)

const version = "1.0.0" // Go 重写版本号

func main() {
	opts := parseFlags()

	if opts.showVer {
		fmt.Printf("MKPSupport Go %s\n", version)
		os.Exit(0)
	}
	if opts.configMode {
		handleConfigMode(opts.tomlPath, opts.outputJSON)
		return
	}

	validateGcodePath(opts.gcodePath, opts.outputJSON)

	cfg := loadConfig(opts.tomlPath, opts.debugMode, opts.outputJSON)
	lines := mustReadLines(opts.gcodePath, opts.outputJSON)

	// [DEBUG] 输出配置信息
	fmt.Fprintf(os.Stderr, "[DEBUG] Config loaded:\n")
	fmt.Fprintf(os.Stderr, "  CustomMountGcode length: %d\n", len(cfg.CustomMountGcode))
	fmt.Fprintf(os.Stderr, "  CustomUnmountGcode length: %d\n", len(cfg.CustomUnmountGcode))
	fmt.Fprintf(os.Stderr, "  WipingGcode length: %d\n", len(cfg.WipingGcode))
	fmt.Fprintf(os.Stderr, "  TowerBaseLayerGcode length: %d\n", len(cfg.TowerBaseLayerGcode))

	if err := runCalibrationOrProcess(lines, cfg, opts.gcodePath, opts.outputJSON); err != nil {
		logMessage("ERROR", fmt.Sprintf("%v", err), opts.outputJSON)
		os.Exit(1)
	}
	os.Exit(0)
}

// options 持有解析后的命令行参数。
type options struct {
	tomlPath   string
	gcodePath  string
	configMode bool
	debugMode  bool
	showVer    bool
	outputJSON bool
}

func parseFlags() options {
	var o options
	flag.StringVar(&o.tomlPath, "Toml", "", "TOML 配置文件路径")
	flag.StringVar(&o.gcodePath, "Gcode", "", "G-code 文件路径（Bambu Studio 传入）")
	flag.BoolVar(&o.configMode, "Config", false, "打开配置界面（通知 Electron）")
	flag.BoolVar(&o.debugMode, "Debug", false, "调试模式：保留原始文件，输出单独文件")
	flag.BoolVar(&o.showVer, "version", false, "显示版本")
	flag.BoolVar(&o.outputJSON, "output-json", false, "JSON 输出模式")
	flag.Parse()
	return o
}

// logMessage 输出日志：始终写入 stderr（格式 "LEVEL: message"）。
// 当 outputJSON 为 true 时，同时向 stdout 写入 JSON 对象。
func logMessage(level, message string, outputJSON bool) {
	fmt.Fprintf(os.Stderr, "%s: %s\n", level, message)
	if outputJSON {
		obj := map[string]string{
			"type":    "log",
			"level":   level,
			"message": message,
		}
		enc := json.NewEncoder(os.Stdout)
		enc.Encode(obj)
	}
}

func validateGcodePath(gcodePath string, outputJSON bool) {
	if gcodePath == "" {
		logMessage("ERROR", "--Gcode 参数不能为空", outputJSON)
		flag.Usage()
		os.Exit(1)
	}
	if _, err := os.Stat(gcodePath); os.IsNotExist(err) {
		logMessage("ERROR", fmt.Sprintf("G-code 文件不存在: %s", gcodePath), outputJSON)
		os.Exit(1)
	}
}

// loadConfig 读取 TOML 配置；找不到文件时返回默认配置。
func loadConfig(tomlPath string, debugMode bool, outputJSON bool) *para.Config {
	cfg := para.DefaultConfig()
	cfg.DebugMode = debugMode

	if tomlPath == "" {
		if defDir, err := config.CreateMKPSupportDir(); err == nil {
			tomlPath = filepath.Join(defDir, "MKPConfig.toml")
		}
	}
	if tomlPath == "" {
		config.InitializeDefaultTowerGcode(cfg, processor.DefaultWipingGcode, processor.DefaultTowerBaseLayerGcode)
		return cfg
	}
	if _, err := os.Stat(tomlPath); err != nil {
		logMessage("WARNING", fmt.Sprintf("TOML 文件不存在: %s，使用默认配置", tomlPath), outputJSON)
		config.InitializeDefaultTowerGcode(cfg, processor.DefaultWipingGcode, processor.DefaultTowerBaseLayerGcode)
		return cfg
	}
	if err := config.ReadConfig(tomlPath, cfg); err != nil {
		logMessage("WARNING", fmt.Sprintf("读取配置失败: %v", err), outputJSON)
	}
	config.InitializeDefaultTowerGcode(cfg, processor.DefaultWipingGcode, processor.DefaultTowerBaseLayerGcode)
	return cfg
}

func mustReadLines(gcodePath string, outputJSON bool) []string {
	lines, err := readAllLines(gcodePath)
	if err != nil {
		logMessage("ERROR", fmt.Sprintf("读取 G-code 失败: %v", err), outputJSON)
		os.Exit(1)
	}
	return lines
}

// runCalibrationOrProcess 根据文件类型分发到校准处理或正常处理。
func runCalibrationOrProcess(lines []string, cfg *para.Config, gcodePath string, outputJSON bool) error {
	if mode := calibration.DetectCalibrationMode(lines); mode != "" {
		return runCalibration(lines, cfg, gcodePath, mode, outputJSON)
	}
	return runProcess(cfg, gcodePath, outputJSON)
}

func runCalibration(lines []string, cfg *para.Config, gcodePath, mode string, outputJSON bool) error {
	outputPath := gcodePath + "_CalibOutput.gcode"
	logMessage("INFO", fmt.Sprintf("校准模式 [%s]，输出至 %s", mode, outputPath), outputJSON)
	if err := calibration.ProcessCalibration(lines, cfg, outputPath); err != nil {
		return fmt.Errorf("校准处理失败: %w", err)
	}
	if outputJSON {
		obj := map[string]string{"type": "progress", "value": "100"}
		enc := json.NewEncoder(os.Stdout)
		enc.Encode(obj)
	}
	logMessage("PROGRESS", "100", outputJSON)
	return nil
}

func runProcess(cfg *para.Config, gcodePath string, outputJSON bool) error {
	outputPath := gcodePath + "_Output.gcode"
	logMessage("INFO", "开始处理 G-code...", outputJSON)
	proc := processor.New(cfg, nil) // nil = CLI 模式，进度写 stderr
	proc.JSONOutput = outputJSON
	if err := proc.Run(gcodePath, outputPath); err != nil {
		return fmt.Errorf("处理失败: %w", err)
	}
	logMessage("INFO", "处理完成", outputJSON)
	return nil
}

// handleConfigMode 通知 Electron 主进程打开配置界面。
// 方式：在临时目录写入 .mkp_config_request 文件，Electron 轮询检测。
func handleConfigMode(tomlPath string, outputJSON bool) {
	tmpDir := os.TempDir()
	flagFile := filepath.Join(tmpDir, ".mkp_config_request")

	if err := os.WriteFile(flagFile, []byte(tomlPath), 0644); err != nil {
		logMessage("ERROR", fmt.Sprintf("写入配置请求文件失败: %v", err), outputJSON)
		os.Exit(1)
	}

	logMessage("INFO", fmt.Sprintf("配置请求已写入 %s", flagFile), outputJSON)
	// Bambu Studio 后处理环境不支持长时间等待，直接退出。
	// Electron 主进程检测到 flag 文件后自动打开配置窗口。
	os.Exit(0)
}

// readAllLines 从路径读取所有行。
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
