# MKP SupportE 从 0 开始数据模型设计文档

版本: v1.0  
状态: 草案  
日期: 2026-03-15  
配套文档:

- `docs/PRD_FROM_SCRATCH.md`
- `docs/ARCHITECTURE_FROM_SCRATCH.md`

---

## 1. 文档目标

本文件定义 MKP SupportE 从 0 开始重建时的数据模型基线，目标是解决以下问题:

- 哪些是核心业务实体
- 每个实体的字段含义和归属是什么
- 哪些数据跟随安装包，哪些属于用户覆盖层
- 哪些数据允许远端驱动，哪些必须以本地运行时为准
- 数据结构如何版本化、校验和迁移

本文件不讨论页面布局，只讨论数据结构和约束。

---

## 2. 数据建模反思

如果从 0 开始，最需要避免的错误是:

- 把“显示数据”和“业务真相”混在一个对象里
- 让文件名承担版本号、类型、机型、显示名等多个职责
- 让 `localStorage` 同时保存页面状态、业务状态、同步信号、临时编辑状态
- 默认资源、用户覆盖资源、远端资源不分层
- 页面在没有 schema 的情况下直接拼字段

因此，新的数据模型必须遵守以下原则:

1. 所有核心实体必须可单独定义 schema  
2. 业务唯一标识和显示名称必须分离  
3. 文件元信息和文件内容必须分离  
4. 本地安装状态和远端可更新状态必须分离  
5. 当前上下文必须被显式建模，而不是由多个散落 key 隐式拼装  

### 2.1 明确不建模的数据域

本项目当前阶段明确不建设以下数据域:

- 用户画像标签
- 用户行为埋点事件仓库
- 云端设备画像
- 超过中英文范围的语言包资源索引

日志相关只保留最小必要集合:

- 本地错误日志
- 崩溃上下文
- 手动导出的诊断包元信息

---

## 3. 数据分层总览

推荐将数据分成 6 层。

### D1 默认目录数据

用途:

- 默认品牌
- 默认机型
- 默认图片引用

来源:

- 安装包内置代码 / 默认资源

特点:

- 随安装包分发
- 可由发布中心维护

### D2 默认预设资源

用途:

- 默认 JSON 预设
- 默认 presets manifest

来源:

- `cloud_data/presets`

特点:

- 随安装包分发
- 作为离线回退源

### D3 用户覆盖层

用途:

- 用户自定义品牌和机型
- 用户导入图片
- 用户本地预设文件

来源:

- userData

特点:

- 永远不直接覆盖安装包默认文件
- 可随“恢复安装时状态”被整体清理

### D4 运行时上下文

用途:

- 当前品牌
- 当前机型
- 当前版本
- 当前已应用预设

来源:

- `UserConfigStore`

特点:

- 必须可持久化
- 必须多窗口同步

### D5 编辑器状态

用途:

- 参数编辑器 dirty
- undo/redo
- 焦点
- 当前编辑模式

来源:

- `ParamEditorStore`

特点:

- 主要驻留内存
- 不直接跨窗口覆盖

### D6 远端更新数据

用途:

- app manifest
- presets manifest
- patch 索引

来源:

- 远端仓库

特点:

- 只读
- 不能直接代表当前安装状态

---

## 4. 核心实体清单

建议至少定义以下 12 个核心实体:

1. `Brand`
2. `Printer`
3. `CatalogImage`
4. `PresetFileMeta`
5. `PresetContent`
6. `PresetManifestEntry`
7. `AppManifest`
8. `UserConfig`
9. `ActivePresetSession`
10. `CalibrationOffsets`
11. `ParamEditorSession`
12. `ReleaseConfig`

---

## 5. 实体定义

## 5.1 Brand

### 用途

表示品牌目录项。

### 字段建议

