# CLI 后处理进度窗 V2 改进计划

更新时间：2026-03-21

## 先说结论

当前这套 CLI 后处理弹窗，问题不是“功能不够”，而是“角色不够纯”。

它现在同时想做三件事：

1. 启动时的加载页
2. 处理中实时进度页
3. 结束后的报告页

成熟软件通常不会把这三种角色都做成一个“网页式仪表盘”。它们更常见的做法是：

1. 短任务：尽量不打断，直接静默更新，必要时只给一个很轻的提示
2. 长任务：给一个工具式、安装器式、层级非常清楚的状态窗口
3. 详情：默认折叠，只有在用户需要时才展开

结合我们当前 CLI 后处理的性质，最适合的方向不是继续堆“卡片 + 大标题 + 阶段块 + 指标块”，而是改成：

`经典安装器 / 工具状态窗（Classic Installer / Utility Progress Window）`

也就是：

1. 先让用户一眼知道“已经开始了”
2. 再让用户一眼知道“现在到哪一步了”
3. 最后在完成后切换成“结果摘要 + 查看详细”

不是从一开始就给一个迷你控制台或迷你仪表盘。

## 外部参考样本

以下样本主要用来提炼“交互与信息层级”，不是要求我们照着抄视觉。

| 产品 / 类型 | 公开资料 | 可借鉴点 | 不建议照搬的点 |
| --- | --- | --- | --- |
| Visual Studio Installer | https://learn.microsoft.com/en-us/visualstudio/install/install-visual-studio | 安装完成配置后，会进入专门的状态页；用户预期明确，信息层级稳定 | 它是完整安装器，信息密度可以更高，我们的后处理窗口不需要那么重 |
| Adobe Creative Cloud 安装流程 | https://helpx.adobe.com/download-install/apps/download-install-apps/creative-cloud-apps/download-creative-cloud-desktop-app-from-web.html | 安装任务是单独流程，用户不会把它误解成普通页面；长任务有独立承载面 | Adobe 的品牌感较强，我们不需要走品牌展示那条路 |
| JetBrains Toolbox / IntelliJ 更新 | https://www.jetbrains.com/help/idea/update.html | 支持更新当前实例，也支持作为独立实例处理；“新旧并存”思路很适合我们的试验版方案 | JetBrains 更偏列表管理器，不适合直接套到单次 CLI 任务 |
| GitHub Desktop 更新 | https://docs.github.com/en/desktop/installing-and-authenticating-to-github-desktop/updating-github-desktop?platform=windows | 短任务不强行拉一个复杂窗口，很多时候下载后重启即安装 | 我们的后处理不是纯更新，任务可长可短，还是需要可视化进度 |
| VS Code 自动更新 | https://code.visualstudio.com/Docs/supporting/FAQ | 默认自动更新，尽量把“更新”做成后台行为；用户只在必要时感知 | 纯静默不适合当前后处理，因为用户明确在等待处理结果 |
| Microsoft Progress 控件与进度条指南 | https://learn.microsoft.com/en-us/windows/apps/develop/ui/controls/progress-controls 、 https://learn.microsoft.com/en-us/windows/win32/uxguide/progress-bars | 长于 2 秒要给反馈；能确定就优先用 determinate progress；不要给太多互相竞争的进度信号；文本要足够久才有意义 | 指南是原则，不是视觉模板 |
| Windows 任务栏进度条 | https://learn.microsoft.com/en-us/previous-versions/dd562045(v=vs.85) | 任务栏进度应当是窗口详细进度的“镜像”，适合做辅助反馈 | 不能替代主窗口本体 |

## 反思：现在到底差在哪里

### 1. 它更像“网页”，不像“工具窗”

当前实现里有：

1. 大面积背景渐变
2. 网格纹理
3. 外壳卡片
4. 品牌头部
5. 状态胶囊
6. 总进度条
7. 阶段块
8. 指标卡片
9. 可展开详情

这会让窗口更像“单页 Web Dashboard”，而不是安装器或实用工具的进度窗。

用户看到这种界面时，大脑会默认它是“要读内容的页面”，而不是“只需要看状态的窗口”。

### 2. 信息层级太多，注意力被切碎了

当前运行态同时在竞争用户注意力的元素有：

1. 标题
2. 说明文案
3. 倒计时或反馈文字
4. 百分比
5. 进度条
6. 阶段块
7. 注入段数
8. 扫描结论
9. 输出文件

大厂软件的安装/加载窗通常只保留一个主层级：

1. 当前在做什么
2. 总进度到哪里了
3. 如果需要，再给一条辅助说明

其余内容不是不提供，而是延后提供。

### 3. 启动页和正式页虽然已经连上了，但“气质”还是两套东西

现在已经做了从 `0% -> 12%` 的启动过渡，这是对的。

但从感受上，它仍然像：

1. 先弹一个启动卡
2. 再切到一个完整报告页

这会让用户产生“我看见的是两个窗口阶段”而不是“同一个工具窗口正在进入工作态”的感觉。

