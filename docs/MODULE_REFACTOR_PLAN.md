# MKP SupportE 模块重构计划

版本: v1.0  
状态: 草案  
日期: 2026-03-15  
适用范围: 基于当前项目现状，制定从现有代码迁移到清晰模块架构的可执行拆分计划

---

## 1. 文档目标

本文件回答两个问题:

- 现有项目为什么会越写越乱
- 如何在不一次性推倒重来的前提下，把当前代码逐步迁移到更合理的模块结构

本文件不是“最终理想架构”，而是“从当前项目出发的重构落地计划”。

---

## 2. 当前代码问题反思

从当前项目状态看，最大的技术债不是单个 bug，而是结构性问题。

### 2.1 当前主要问题

- `app.js` 仍然是全局总线、大量逻辑入口和历史兼容层混合体
- `home.js`、`presets.js`、`params.js`、`updates.js` 已经各自承担业务域，但边界仍不完全明确
- 存在“后定义覆盖前定义”的历史实现
- 页面层经常直接碰文件状态和 `localStorage`
- 发布中心和用户端共享数据，但缺少领域服务隔离
- 运行时逻辑、维护逻辑、更新逻辑仍有交叉

### 2.2 如果继续不拆，会导致什么

- 每修一个 bug 都可能引出新的联动问题
- 多窗口和多页面状态永远难稳定
- 参数页继续扩展会越来越难维护
- 发布中心会继续污染主程序逻辑
- 任何一个新需求都必须先“猜”旧代码怎么接

---

## 3. 重构总原则

1. 不做一次性大爆炸式重写  
2. 先抽服务层，再搬页面逻辑  
3. 先建立边界，再删除重复实现  
4. 每次重构都要保留用户可用性  
5. 重构必须伴随最小验证  
6. 发布中心必须逐步从用户端运行时包体中剥离

---

## 4. 当前模块盘点

当前核心文件:

- `src/renderer/assets/js/app.js`
- `src/renderer/assets/js/home.js`
- `src/renderer/assets/js/presets.js`
- `src/renderer/assets/js/params.js`
- `src/renderer/assets/js/updates.js`
- `src/renderer/assets/js/theme.js`
- `src/renderer/assets/js/release.js`
- `src/main/main.js`
- `src/main/release-ops.js`
- `src/main/release-config-ops.js`
- `src/main/catalog-store.js`
- `src/main/mkp_engine.js`

结论:

- 主进程部分已经出现服务化趋势
- 渲染层仍然明显偏“大脚本组合”

---

## 5. 目标模块结构

建议从当前项目逐步迁移到以下结构:

```txt
src/renderer/app/
  core/
  stores/
  services/
  controllers/
  sync/
  components/
  pages/
  adapters/
  utils/

tools/release-center/
  renderer/
  main/
  shared/
```

说明:

- `src/renderer/app/` 面向终端用户主程序
- `tools/release-center/` 面向开发者发布工具
- 两者可共享 schema、服务契约和构建脚本，但不共享页面实现和运行时打包入口

### 5.1 core

放:

- 常量
- 事件名
- 应用级上下文

### 5.2 stores

放:

- `user-config-store`
- `preset-session-store`
- `param-editor-store`
- `calibration-store`
- `update-store`

### 5.3 services

放:

- `catalog-service`
- `preset-service`
- `calibration-service`
- `param-editor-service`
- `update-service`
- `release-service`

### 5.4 controllers

放:

- 页面控制器
- 用户交互编排逻辑

### 5.5 sync

放:

- 跨页面事件总线
- 多窗口同步
- 外部修改提示

### 5.6 adapters

放:

- `local-storage-adapter`
- `ipc-adapter`
- `remote-manifest-adapter`

---

## 6. 具体拆分策略

## 6.1 app.js 拆分计划

### 当前职责过多

`app.js` 当前混合了:

