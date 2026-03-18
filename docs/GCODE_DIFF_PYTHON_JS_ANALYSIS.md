# Python vs JS G-code 对比分析

日期: 2026-03-18

## 对比文件
- Python 参考结果: `d:\99_临时\下载\python程序涂胶路径.gcode`
- 当前 JS 结果: `d:\99_临时\下载\.227388.1_processed.gcode`

## 这次对比得到的硬结论

### 1. 当前 JS 结果存在机型预设错配
- 两个 G-code 头部都明确写的是 `Bambu Lab A1 mini` / `A1M`。
- Python 结果里的挂载注释和坐标也是 `A1M`：
  - `;A1M`
  - 挂载/卸载坐标集中在 `X168 / X175 / X189`
- JS 结果写入的是 `a1_standard_v3.0.0-r1.json`，并且挂载注释变成了 `;A1`：
  - `; post_process = "...a1_standard_v3.0.0-r1.json" --Gcode`
  - `;A1`
  - 挂载/卸载坐标集中在 `X256 / X261 / X271`

这说明当前 JS 产物很可能用了 `A1` 预设去处理 `A1 mini` 的 G-code。哪怕提取逻辑完全正确，挂笔位、偏移位、回位也会整体错掉。

### 2. 当前 JS 结果不是局部错误，而是整份打印内容被重复了一遍
- Python 文件总行数: `30785`
- JS 文件总行数: `60070`
- JS 文件里以下标记都出现了两次:
  - `; post_process =` 在第 `324` 行和第 `30359` 行
  - `; MACHINE_START_GCODE_END` 在第 `1010` 行和第 `31045` 行
  - `; Z_HEIGHT:` 一共 `66` 次，而 Python 是 `33` 次
  - `; FEATURE: Support interface` 一共 `104` 次，而 Python 是 `52` 次

这不是“某几个胶路片段重复”，而是第一轮打印走完后，又重新从 `layer 1/33` 开始跑了一整遍。

当前结论:
- 纯 `mkp_engine.js` 的 `processGcodeContentDetailed()` 在合成样例上不会自行把整份内容复制两遍。
- 因此，整份 G-code 重复更像是 CLI 集成层、外部调用链、或切片器重复执行导致的问题，不一定是核心提取算法本身。

### 3. 当前 JS 注胶仍然是“按 feature 块注入”，不是“按 layer 聚合后注一次”
- Python 文件里 `; FEATURE: Support interface` 一共 `52` 段。
- Python 实际挂笔次数只有 `27` 次：
  - `;Toolhead Mounted = 27`
  - `;START_HERE = 27`
  - `;Prepare for next tower = 27`
- 这意味着 Python 不是每个 `Support interface` 块都立刻注胶，而是会把同一层里有效的支撑面候选合并后，只做一次完整的注胶流程。

- 当前 JS 文件因为整份内容重复，所以总注胶块数是 `104`。
- 如果只看其中一半，仍然是 `52` 次注胶，正好等于 `Support interface` 块数。

这和当前 [`src/main/mkp_engine.js`](d:/trae/MKP_SE/src/main/mkp_engine.js) 的实现是对得上的:
- 扫描循环一旦离开当前 tracked feature，就立刻调用 `buildTrackedFeatureInjectionWithReport()`
- 所以它天然是“离开一个块就注一次”
- 这和 Python 的“按层聚合后再注”模型不一样

### 4. 当前 JS 比 Python 更早开始注胶
- Python 第一段注胶从 `Z=0.4` 开始。
- 当前 JS 第一段注胶已经在 `Z=0.2` 开始。

这说明当前 JS 的有效支撑面判定过于宽松，至少少了一个“首层 support interface 不直接注胶”的门槛。

在之前的规则讨论里，已经确认“是否为有效支撑面”不应该根据上层走线去反推，而应该优先使用切片器已经给出的目标路径:
- Bambu: `; FEATURE: Support interface`
- Orca: 支撑面 `; FEATURE: Ironing`

所以这里更像是 Python 里还有一层额外的首层过滤/延后处理规则，JS 还没补齐。