真正顺眼的安装器式体验，通常是：

1. 先看到一个简洁壳子
2. 然后内容在同一壳子内长出来
3. 而不是整个视觉语言换一套

### 4. 运行态展示了太多“结果型信息”

比如指标卡片、输出文件区、详情导出按钮，这些更适合在：

1. 完成后
2. 失败后
3. 或用户主动展开时

再出现。

安装器和成熟进度窗的共同点之一，就是运行态非常克制。

### 5. 现在的动效在“证明它在动”，但还不够“让人放心”

当前有：

1. 进度条 shimmer
2. 启动页数值动画
3. 阶段块高亮推进

问题不在于动效没有，而在于动效的目标不够统一。

成熟软件里，动效通常只承担一个职责：

1. 对未知时长：告诉你“没卡死”
2. 对已知时长：告诉你“在往终点走”

而不是每个组件都自己动。

### 6. 完成态和运行态没有形成足够明显的“情绪收束”

一个好的进度窗，完成时会给用户一种“终于落地”的感觉：

1. 颜色更稳定
2. 信息更少但更清楚
3. 行动按钮更明确

当前完成态仍然有点像“运行中的同一页，只是数字到 100% 了”。

### 7. 当前实现更偏“把所有能力一次性摆上来”

这很像工程师视角，但不像产品视角。

从产品视角看，用户真正需要的是：

1. 任务开始了
2. 没卡住
3. 到哪了
4. 成功还是失败
5. 失败时去哪看细节

不是一开始就看到完整的可导出、可展开、可读技术详情的界面。

## 推荐走向

推荐采用 `经典安装器 / 工具状态窗` 方向，而不是继续扩展现有 dashboard 风格。

### 推荐窗口结构

#### 启动态

1. 紧凑窗口
2. 小 Logo 或产品名
3. 一句主状态
4. 一根主进度条
5. 一条次级说明

#### 运行态

1. 保持同一个窗口壳
2. 主标题改为当前阶段
3. 主进度条 + 百分比
4. 一条次级说明
5. 默认隐藏详情区

#### 完成态

1. 同一个窗口直接转为结果摘要
2. 成功时只展示最关键结果
3. “查看详细”变成二级动作
4. 允许导出或打开结果

#### 失败态

1. 保留窗口
2. 用明确错误态颜色
3. 默认展开错误摘要
4. 技术详情可展开

### 不推荐继续做的方向

1. 不继续增加新的指标卡片
2. 不继续增加新的阶段块层
3. 不做更花的背景与光效
4. 不把运行态做成 mini dashboard
5. 不把所有按钮都长期摆在首屏

## 非覆盖式试验原则

这是这次方案里最重要的一条。

按你的要求，新方案只能是实验版，不能直接覆盖旧方案。

### 工程上推荐这样保留旧版

严格说，“注释但不删除”可以做到，但对于 HTML/CSS/JS 这类大块 UI 来说，最稳的做法不是塞大段注释，而是：

1. 保留旧版文件为 `legacy`
2. 新版单独建 `v2`
3. 用一个开关路由

这样比“在同一个文件里保留几百行注释”更安全，也更容易随时切回。

### 建议保留方式

| 内容 | 旧版保留方式 | 新版实验方式 |
| --- | --- | --- |
| 启动页 | `buildPostprocessReportBootstrapDataUrlLegacy()` | `buildPostprocessReportBootstrapDataUrlClassicV2()` |
| 正式报告页 HTML | `postprocess_report_legacy.html` | `postprocess_report_v2.html` |
| 正式报告页脚本 | `postprocess-report-legacy.js` | `postprocess-report-v2.js` |
| 窗口路由 | `legacy` 分支继续可用 | 新增 `classic-v2` 分支 |

### 建议切换开关

优先级建议如下：

1. CLI 参数：`--postprocess-report-ui=classic-v2`
2. 环境变量：`MKP_POSTPROCESS_REPORT_UI=classic-v2`
3. 默认值：`legacy`

这样任何时候只要改一个开关，就可以立刻回退。

## 完整改进计划表