```json
{
  "id": "bambu",
  "displayName": "Bambu Lab",
  "shortName": "Bambu",
  "subtitle": "Bambu 官方机型",
  "imageRef": "catalog/brands/bambu.webp",
  "favorite": true,
  "pinned": true,
  "disabled": false,
  "builtin": true,
  "canDelete": false,
  "sortOrder": 10,
  "createdAt": "2026-03-15T00:00:00.000Z",
  "updatedAt": "2026-03-15T00:00:00.000Z"
}
```

### 规则

- `id` 为英文业务唯一标识
- `displayName` 和 `shortName` 仅用于显示
- `builtin` 表示是否为安装包默认数据
- `canDelete` 由系统规则计算，不建议用户自由写

## 5.2 Printer

### 用途

表示机型目录项。

### 字段建议

```json
{
  "id": "a1",
  "brandId": "bambu",
  "displayName": "Bambu Lab A1",
  "shortName": "A1",
  "subtitle": "标准喷嘴配置",
  "imageRef": "catalog/printers/a1.webp",
  "supportedVersionTypes": ["standard", "quick"],
  "defaultPresetRefs": {
    "standard": "a1_standard_v3.0.0-r1.json",
    "quick": "a1_quick_v3.0.0-r1.json"
  },
  "favorite": false,
  "pinned": false,
  "disabled": false,
  "builtin": true,
  "canDelete": false,
  "sortOrder": 20,
  "createdAt": "2026-03-15T00:00:00.000Z",
  "updatedAt": "2026-03-15T00:00:00.000Z"
}
```

### 规则

- `brandId + id` 必须可稳定关联
- `supportedVersionTypes` 只能取枚举值
- `defaultPresetRefs` 只表示默认建议，不代表当前已应用预设

## 5.3 CatalogImage

### 用途

表示品牌或机型目录图像。

### 字段建议

```json
{
  "id": "printer_a1_primary",
  "ownerType": "printer",
  "ownerId": "a1",
  "storageLayer": "builtin",
  "relativePath": "assets/images/a1.webp",
  "mimeType": "image/webp",
  "width": 512,
  "height": 512,
  "transparent": true,
  "createdAt": "2026-03-15T00:00:00.000Z"
}
```

### 规则

- 图片本身是资源，元信息是数据
- 不能让页面直接猜“这个路径是不是用户上传的”

## 5.4 PresetFileMeta

### 用途

表示一个本地或默认预设文件在文件系统中的元信息。

### 字段建议

```json
{
  "fileName": "a1_standard_v3.0.0-r1.json",
  "absolutePath": "C:\\Users\\...\\a1_standard_v3.0.0-r1.json",
  "storageLayer": "user",
  "printerId": "a1",
  "versionType": "standard",
  "contentVersion": "3.0.0-r1",
  "displayName": "A1 标准版",
  "customDisplayName": "A1 我的调参版",
  "size": 18234,
  "createdAt": 1710000000000,
  "updatedAt": 1710000100000,
  "sha1": "..."
}
```

### 规则

- `contentVersion` 必须优先来自文件内容和 manifest，而不是文件名
- `customDisplayName` 允许用户改显示名，但不能改业务 `fileName`

## 5.5 PresetContent

### 用途

表示预设 JSON 内容。

### 字段建议

```json
{
  "printer": "a1",
  "type": "standard",
  "version": "3.0.0-r1",
  "toolhead": {
    "offset": {
      "x": 0.0,
      "y": 0.0,
      "z": 3.8
    },
    "custom_mount_gcode": "....",
    "custom_unmount_gcode": "....",
    "speed_limit": 69.0
  },
  "_custom_name": "A1 我的调参版"
}
```

### 规则

- 真实业务字段和内部保留字段必须有命名区分
- 保留字段统一用 `_` 前缀
- 字段说明元信息不要写在业务 JSON 本体里，应由独立 meta schema 提供

## 5.6 PresetManifestEntry

### 用途

表示远端或默认资源中的预设清单项。

### 字段建议

