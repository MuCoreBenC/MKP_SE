# MKP_SE

MKP_SE 是一个功能强大的 3D 打印机固件参数管理系统，提供了直观的用户界面和丰富的功能，帮助用户轻松管理和配置 3D 打印机的参数设置。

## 功能特性

- **参数管理**：直观的参数编辑界面，支持各种 3D 打印机型号的参数配置
- **预设管理**：创建、保存和加载参数预设，方便不同打印场景的快速切换
- **校准工具**：内置多种校准功能，确保打印机的最佳性能
- **版本管理**：跟踪固件版本和参数变更历史
- **发布中心**：管理固件发布和更新
- **跨平台支持**：基于 Electron 构建，支持 Windows、macOS 和 Linux

## 技术栈

- **前端**：TypeScript、Tailwind CSS、Electron
- **后端**：Node.js
- **构建工具**：Vite
- **测试框架**：Vitest

## 项目结构

```
MKP_SE/
├── docs/              # 项目文档
├── src/               # 源代码
│   ├── main/          # 主进程代码
│   ├── renderer/      # 渲染进程代码
│   └── default_models/ # 默认模型文件
├── tests/             # 测试代码
├── package.json       # 项目配置
└── README.md          # 项目说明
```

## 安装与运行

### 前置要求

- Node.js 18.0 或更高版本
- npm 9.0 或更高版本

### 安装步骤

1. 克隆仓库
   ```bash
   git clone https://github.com/MuCoreBenC/MKP_SE.git
   cd MKP_SE
   ```

2. 安装依赖
   ```bash
   npm install
   ```

3. 开发模式运行
   ```bash
   npm run dev
   ```

4. 构建生产版本
   ```bash
   npm run build
   ```

## 快速开始

1. 启动应用程序
2. 选择您的 3D 打印机型号
3. 编辑参数设置或选择预设
4. 保存配置并应用到打印机

## 贡献指南

欢迎贡献代码和提出问题！请遵循以下步骤：

1. Fork 仓库
2. 创建特性分支
3. 提交更改
4. 推送分支
5. 打开 Pull Request

## 许可证

本项目采用 MIT 许可证，详情请查看 LICENSE 文件。

## 联系方式

- 项目地址：https://github.com/MuCoreBenC/MKP_SE
- 问题反馈：https://github.com/MuCoreBenC/MKP_SE/issues

---

感谢使用 MKP_SE！希望它能帮助您更好地管理和配置您的 3D 打印机。