- 全局常量
- 用户配置
- 事件广播
- 页面导航
- 校准逻辑
- 参数页联动
- 多窗口同步
- 启动初始化

### 目标拆分

建议拆为:

- `core/app-context.js`
- `stores/user-config-store.js`
- `services/navigation-service.js`
- `services/calibration-service.js`
- `sync/cross-window-sync-service.js`
- `bootstrap/app-bootstrap.js`

### 拆分顺序

1. 先抽常量与事件
2. 再抽 `saveUserConfig/loadUserConfig`
3. 再抽校准相关
4. 再抽多窗口同步
5. 最后收口 `init()`

## 6.2 home.js 拆分计划

### 当前主要职责

- 品牌和机型目录渲染
- 选择逻辑
- 右键菜单
- 用户目录操作

### 目标拆分

- `services/catalog-service.js`
- `controllers/home-controller.js`
- `components/brand-list.js`
- `components/printer-gallery.js`
- `components/home-context-menu.js`

## 6.3 presets.js 拆分计划

### 当前主要职责

- 在线清单获取
- 本地预设列表
- 应用预设
- 下载预设
- 列表渲染

### 目标拆分

- `services/preset-service.js`
- `services/preset-manifest-service.js`
- `controllers/presets-controller.js`
- `components/preset-list.js`
- `components/preset-actions.js`

## 6.4 params.js 拆分计划

### 当前主要职责

- 当前预设读取
- 参数 schema 映射
- 编辑器模式切换
- G-code 行级编辑
- 历史栈
- 保存 / 恢复默认

### 目标拆分

- `stores/param-editor-store.js`
- `services/param-editor-service.js`
- `services/gcode-editor-service.js`
- `controllers/params-controller.js`
- `components/param-field.js`
- `components/gcode-line-editor.js`
- `components/param-context-menu.js`

### 特别说明

参数页必须被视为单独子系统。

## 6.5 updates.js 拆分计划

### 当前主要职责

- manifest 获取
- 版本列表渲染
- 更新检查
- 更新浮层
- 红点提示

### 目标拆分

- `stores/update-store.js`
- `services/update-service.js`
- `controllers/updates-controller.js`
- `components/update-badge.js`
- `components/update-panel.js`

## 6.6 theme.js 拆分计划

### 当前主要职责

- 主题模式
- 全局色
- 自定义颜色
- 版本主题色

### 目标拆分

- `stores/theme-store.js`
- `services/theme-service.js`
- `components/theme-picker.js`

## 6.7 release.js 拆分计划

### 当前主要职责

- 发布中心页面控制
- 默认资源后台控制
- 版本信息编辑
- 预设维护

### 目标拆分

- `controllers/release-controller.js`
- `services/release-service.js`
- `services/default-resource-service.js`
- `components/release-editor.js`
- `components/resource-editor.js`

---

## 7. 主进程重构计划

## 7.1 main.js 拆分方向

`main.js` 目标只保留:

- Electron 生命周期
- 窗口创建
- IPC 注册入口

业务能力下沉到:

- `ipc/catalog-ipc.js`
- `ipc/preset-ipc.js`
- `ipc/update-ipc.js`
- `ipc/release-ipc.js`
- `ipc/system-ipc.js`

## 7.2 当前主进程服务整理

保留并继续服务化:

- `catalog-store.js`
- `release-ops.js`
- `release-config-ops.js`
- `mkp_engine.js`

建议补充:

- `preset-file-service.js`
- `update-runtime-service.js`
- `manifest-cache-service.js`
- `backup-service.js`

---

## 8. 重构阶段划分

### R1 基础设施收口

目标:

- 提取常量、事件名、适配器、日志入口

输出:

- `core/`
- `adapters/`
- `sync/` 雏形

### R2 状态层建立

目标:

- 建立统一 Store

输出:

- `UserConfigStore`
- `PresetSessionStore`
- `UpdateStore`
- `CalibrationStore`

