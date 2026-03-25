// src/App.jsx
import React, { useState, useEffect } from 'react';
import Sidebar from './components/layout/Sidebar';
import HomePage from './pages/HomePage';
import DownloadPage from './pages/DownloadPage';
import CalibrationPage from './pages/CalibrationPage';
import ParamsPage from './pages/ParamsPage';
import VersionsPage from './pages/VersionsPage';
import FaqPage from './pages/FaqPage';
import AboutPage from './pages/AboutPage';
import SettingsPage from './pages/SettingsPage';

export default function App() {
  const [activePage, setActivePage] = useState('setting'); // 先默认切到设置页方便调试
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // 1. 核心状态：当前的主题模式 (light, dark, oled, system)
  const [themeMode, setThemeMode] = useState(() => {
    return localStorage.getItem('themeMode') || 'light';
  });

  // 2. 数据驱动的副作用：只负责把状态写进 HTML 标签和 LocalStorage
  useEffect(() => {
    const html = document.documentElement;
    const isDark = themeMode === 'dark' || themeMode === 'oled' || 
      (themeMode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

    // 设置基础属性
    html.setAttribute('data-theme-mode', themeMode);
    html.classList.toggle('dark', isDark);
    html.classList.toggle('oled', themeMode === 'oled');

    // 保存到本地
    localStorage.setItem('themeMode', themeMode);

    // 💡 保存用户的“偏好黑夜模式”，方便左侧边栏一键切换时能回到他喜欢的黑夜
    if (themeMode === 'dark' || themeMode === 'oled') {
      localStorage.setItem('preferredDarkMode', themeMode);
    }

    // 💡 通知 Electron 主进程更新原生窗口颜色
    if (window.mkpAPI && window.mkpAPI.setNativeTheme) {
      const nativeMode = themeMode === 'oled' ? 'dark' : themeMode; 
      window.mkpAPI.setNativeTheme(nativeMode); 
    }
  }, [themeMode]);

  // 3. 带炫酷圆圈动画的切换函数
  const changeThemeWithAnimation = (newMode, event) => {
    if (themeMode === newMode) return;

    // 如果浏览器不支持 View Transitions API，直接切
    if (!document.startViewTransition) {
      setThemeMode(newMode);
      return;
    }

    // 计算鼠标点击的位置，作为圆圈扩散的圆心
    const x = (event && event.clientX !== undefined) ? event.clientX : window.innerWidth / 2;
    const y = (event && event.clientY !== undefined) ? event.clientY : window.innerHeight / 2;
    const endRadius = Math.hypot(
      Math.max(x, window.innerWidth - x), 
      Math.max(y, window.innerHeight - y)
    );

    // 启动魔法动画
    const transition = document.startViewTransition(() => {
      // 这里必须同步更新状态，React 会在下一帧渲染
      setThemeMode(newMode);
    });

    transition.ready.then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${endRadius}px at ${x}px ${y}px)`] },
        { duration: 400, easing: "ease-out", pseudoElement: "::view-transition-new(root)" }
      );
    });
  };

  // 4. 提供给左侧边栏的快捷切换逻辑（昼夜反转）
  const toggleDarkMode = (event) => {
    const isCurrentlyDark = themeMode === 'dark' || themeMode === 'oled';
    const preferredDark = localStorage.getItem('preferredDarkMode') || 'dark';
    changeThemeWithAnimation(isCurrentlyDark ? 'light' : preferredDark, event);
  };

  return (
    <div id="mainApp" className="flex h-screen">
      <Sidebar
        activePage={activePage}
        onPageChange={setActivePage}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        currentTheme={themeMode}
        onToggleDarkMode={toggleDarkMode}
      />

      <main className="flex-1 overflow-hidden flex flex-col transition-colors">
        {activePage === 'home' && <HomePage onNext={() => setActivePage('download')} />}
        {activePage === 'download' && <DownloadPage onPrev={() => setActivePage('home')} onNext={() => setActivePage('calibrate')} />}
        {activePage === 'calibrate' && <CalibrationPage onPrev={() => setActivePage('download')} />}
        {activePage === 'params' && <ParamsPage />}
        {activePage === 'versions' && <VersionsPage />}
        {activePage === 'faq' && <FaqPage />}
        {activePage === 'about' && <AboutPage />}
        
        {/* 把当前的主题状态，和动画切换函数，传给设置页！ */}
        {activePage === 'setting' && (
          <SettingsPage 
            currentTheme={themeMode} 
            onChangeTheme={changeThemeWithAnimation} 
          />
        )}
      </main>
    </div>
  );
}