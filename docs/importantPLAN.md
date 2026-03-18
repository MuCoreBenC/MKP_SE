# MKP 引擎迁移与 GUI 参数暴露计划

## Summary
- 迁移边界固定为“后处理引擎 + 4 个校准 G-code 生成模式”，来源是 [`main585.py`](d:/trae/MKP_SE/main585.py) 里真正参与 G-code 判断、提取、改写、生成的那几百行核心逻辑。
- 旧 Tk GUI 外壳不做逐行移植。预设文件选择、更新弹窗、复制命令窗口、拖拽坐标方块、模型下载/打开等保留为 Electron GUI 重建对象，不并入 JS 引擎。
- JS 内部标准配置格式固定为 JSON；TOML 只保留兼容入口与导入导出能力。GUI 后续只围绕统一 `EngineConfig` 编辑。
- 文档落点固定为新建 [`docs/MKP_ENGINE_MIGRATION_PLAN.md`](d:/trae/MKP_SE/docs/MKP_ENGINE_MIGRATION_PLAN.md)，并在 [`continue.md`](d:/trae/MKP_SE/continue.md) 顶部追加一段 `MKP Engine Migration` 接力区块。

## GUI 参数暴露清单
### 默认就该暴露给 GUI 的参数
- `para.Max_Speed` / `speed_limit` -> `toolhead.speedLimit`
  含义最明确，旧 GUI 已直接编辑，属于核心打印行为参数。
- `para.X_Offset` / `para.Y_Offset` / `para.Z_Offset` -> `toolhead.offset.x/y/z`
  这是当前 GUI、校准、后处理三条链路的共同核心，必须继续作为一等公民。
- `para.Custom_Mount_Gcode` -> `toolhead.customMountGcode`
  旧 GUI 已提供多行编辑器，且很多机器兼容逻辑都靠它。
- `para.Custom_Unmount_Gcode` -> `toolhead.customUnmountGcode`
  同上，而且 `AUTO` 风扇、硅胶擦嘴、吐丝清理、干燥等待等都从这里派生。
- `para.Use_Wiping_Towers` -> 规范化为 `wiping.useWipingTowers`
  旧 Python 字段名 `have_wiping_components` 实际语义是“是否启用擦嘴塔”，命名有误导；GUI 和新 JSON 统一改成正向命名。
- `para.Wiper_x` / `para.Wiper_y` -> `wiping.wiperX` / `wiping.wiperY`
  旧 GUI 已显式编辑，是擦嘴塔生成的关键定位参数。
- `para.WipeTower_Print_Speed` -> `wiping.wipeTowerPrintSpeed`
  旧 GUI 已显式编辑，是塔生成时最直接的用户调节项。
- `para.Nozzle_Cooling_Flag` -> `wiping.nozzleCoolingEnabled`
  旧 GUI 已显式编辑，直接决定防漏降温与回温流程。
- `para.Iron_apply_Flag` -> `wiping.useIroningSurfacePaths`
  从注释“最小化涂胶区域(仅 OrcaSlicer + 支撑面熨烫)”判断，它决定是否把 Orca 的支撑面熨烫路径当成涂胶目标，应暴露但必须改成更直白的 UI 文案。
- `para.User_Dry_Time` -> `wiping.userDryTimeSeconds`
  旧 GUI 已显式编辑，逻辑清晰。
- `para.Force_Thick_Bridge_Flag` -> `wiping.forceThickBridge`
  旧 GUI 已显式编辑，属于重要工艺开关。
- `para.Support_Extrusion_Multiplier` -> `wiping.supportExtrusionMultiplier`
  旧 GUI 已显式编辑，且已在 JS 种子实现里落地。

### 应作为高级设置暴露的参数
- `para.Wiping_Gcode` -> `templates.wipingGcode`
  它不是普通用户的首屏参数，但既然 Python 用内置模板驱动后续塔层生成，就应该保留高级模板编辑接口。
- `para.Tower_Base_Layer_Gcode` -> `templates.towerBaseLayerGcode`
  同上，适合做高级模板编辑器或“高级文本模式”。
- `para.Preset_Name` / `_custom_name` / 版本元信息 -> `presetMeta.displayName / presetMeta.version / presetMeta.releaseTime`
  不是引擎运行参数，但后续 GUI 预设管理必须能改显示名、看版本、看发布时间。
- `para.Custom_Mount_Gcode` 与 `para.Custom_Unmount_Gcode` 里的派生能力
  GUI 不应把 `SILICONE_WIPE`、`;Brush`、`;Wipe`、`M106 S[AUTO]` 单独拆成散字段，应该保留“高级 G-code 编辑器 + 派生预览/校验”。
