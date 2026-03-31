# MKP Support Go Backend 快速开始

## 编译

### 编译CLI工具

```bash
cd backend
go build -o mkpsupport.exe ./cmd/mkpsupport
```

### 编译IPC服务器

```bash
cd backend
go build -o mkp-ipc-server.exe ./cmd/mkp-ipc-server
```

### 编译所有包

```bash
cd backend
go build ./...
```

## 使用

### CLI模式

#### 基本用法

```bash
./mkpsupport.exe --Toml config.toml --Gcode input.gcode
```

#### 调试模式（保留原文件）

```bash
./mkpsupport.exe --Toml config.toml --Gcode input.gcode --Debug
```

输出文件: `input.gcode_Output.gcode`

#### 校准模式

```bash
./mkpsupport.exe --Toml config.toml --Gcode calibration.gcode
```

输出文件: `calibration.gcode_CalibOutput.gcode`

#### 配置模式

```bash
./mkpsupport.exe --Toml config.toml --Config
```

### IPC服务器模式

```bash
./mkp-ipc-server.exe
```

服务器监听地址:
- Windows: `\\.\pipe\mkpsupport` (或 TCP `127.0.0.1:9876`)
- Linux/Mac: `/tmp/mkpsupport.sock`

## 配置文件格式

### TOML配置示例

```toml
[toolhead]
speed_limit = 100
custom_mount_gcode = """
G1 Z10
"""
custom_unmount_gcode = """
G1 Z5
"""

[toolhead.offset]
x = 0.5
y = 0.5
z = 1.0

[wiping]
have_wiping_components = true
wiper_x = 10
wiper_y = 10
wipetower_speed = 50
nozzle_cooling_flag = false
iron_apply_flag = false
user_dry_time = 0
force_thick_bridge_flag = false
support_extrusion_multiplier = 1.0

[tower]
tower_extrude_ratio = 1.0
extra_tower_height = 0
```

## 处理流程

### 三步处理

1. **参数扫描** - 从G-code注释提取切片器参数
2. **第一遍处理** - 识别支撑接触面，插入涂胶序列
3. **第二遍处理** - 插入擦料塔G-code，展开宏

### 输出文件

- 调试模式: `input.gcode_Output.gcode`
- 正常模式: 覆盖原文件 `input.gcode`
- 校准模式: `input.gcode_CalibOutput.gcode`

## 进度输出

### stderr格式

```
PROGRESS:0
PROGRESS:25
PROGRESS:50
PROGRESS:75
PROGRESS:100
```

### JSON格式

```json
{"type":"progress","percent":50,"message":"第二遍处理：插入擦嘴塔 G-code..."}
```

## 常见问题

### Q: 编译失败，提示找不到依赖

A: 运行 `go mod download` 下载依赖

```bash
cd backend
go mod download
go build ./...
```

### Q: 如何测试处理结果

A: 使用调试模式保留原文件，对比输出

```bash
./mkpsupport.exe --Toml config.toml --Gcode test.gcode --Debug
# 对比 test.gcode 和 test.gcode_Output.gcode
```

### Q: 如何与Python版本对比

A: 使用相同的配置和G-code文件，对比两个版本的输出

```bash
# Go版本
./mkpsupport.exe --Toml config.toml --Gcode test.gcode --Debug

# Python版本
python main.py --Toml config.toml --Gcode test.gcode --Debug

# 对比输出
diff test.gcode_Output.gcode test.gcode_Output.gcode
```

## 调试

### 启用详细日志

所有日志输出到stderr，可重定向到文件：

```bash
./mkpsupport.exe --Toml config.toml --Gcode test.gcode 2> debug.log
```

### 查看处理过程

临时文件 `.te` 包含第一遍处理的结果：

```bash
./mkpsupport.exe --Toml config.toml --Gcode test.gcode --Debug
# 查看 test.gcode_Output.gcode.te
```

## 性能优化

### 大文件处理

对于超过100MB的G-code文件，建议：

1. 使用调试模式避免文件覆盖
2. 监控内存使用
3. 考虑分割处理

### 并发处理

当前实现为单线程，如需并发处理多个文件，建议：

1. 使用shell脚本并行调用
2. 或修改IPC服务器支持并发请求

## 版本信息

- Go版本: 1.22+
- 基准Python版本: Wisteria 5.8.5
- Go实现版本: 1.0.0

## 更多信息

详见 `IMPLEMENTATION_SUMMARY.md`