| 阶段 | 目标 | 具体动作 | 旧版保护方式 | 验收标准 | 风险 |
| --- | --- | --- | --- | --- | --- |
| 0. 冻结旧版 | 先把当前版本定格为可回退基线 | 复制当前启动页、HTML、JS 为 `legacy`；记录一组截图和行为基线 | 不删除现有逻辑，只改调用入口 | 能 100% 切回当前体验 | 几乎无风险 |
| 1. 建立变体路由 | 让新旧方案并存 | 增加 `resolvePostprocessReportUiVariant()`，支持 `legacy` / `classic-v2` | 旧版仍是默认 | 默认路径不变；开关切换成功 | 低 |
| 2. 启动页 V2 | 解决“两个窗口阶段”的割裂感 | 新启动页与正式页共享同一视觉骨架；只保留一根进度条和一条状态文案；取消阶段块卡片 | 旧启动页函数改名保留 | 打包后启动不黑屏、不白屏、视觉连续 | 低 |
| 3. 运行态 V2 | 解决“像网页不像工具窗” | 新运行态首屏只保留产品名、当前阶段、总进度、次级说明、可选折叠日志入口；指标卡片全部隐藏 | 旧 HTML/JS 保留为 `legacy` | 首屏 3 秒内，用户无需阅读复杂信息也能理解状态 | 中 |
| 4. 详情抽屉 V2 | 解决信息过载 | 详情改为单独折叠区或抽屉；只有用户点“查看详细”才展示步骤、路径、统计 | 旧详情面板保留 | 默认态更简洁，展开后信息仍完整 | 中 |
| 5. 完成态 V2 | 让完成更有“落地感” | 完成后同窗转为摘要页；显示成功图标/状态色、输出文件、耗时、关键统计、两个主按钮 | 旧完成态保留 | 用户一眼能分辨“已完成”，不是“仍在运行” | 中 |
| 6. 失败态 V2 | 提高失败可诊断性 | 失败态默认展开错误摘要；主按钮变为“查看详情 / 导出日志”；颜色和任务栏状态同步 | 旧失败态保留 | 失败时不用找半天才知道看哪里 | 低 |
| 7. 次级系统反馈 | 提升失焦场景体验 | 增加 Windows 任务栏进度镜像；完成或失败时可选 toast 提示 | 旧逻辑不删，只新增 | 窗口不在前台时，用户也能看到进度变化 | 中 |
| 8. 动效收敛 | 让动效更稳而不是更花 | 只保留一套主进度动效；移除多处同时抢眼的 shimmer/块级跃迁 | 旧动效类保留在 legacy | 看起来更稳，更像工具程序 | 低 |
| 9. 短任务优化 | 处理 0.1s~1s 的极短任务 | 保证窗口最短展示 0.8~1.0 秒，但用一套完整连贯流程完成，不闪烁、不硬切 | 旧逻辑保留 | 极短任务也能看到“开始 -> 完成” | 中 |
| 10. 打包验收 | 只按真实分发路径验收 | 只在编译安装后的环境验收，不用 `npm start` 代替 | 不影响旧版 | 与真实用户路径一致 | 低 |

## 推荐的实现顺序

不要一口气全改。

最稳的顺序应该是：

1. 先做 `legacy / classic-v2` 双路由
2. 再做启动页 V2
3. 再做运行态首屏 V2
4. 再做详情抽屉
5. 最后做完成态、失败态和任务栏镜像

原因是：

1. 这样每一步都能独立判断“有没有更像成熟软件”
2. 一旦某一步不满意，直接切回 `legacy`
3. 不会出现“改了一大堆但说不清到底是哪一处变丑了”

## 具体验收口径

### 视觉口径

1. 第一眼像工具窗，不像网页
2. 第一眼只看到一个主任务，不看到一堆可读内容
3. 运行态比完成态更克制
4. 完成态比运行态更明确

### 行为口径

1. 点击切片后 300ms~700ms 内必须有可见反馈
2. 0.1 秒任务也必须走完整个轻量流程
3. 启动页和正式页之间不能有明显“换皮”
4. 失败态必须比成功态更容易看到详细原因

### 工程口径

1. 旧版不删
2. 新版可独立开关
3. 新版不满意时一键回退
4. 打包后行为与开发期行为差距可控

## 我对下一轮的建议

下一轮不要继续在当前页面上“修修补补式加组件”了。

最值得做的是：

1. 先建立 `legacy + classic-v2` 双轨结构
2. 只做一个极简 `classic-v2` 运行态原型
3. 这个原型默认只放：
   - 标题
   - 一句状态
   - 一根百分比进度条
   - 一个“查看详细”按钮
4. 把卡片、阶段块、指标区统统延后到完成后或展开后

如果这个原型一眼看上去就更像安装器/工具窗，那我们再继续推进。
如果这个原型反而不好看，直接切回 `legacy`，成本也最低。

## 参考资料

1. Microsoft Progress controls: https://learn.microsoft.com/en-us/windows/apps/develop/ui/controls/progress-controls
2. Microsoft Progress bars UX guide: https://learn.microsoft.com/en-us/windows/win32/uxguide/progress-bars
3. Microsoft taskbar progress: https://learn.microsoft.com/en-us/previous-versions/dd562045(v=vs.85)
4. Visual Studio Installer: https://learn.microsoft.com/en-us/visualstudio/install/install-visual-studio
5. Adobe Creative Cloud desktop app install: https://helpx.adobe.com/download-install/apps/download-install-apps/creative-cloud-apps/download-creative-cloud-desktop-app-from-web.html
6. JetBrains IntelliJ IDEA updates: https://www.jetbrains.com/help/idea/update.html
7. GitHub Desktop updates: https://docs.github.com/en/desktop/installing-and-authenticating-to-github-desktop/updating-github-desktop?platform=windows
8. VS Code FAQ updates: https://code.visualstudio.com/Docs/supporting/FAQ