- `para.Iron_Extrude_Ratio`
  代码里存在、会影响 `Process_GCode_Offset('ironing')`，但旧 TOML 和旧 GUI 没正式暴露；迁移时保留到高级实验参数位，不放默认面板。
- `para.Small_Feature_Factor`
  只在少数恢复/跳转位置起作用，适合作为隐藏高级调优项，不放普通用户面板。

### 建议只读展示、不直接编辑的参数
- `para.Travel_Speed`
- `para.Nozzle_Diameter`
- `para.First_Layer_Height`
- `para.Typical_Layer_Height`
- `para.First_Layer_Speed`
- `para.Retract_Length`
- `para.Nozzle_Switch_Tempature`
- `para.Fan_Speed`
- `para.Filament_Type`
- `para.Slicer`
  这些都不是预设真正的“工艺配置”，而是从输入 G-code 或机器注释中提取的运行时上下文。可在 GUI 的“诊断/解析结果”面板展示，但不要写回预设。

### 应保留为内部运行时状态、不暴露给 GUI 的参数
- `para.Switch_Tower_Type`
- `para.Ironing_Removal_Flag`
- `para.Tower_Extrude_Ratio`
- `para.Wait_for_Drying_Command`
- `para.Extra_Tower_Height`
- `para.MKPRetract`
- `para.L803_Leak_Pervent_Flag`
- `para.Minor_Nozzle_Diameter_Flag`
- `para.Silicone_Wipe_Flag`
- `para.First_Pen_Revitalization_Flag`
- `para.Remove_G3_Flag`
- `para.Machine_Max_X/Y` 与 `para.Machine_Min_X/Y`
  这些本质上是运行时推导、机器 profile、保护状态或临时状态，不应该做成用户可直接编辑的预设字段。

### 校准相关应暴露给 GUI 的内容
- 不暴露 `Temp_XOffset_Calibr` / `Temp_YOffset_Calibr` / `Temp_ZOffset_Calibr` 这些临时变量本身。
- GUI 应暴露的是“校准模式选择、应用到当前预设、预览生成结果、把校准结果写回 `toolhead.offset`”。
- `Precise / Rough / ZOffset / Repetition` 先按 Python 固定行为迁移，不额外发明大量新旋钮；等 parity 完成后，再决定是否把步距、重复次数、阵列范围做成高级校准参数。

## Implementation Changes
### 1. 配置与接口层
- 建立统一 `EngineConfig` 契约，按上面的 GUI 暴露策略拆成：
  - `presetMeta`
  - `toolhead`
  - `wiping`
  - `templates`
  - `machineProfile`
  - `calibration`
- 读 TOML 时兼容旧字段 `have_wiping_components`，内部统一映射到 `wiping.useWipingTowers`。
- 写 JSON 时以新命名为主；兼容期内保留旧字段回写或导出映射，避免现有资源一次性失效。
- 扩展 renderer 预设 schema，不再只默认理解 `toolhead.offset`，而是能合法承载完整 `EngineConfig`。

### 2. 后处理引擎主体
- 把现有 [`src/main/mkp_engine.js`](d:/trae/MKP_SE/src/main/mkp_engine.js) 固定拆成 6 块职责：
  - `config`：JSON/TOML 归一化与序列化
  - `helpers`：`Process_GCode_Offset`、`Num_Strip`、`delete_wipe`、伪随机序列等
  - `scan`：识别 slicer、机器、层高、风扇、喷嘴温度、支撑面、熨烫面、压力重建片段
  - `replay`：真正输出涂胶/熨烫/卸载/恢复/擦嘴塔/厚桥/支撑倍率
  - `calibration`：4 种校准模式生成
  - `cli facade`：`--Json/--Toml/--Gcode` 入口
- 扫描阶段必须完整补齐 Python 行为：
  - `BambuStudio` 的 `Support interface`
  - `OrcaSlicer` 的 `Ironing` 支撑面
  - `delete_wipe()` 清尾与 `;ZJUMP_START`
  - `check_validity_interface_set()`
  - 过量熨烫取消与 `Skip Ironing`
  - 机器边界与机器类型识别
- 重放阶段必须完整补齐：
  - 装笔/卸笔链路
  - 预涂胶/主涂胶路径
  - 风扇 `AUTO` 展开
  - 降温/回温/等待
  - 硅胶擦嘴和吐丝清理分支
  - 厚桥和支撑倍率二次处理
  - 首层擦嘴塔和后续塔层
  - 伪随机擦拭序列
  - 压力重建与首支笔稳定等待
- 现有已完成种子必须保留并扩展：
  - `--Json / --Toml` 双入口
  - 配置归一化
  - 基础 `Process_GCode_Offset`
  - `support_extrusion_multiplier`
  - `force_thick_bridge_flag`
  - support-interface 注入骨架
  - 降温/干燥/下一塔准备
  - 伪随机 helper 与塔底 helper

