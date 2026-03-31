// para.go - MKPSupport 参数容器
// 对应 Python mkp_core/para.py (class para)
// 基准版本：Wisteria 5.8.5

package para

// Config 持有所有运行时参数，对应 Python 的 class para。
// TOML 标签用于 BurntSushi/toml 读写（对应 config.py 的 read/write_toml_config）。
type Config struct {
	// ── 工具头偏移 ──────────────────────────────────────────
	ZOffset  float64 `toml:"z_offset"`  // 喷嘴与笔尖高度差
	XOffset  float64 `toml:"x_offset"`  // 喷嘴与笔尖 X 坐标差值
	YOffset  float64 `toml:"y_offset"`  // 喷嘴与笔尖 Y 坐标差值
	MaxSpeed float64 `toml:"max_speed"` // 最高移动速度

	// ── 切片器参数（从 gcode 注释读取）─────────────────────
	TravelSpeed         float64 // ; travel_speed =
	NozzleDiameter      float64 // ; nozzle_diameter =
	FirstLayerHeight    float64 // ; initial_layer_print_height =
	TypicalLayerHeight  float64 // ; layer_height =
	FirstLayerSpeed     float64 // ; initial_layer_speed =
	RetractLength       float64 // ; retraction_length =
	NozzleSwitchTemp    float64 // ; nozzle_temperature =
	MinorNozzleFlag     bool    // 小喷嘴（0.15~0.3mm）
	FilamentType        string  `toml:"filament_type"` // "PETG" | "PLA"
	Slicer              string  `toml:"slicer"`        // "OrcaSlicer" | "BambuStudio"

	// ── 自定义 G-code ───────────────────────────────────────
	CustomMountGcode    string `toml:"custom_mount_gcode"`   // 装载胶箱 G-code
	CustomUnmountGcode  string `toml:"custom_unmount_gcode"` // 卸载胶箱 G-code
	WipingGcode         string `toml:"wiping_gcode"`         // 擦嘴 G-code
	TowerBaseLayerGcode string `toml:"tower_base_layer_gcode"` // 擦料塔首层

	// ── 擦料塔 ──────────────────────────────────────────────
	UseWipingTowers     bool    `toml:"use_wiping_towers"`      // 是否用内置擦嘴塔 [NEW in 585]
	WiperX              float64 `toml:"wiper_x"`                // 擦嘴塔起始 X
	WiperY              float64 `toml:"wiper_y"`                // 擦嘴塔起始 Y
	WipeTowerPrintSpeed float64 `toml:"wipe_tower_print_speed"` // 擦嘴塔打印速度 [NEW in 585]
	TowerExtrudeRatio   float64 `toml:"tower_extrude_ratio"`    // 擦料塔挤出乘数
	ExtraTowerHeight    float64 `toml:"extra_tower_height"`     // 额外擦料塔高度 [NEW in 585]
	RemoveG3Flag        bool    `toml:"remove_g3_flag"`         // 删除 G3 指令 [NEW in 585]
	SiliconeWipeFlag    bool    // 硅胶擦嘴开关（运行时解析）[NEW in 585]
	FirstLayerWipeTowerCollisionCheck bool `toml:"first_layer_wipe_tower_collision_check"` // [NEW in 585]
	
	// ── 空驶擦动 ────────────────────────────────────────────
	WipeTravelEnabled   bool    `toml:"wipe_travel_enabled"`    // 空驶擦动功能开关
	WipeTravelSpeed     float64 `toml:"wipe_travel_speed"`      // 空驶擦动速度 (mm/s)
	TowerBaseSize       float64 `toml:"tower_base_size"`        // 底面擦料展开大小 (倍数)

	// ── 喷嘴 ────────────────────────────────────────────────
	NozzleCoolingFlag   bool    `toml:"nozzle_cooling_flag"` // 涂胶期间是否降温 [NEW in 585]
	MKPRetract          float64 // 回抽长度（从 CustomMountGcode 解析）[NEW in 585]

	// ── 层高 / 速度 ─────────────────────────────────────────
	// （从 gcode 注释读取，不存 TOML）

	// ── 风扇 / 干燥 ─────────────────────────────────────────
	FanSpeed            float64 `toml:"fan_speed"`   // [NEW in 585]
	UserDryTime         float64 `toml:"user_dry_time"` // 用户自定义干燥时间（秒）[NEW in 585]
	PartDryingSpeed     float64 `toml:"part_drying_speed"` // [NEW in 585]
	WaitForDryingCmd    string  // 从 CustomUnmountGcode 解析的 G4 命令

	// ── 机器边界（从 gcode 机型注释读取）────────────────────
	MachineMaxX float64
	MachineMinX float64
	MachineMaxY float64
	MachineMinY float64

	// ── 预设管理 ────────────────────────────────────────────
	PresetName            string `toml:"preset_name"`
	CurrentSelectedPreset string `toml:"current_selected_preset"` // 默认 "P1" [NEW in 585]

	// ── 校准 ────────────────────────────────────────────────
	TempZOffsetCalibr float64 `toml:"temp_z_offset_calibr"` // [NEW in 585]
	TempXOffsetCalibr float64 `toml:"temp_x_offset_calibr"` // [NEW in 585]
	TempYOffsetCalibr float64 `toml:"temp_y_offset_calibr"` // [NEW in 585]

	// ── 其他功能开关 ────────────────────────────────────────
	L803LeakPreventFlag       bool    `toml:"l803_leak_prevent_flag"` // [NEW in 585]
	SmallFeatureFactor        float64 `toml:"small_feature_factor"`   // [NEW in 585]
	ForceThickBridgeFlag      bool    `toml:"force_thick_bridge_flag"` // [NEW in 585]
	SupportExtrusionMultiplier float64 `toml:"support_extrusion_multiplier"` // [NEW in 585]
	FirstPenRevitalizationFlag bool   `toml:"first_pen_revitalization_flag"` // [NEW in 585]

	// ── 熨烫功能 ────────────────────────────────────────────
	EnableIroning      bool    `toml:"enable_ironing"`
	IroningRemovalFlag bool    `toml:"ironing_removal_flag"` // [NEW in 585]
	IronExtrudeRatio   float64 `toml:"iron_extrude_ratio"`
	IroningSpeed       float64 `toml:"ironing_speed"`
	IronApplyFlag      bool    `toml:"iron_apply_flag"` // [NEW in 585]

	// ── 擦料塔类型 ──────────────────────────────────────────
	SwitchTowerType       int  `toml:"switch_tower_type"`        // 1=慢线, 2=快线 [NEW in 585]
	RemoveWrapDetectFlag  bool `toml:"remove_wrap_detect_flag"`  // [NEW in 585]

	// ── 拖拽坐标 ────────────────────────────────────────────
	DragX float64 `toml:"drag_x"` // 可拖动位置调整 X [NEW in 585]
	DragY float64 `toml:"drag_y"` // 可拖动位置调整 Y [NEW in 585]

	// ── 调试模式 ────────────────────────────────────────────
	DebugMode bool // CCkcheck_flag: true=保留原文件，false=覆盖原文件
}

// DefaultConfig 返回与 Python class para 默认值一致的配置。
func DefaultConfig() *Config {
	return &Config{
		FilamentType:               "PETG",
		Slicer:                     "OrcaSlicer",
		CurrentSelectedPreset:      "P1",
		SwitchTowerType:            2,
		SmallFeatureFactor:         1.0,
		SupportExtrusionMultiplier: 1.0,
		FirstPenRevitalizationFlag: true,
		FirstLayerWipeTowerCollisionCheck: true,
		// 空驶擦动默认值
		WipeTravelEnabled:          true,
		WipeTravelSpeed:            300,  // 300 mm/s
		TowerBaseSize:              1.0,  // 1.0 倍
		// 机器边界默认宽松（实际由 machine.ApplyProfile 覆盖）
		MachineMaxX: 999,
		MachineMaxY: 999,
		MachineMinX: -999,
		MachineMinY: -999,
		// [585+] 默认打印塔 G-code（由 processor 包初始化）
		WipingGcode:         "",
		TowerBaseLayerGcode: "",
	}
}