### 5. Python 的注胶后恢复流程更完整，JS 目前缺失关键段
- Python 每次注胶后通常包含:
  - `;Glueing Finished`
  - `;Waiting for Glue Settling`
  - 首次出现时的 `G4 P6000`
  - `;Prepare for next tower`
  - 复制/重建出来的塔面段
  - `;START_HERE` / `;END_HERE`

- 当前 JS 每次注胶后只有:
  - 卸载
  - `;Toolhead Unmounted`
  - `G1 Z... ; resume print height`
  - 回到原始流

这说明 Python 真正的核心不只是“复制支撑面然后按路径涂胶”，还包括:
- 注胶后等待
- 下一塔准备
- 塔面恢复段复制
- 恢复到后续打印节奏

如果这些不补齐，即使提取到的胶路形状对了，整套打印流程依然可能不稳定。

## 目前可以确认没错到离谱的部分

### 1. JS 引擎本身不是“必然复制整份文件”
对 `processGcodeContentDetailed()` 做了合成样例验证:
- 输入里只有一份 `; MACHINE_START_GCODE_END`
- 输出里仍然只有一份
- `; Z_HEIGHT:` 也没有翻倍

因此，“整份文件翻倍”目前更像是 CLI 或外部调用链问题，不能直接归咎到核心扫描函数。

### 2. JS 不是完全没有提取到支撑面
从首段对比看，JS 确实在复制 `Support interface` 里的运动路径，只是现在同时叠加了:
- 错机型预设
- 错注入粒度
- 错首层判定
- 缺恢复流程

所以后续 CLI 核心不应推倒重写，而应改成更接近 Python 的分层模型。

## 对后续 CLI 的直接启发

### 第一优先级: 先做输入校验，阻止错预设继续处理
CLI 在正式处理前应该先从 G-code 头里解析:
- `printer_model`
- `print_settings_id`
- `default_print_profile`

然后和当前 preset 的 machine id 做比对。

建议策略:
- `A1 mini` G-code + `A1` preset: 默认报错并拒绝处理
- 允许后续加一个强制覆盖开关，但默认不能静默继续

### 第二优先级: 扫描模型改为“按层收集，再按层输出”
目标行为应该是:
1. 先扫描整层
2. 收集这一层所有有效 `Support interface` / 支撑面 ironing 候选
3. 做清洗、去尾、拼接、判定
4. 这一层最多输出一次完整注胶流程
5. 再做注胶后的恢复段

不要再用现在的“离开一个 feature 块就马上注一次”的流式模型。

### 第三优先级: 把“首层不过胶”做成明确规则
从这次样本看，Python 至少对 `Z=0.2` 做了额外过滤或延后处理。

下一步要从 [`main585.py`](d:/trae/MKP_SE/main585.py) 里定位:
- 是明确跳过第一层支撑面
- 还是只有存在某类 tower/recovery 条件时才从第二层开始
- 还是对 A1 mini/Bambu 流程有专门分支

### 第四优先级: 迁移 Python 的恢复语义，而不是只迁移胶路复制
后续 JS/CLI 的核心迁移范围至少应包括:
- `Glueing Finished`
- settling wait
- `Prepare for next tower`
- `START_HERE` / `END_HERE`
- 塔面恢复段复制

否则只能算“提取胶路 demo”，还不是可用的后处理引擎。

## 建议立刻补的 TDD 规格

### 引擎单测
- 同一层出现多个 `Support interface` 块时，最终只能产生一个注胶块
- Bambu/A1 mini 样式输入中，首层 `Z=0.2` 的 support interface 不应直接注胶
- 开启擦嘴塔时，注胶后必须带 `Prepare for next tower` 和恢复段
- G-code 头部机型与 preset 机型不一致时，必须显式失败

### CLI 集成测试
- 整个输出文件中 `; post_process =` 只能出现一次
- `; MACHINE_START_GCODE_END` 只能出现一次
- `; Z_HEIGHT:` 数量不能翻倍
- 对真实样例文件做一次端到端处理时，输出层数必须和输入层数一致

## 当前建议的修复顺序
1. 先加“机型头信息 vs preset”校验，避免继续产出明显错误的挂载坐标。
2. 再把扫描逻辑从“按块注入”改成“按层聚合注入”。
3. 然后补 Python 的 tower recovery / settling 行为。
4. 最后再处理高级几何选项，例如 ironing path expand/shrink 和边界裁剪。