### 3. 校准引擎
- 从普通后处理路径中独立出 `detectSpecialMode()`。
- 模式固定支持：
  - `Precise`
  - `Rough`
  - `ZOffset`
  - `Repetition`
- 每种模式统一返回结构化结果：
  - `mode`
  - `outputGcode`
  - `appliedOffsets`
  - `warnings`
- 校准生成只复用统一 `EngineConfig` 和统一偏移 helper，不再沿用 Python 全局变量风格。

### 4. GUI 接口层
- 主进程新增稳定接口：
  - `normalizeEngineConfig(raw, sourceFormat)`
  - `serializeEngineConfig(config, targetFormat)`
  - `getEngineDefaults()`
  - `getEngineEditableSchema()`
  - `processGcode(path, config)`
  - `processGcodeContent(content, config)`
  - `detectSpecialMode(gcodeContent)`
  - `generateCalibrationGcode(mode, config, sourceGcode)`
- renderer 参数页后续按两层设计：
  - 普通设置：默认暴露参数
  - 高级设置：模板与实验参数
- GUI 文案不再直接沿用 Python 内部名：
  - `have_wiping_components` 不再出现在前台
  - `Iron_apply_Flag` 改成更直白的“使用支撑面熨烫路径/最小化涂胶区域”
  - 模板类参数统一归到“高级模板”区，而不是和普通数字字段混排

## Documentation Updates
- 执行阶段新建 [`docs/MKP_ENGINE_MIGRATION_PLAN.md`](d:/trae/MKP_SE/docs/MKP_ENGINE_MIGRATION_PLAN.md)，内容固定包含：
  - 当前已完成的 JS 种子能力
  - 从 Python 提炼出的核心迁移范围
  - GUI 参数暴露矩阵
  - 后处理与校准的分阶段路线图
  - 测试与验收标准
- 执行阶段补充 [`continue.md`](d:/trae/MKP_SE/continue.md)，在文件顶部新增 `## MKP Engine Migration` 区块，固定写三段：
  - `### Completed`
  - `### Next`
  - `### Locked Decisions`
- `continue.md` 的 `Completed` 需记录：
  - 已有 CLI 双入口
  - JSON/TOML 归一化
  - offset/helper 种子
  - support/厚桥/支撑倍率/干燥等待基础逻辑
  - 新增主进程测试种子
- `continue.md` 的 `Next` 需记录：
  - `delete_wipe` 与完整 scan/replay 分离
  - Orca 熨烫取消逻辑
  - 完整擦嘴塔生成
  - 4 种校准模式
  - renderer schema 与 GUI 参数页扩展
- `continue.md` 的 `Locked Decisions` 需写死两条：
  - 范围是“后处理 + 校准”，不是旧 Tk GUI 全量搬运
  - 配置主格式是“JSON 为主，TOML 兼容”

## Test Plan
- 主进程单测继续集中在 [`tests/unit/main/mkp-engine.test.ts`](d:/trae/MKP_SE/tests/unit/main/mkp-engine.test.ts) 扩展，不另起第二套风格。
- 必测场景：
  - JSON 与 TOML 读入一致
  - `Process_GCode_Offset` 在 normal / ironing / tower 三种模式下对齐 Python
  - `delete_wipe` 与 `;ZJUMP_START`
  - Bambu support-interface 复制涂胶
  - Orca support-surface ironing 复制与过量取消
  - 厚桥和支撑倍率
  - AUTO 风扇、回温、干燥等待、硅胶/吐丝分支
  - 首层塔底与后续塔层生成
  - 伪随机擦拭序列
  - 4 种校准模式检测与输出
- CLI 集成测试要补：
  - `--Json`
  - `--Toml`
  - 校准模式自动分流
  - 缺参数/坏配置/越界坐标的结构化失败
- renderer 侧测试要补：
  - preset schema 能承载完整 `EngineConfig`
  - 参数页读写完整配置对象
  - 校准页应用结果回写 `toolhead.offset`

## Assumptions And Defaults
- 旧 Tk GUI 里的窗口和交互只作为语义参考，不作为迁移实现单位。
- `Wiping_Gcode` 和 `Tower_Base_Layer_Gcode` 虽然不是普通用户字段，但必须保留成高级可编辑接口，否则“完整迁移”会缺关键扩展点。
- `Iron_Extrude_Ratio`、`Small_Feature_Factor` 先保留为高级/实验位，不默认开放给普通用户。
- 校准 v1 先追求 Python 语义 parity，不在第一轮额外发明新的可调网格参数。