```json
{
  "id": "a1",
  "type": "standard",
  "version": "3.0.0-r1",
  "file": "a1_standard_v3.0.0-r1.json",
  "description": "标准版默认预设",
  "releaseNotes": [
    "优化默认参数",
    "调整支撑接触策略"
  ],
  "lastModified": "2026-03-15",
  "sha1": "..."
}
```

### 规则

- `id` 表示机型 id，不是全局唯一主键
- 真正清单索引键建议为 `id + type + version`

## 5.7 AppManifest

### 用途

表示软件版本、更新说明、下载地址和历史版本信息。

### 字段建议

```json
{
  "latestVersion": "0.2.10",
  "updateType": "hot_update",
  "downloadUrl": "https://.../patch_v0.2.10.zip",
  "forceUpdate": false,
  "releaseDate": "2026-03-15",
  "shortDesc": "更新描述",
  "canRollback": true,
  "releaseNotes": ["..."],
  "releaseNotesMarkdown": "# 0.2.10",
  "history": []
}
```

### 规则

- 远端 manifest 是远端状态
- 本地安装版本不是从远端 manifest 推导，而是从安装内容推导

## 5.8 UserConfig

### 用途

表示用户的持久业务配置。

### 字段建议

```json
{
  "selectedBrandId": "bambu",
  "selectedPrinterId": "a1",
  "selectedVersionType": "standard",
  "appliedPresetByContext": {
    "a1_standard": "a1_standard_v3.0.0-r1.json"
  },
  "onboardingEnabled": false,
  "updateMode": "manual",
  "themeMode": "light",
  "dockAnimationEnabled": true,
  "dockBaseSize": 38,
  "dockMaxScale": 1.5,
  "updatedAt": "2026-03-15T00:00:00.000Z"
}
```

### 规则

- `selectedVersionType` 绝不能允许 `null` 持久化为有效上下文
- `appliedPresetByContext` 是“当前已应用预设”的唯一真相源
- 页面 UI 状态不要混进这里

## 5.9 ActivePresetSession

### 用途

表示当前用户上下文下的“当前预设会话”。

### 字段建议

```json
{
  "contextKey": "a1_standard",
  "printerId": "a1",
  "versionType": "standard",
  "activeFileName": "a1_standard_v3.0.0-r1.json",
  "activeFilePath": "C:\\Users\\...\\a1_standard_v3.0.0-r1.json",
  "storageLayer": "user",
  "resolvedVersion": "3.0.0-r1"
}
```

### 规则

- `contextKey` 必须始终有效
- 禁止 `a1_null` 这种状态作为合法会话写入

## 5.10 CalibrationOffsets

### 用途

表示从当前预设中提取出的偏移值。

### 字段建议

```json
{
  "x": 0.0,
  "y": 0.0,
  "z": 3.8,
  "sourcePresetPath": "C:\\Users\\...\\a1_standard_v3.0.0-r1.json",
  "sourceVersion": "3.0.0-r1",
  "updatedAt": "2026-03-15T00:00:00.000Z"
}
```

## 5.11 ParamEditorSession

### 用途

表示参数编辑器的内存状态。

### 字段建议

```json
{
  "presetPath": "C:\\Users\\...\\a1_standard_v3.0.0-r1.json",
  "mode": "structured",
  "dirty": true,
  "savedSnapshotHash": "...",
  "currentSnapshotHash": "...",
  "historyIndex": 15,
  "historyLength": 24,
  "lastFocus": {
    "type": "field",
    "key": "toolhead.offset.z"
  },
  "lastExternalMutationAt": 1710000000000
}
```

### 规则

- 这是编辑器状态，不应直接持久化到用户配置
- 多窗口之间不自动同步其内部编辑历史

## 5.12 ReleaseConfig

### 用途

表示发布中心当前正在编辑的发版信息。

### 字段建议

```json
{
  "version": "0.2.10",
  "releaseDate": "2026-03-15",
  "shortDesc": "更新描述",
  "releaseNotesMarkdown": "# 0.2.10",
  "updateType": "hot_update",
  "forceUpdate": false,
  "canRollback": true,
  "selectedBuildMode": 2
}
```

