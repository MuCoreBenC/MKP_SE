// 从你的 app.js 中提取的全局状态常量和初始值
export const CLOUD_BASES = {
  gitee: 'https://gitee.com/MuCoreBenC/MKP_Support_Electron/raw/main',
  jsDelivr: 'https://cdn.jsdelivr.net/gh/MuCoreBenC/MKP_Support_Electron@main',
  github: 'https://raw.githubusercontent.com/MuCoreBenC/MKP_Support_Electron/main'
};

export const VERSION_THEMES = {
  standard: { title: '标准版', bg: 'var(--theme-standard-bg)', text: 'var(--theme-standard-text)' },
  quick: { title: '快拆版', bg: 'var(--theme-quick-bg)', text: 'var(--theme-quick-text)' },
  lite: { title: 'Lite版', bg: 'var(--theme-lite-bg)', text: 'var(--theme-lite-text)' }
};

// 后续我们会用 React 的 useState 或 useContext 来管理这些动态变量
export const initialAppState = {
  selectedVersion: null,
  selectedPrinter: 'a1',
  selectedBrand: 'bambu',
  currentStep: 1,
  sidebarCollapsed: false,
};