### R3 预设与上下文域重构

目标:

- 把“当前机型/版本/预设”抽成正式领域

输出:

- `PresetService`
- `CatalogService`
- `ContextResolver`

### R4 校准与参数域重构

目标:

- 把最复杂的联动逻辑脱离页面

输出:

- `CalibrationService`
- `ParamEditorService`
- `ParamEditorStore`

### R5 更新域重构

目标:

- 清理历史覆盖实现
- 固定版本源和远端缓存边界

### R6 发布中心重构

目标:

- 把维护端与用户端能力彻底分清

---

## 9. 每阶段完成标准

### R1 完成标准

- 常量和事件统一登记
- 同步 key 有文档
- 页面不再到处硬编码 key

### R2 完成标准

- 用户配置只通过 Store 写入
- 不再直接在页面里写 `localStorage`

### R3 完成标准

- 预设上下文统一由服务计算
- 不再出现 `_null` 上下文

### R4 完成标准

- 参数页保存、恢复默认、外部修改提示统一走服务层
- 校准读写不再散在多个页面函数里

### R5 完成标准

- 更新逻辑不再依赖历史重复定义
- 当前版本和远端版本彻底分离

### R6 完成标准

- 发布中心只调用服务，不直接碰杂乱页面逻辑

---

## 10. 重构过程中的兼容策略

### 10.1 不允许的风险操作

- 一次性删除旧代码而没有兼容层
- 大规模替换 key 但没有迁移策略
- 页面行为全部重写但没有冒烟验证

### 10.2 建议兼容方式

- 新服务先接管新入口
- 旧函数保留为代理层
- 先“最后定义重定向”，再逐步清理旧实现

### 10.3 数据兼容

- 所有旧 `localStorage` key 必须登记
- 新 store 接管时先读旧 key 并迁移

---

## 11. 测试与重构联动

### 11.1 重构前必须补的最低测试

- 版本比较
- 当前预设上下文计算
- 用户配置保存 / 读取
- 预设版本解析

### 11.2 每次重构后必须跑的冒烟流程

1. 启动软件
2. 选择机型和版本
3. 应用本地预设
4. 打开校准页
5. 修改参数并保存
6. 切换页面
7. 检查更新

---

## 12. 优先级建议

### P0

- `app.js`
- `params.js`
- `updates.js`
- `main.js`

### P1

- `home.js`
- `presets.js`
- `release.js`

### P2

- `theme.js`
- `wizard.js`
- 辅助组件和样式层

---

## 13. 预计产出清单

重构完成后应新增:

- `src/renderer/app/core/*`
- `src/renderer/app/stores/*`
- `src/renderer/app/services/*`
- `src/renderer/app/controllers/*`
- `src/renderer/app/sync/*`
- `src/main/ipc/*`
- `src/main/services/*`

并逐步让旧 `assets/js/*.js` 退化为:

- 兼容入口
- 页面装配层

---

## 14. 技术债清理规则

重构过程中，以下问题必须纳入正式清理清单:

- 重复定义覆盖同名函数
- 历史乱码文本
- 页面层直接写文件
- 页面层直接拼复杂业务 key
- 逻辑和 UI 强耦合
- 更新链路和发布链路混杂

---

## 15. 从现状到目标结构的最短路径

如果只追求最短、最稳路径，建议按下面顺序落地:

1. 先把当前 key 和事件收口成常量
2. 先把用户配置收口进 Store
3. 先把当前预设上下文做成 Service
4. 先把参数页保存链重构
5. 再重构校准和更新
6. 最后做发布中心的彻底解耦

---

## 16. 结论

当前项目并不适合继续直接堆功能。

正确做法是:

- 先拆状态
- 再拆服务
- 再拆页面
- 再删旧实现

这样才能在不中断现有功能的前提下，把项目从“可用但脆弱”的状态，逐步迁移到“可持续演进”的状态。