---

## 6. 关键枚举定义

### VersionType

```txt
standard
quick
lite
```

### StorageLayer

```txt
builtin
user
remote
cache
```

### UpdateMode

```txt
manual
auto
```

### BuildMode

```txt
1 = minimal hot update
2 = standard hot update
3 = full hot update
4 = full installer build
```

---

## 7. 文件与显示名分离原则

必须明确:

- 文件名用于文件系统与唯一性
- 显示名用于界面
- 版本用于业务比较

禁止:

- 用文件名直接判断“最新版本”
- 用显示名反推文件名
- 修改显示名影响文件唯一标识

建议:

- 文件名固定英文
- 显示名单独字段
- 版本从文件内容或 manifest 解析

---

## 8. 默认资源与用户覆盖层模型

### 8.1 默认资源

存储:

- 安装包内
- 发布中心可维护

特点:

- 可被恢复到安装时状态
- 作为默认真相源

### 8.2 用户覆盖层

存储:

- userData

特点:

- 只对用户可见
- 不直接修改默认资源

### 8.3 读取优先级

建议优先级:

1. 用户覆盖层
2. 默认资源
3. 远端只读资源

### 8.4 恢复默认

恢复默认分两个层级:

- 恢复当前预设为默认内容
- 恢复整个应用到安装时初始状态

这两者必须是不同操作，不可混淆。

---

## 9. 远端数据与本地数据分离规则

### 9.1 app manifest

- 远端 manifest: 表示“最新可更新版本”
- 本地安装状态: 表示“当前已安装版本”

这两者必须分离存储。

### 9.2 presets manifest

- 远端 manifest: 表示“云端提供哪些预设”
- 本地预设: 表示“用户已拥有和已应用哪些文件”

### 9.3 patch 包

- patch 包属于发布物
- 不属于安装包运行时必须长期持有的资源

---

## 10. 数据迁移策略

### 10.1 何时需要迁移

- schema 版本变化
- 字段重命名
- 数据拆层
- 历史 `localStorage` key 合并

### 10.2 迁移原则

- 启动时迁移
- 迁移必须幂等
- 迁移失败要保底回退
- 原始数据要尽量保留备份

### 10.3 典型迁移示例

- 历史 `mkp_user_config` 拆成 `UserConfig`
- 历史 `mkp_current_script_${context}` 收口进 `appliedPresetByContext`
- 历史主题设置散 key 收口进 `ThemeConfig`

---

## 11. schema 文件建议

建议目录:

```txt
src/
  shared/
    schemas/
      brand.schema.json
      printer.schema.json
      user-config.schema.json
      preset.schema.json
      presets-manifest.schema.json
      app-manifest.schema.json
      release-config.schema.json
```

---

## 12. 必须建立的数据约束

### C1 上下文键约束

- 必须为 `printerId_versionType`
- 不能为空
- 不能持久化 `null`

### C2 版本约束

- 必须为结构化版本号
- 文件名与内容版本不一致时，以内容版本和 manifest 为准

### C3 删除约束

- 默认品牌和默认机型不可直接删除
- 用户复制和用户创建项才可删除

### C4 覆盖约束

- 用户覆盖层不能无痕覆盖默认资源
- 所有覆盖关系必须可追踪

---

## 13. 数据模型成功标准

如果这套模型设计正确，应该达到以下效果:

- 页面不再需要猜字段
- 多窗口不再通过零散 key 拼状态
- 预设文件管理更稳定
- “当前版本”“当前预设”“默认资源”“用户覆盖层”边界明确
- 更新、恢复默认、回退不再互相污染

---

## 14. 结论

从 0 开始时，真正先要做好的不是页面，而是数据模型。

只要数据模型不稳定，后续所有功能都会反复出问题:

- 预设状态丢失
- 多窗口覆盖
- 更新判断错误
- 文件版本识别错误
- 恢复默认行为混乱

因此，本文件应作为所有后续 schema、Store、Service 和 IPC 设计的基础文档。
