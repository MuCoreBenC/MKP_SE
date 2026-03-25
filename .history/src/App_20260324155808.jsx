// src/App.jsx
import React, { useState, useEffect } from 'react';
import Sidebar from './components/layout/Sidebar';
import HomePage from './pages/HomePage';
import DownloadPage from './pages/DownloadPage';
// ... 引入其他页面 ...

export default function App() {
  const [activePage, setActivePage] = useState('home');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // 🌟 1. 定义主题的全局状态（初始化时，优先读取本地缓存，没有就默认 'light'）
  const [themeMode, setThemeMode] = useState(() => {
    return localStorage.getItem('themeMode') || 'light';
  });

  // 🌟 2. 魔法监听器：只要 themeMode 发生变化，自动执行这里的代码！
  useEffect(() => {
    const html = document.documentElement; // 获取 <html> 标签
    
    // 每次变化前，先把旧的 class 剥离干净
    html.classList.remove('dark', 'oled');
    // 注入给你的 CSS 使用的属性选择器
    html.setAttribute('data-theme-mode', themeMode);

    // 根据当前状态，穿上对应的皮肤
    if (themeMode === 'dark') {
      html.classList.add('dark');
    } else if (themeMode === 'oled') {
      // 你的 CSS 里 oled 通常也需要依赖 dark 的基础变量，所以两个都加
      html.classList.add('dark', 'oled'); 
    }

    // 瞬间存入本地缓存，下次打开自动恢复！
    localStorage.setItem('themeMode', themeMode);
  }, [themeMode]); // 这里的 [themeMode] 意思是：只在 themeMode 改变时执行

  // 🌟 3. 循环切换逻辑
  const toggleTheme = () => {
    const modes = ['light', 'dark', 'oled'];
    // 找到当前模式的索引，+1 后取模（为了让它在 0, 1, 2 之间无限循环）
    const nextIndex = (modes.indexOf(themeMode) + 1) % modes.length;
    setThemeMode(modes[nextIndex]); // 触发状态更新！
  };

  return (
    <div id="mainApp" className="flex h-screen">
      <Sidebar
        activePage={activePage}
        onPageChange={setActivePage}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        // 🌟 4. 把当前的主题模式和切换函数，当做“螺旋桨”传给左侧边栏
        currentTheme={themeMode}
        onToggleDarkMode={toggleTheme}
      />

      <main className="flex-1 overflow-hidden flex flex-col transition-colors">
        {activePage === 'home' && <HomePage onNext={() => setActivePage('download')} />}
        {activePage === 'download' && <DownloadPage onPrev={() => setActivePage('home')} onNext={() => setActivePage('calibrate')} />}
        {activePage === 'calibrate' && <CalibrationPage onPrev={() => setActivePage('download')} />}
        {activePage === 'params' && <ParamsPage />}
        {activePage === 'versions' && <VersionsPage />}
        {activePage === 'faq' && <FaqPage />}
        {activePage === 'about' && <AboutPage />}
        {activePage === 'setting' && <SettingsPage />}
      </main>
    </div>
  );
}