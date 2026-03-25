// src/App.jsx
import React, { useState } from 'react';
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
  // 当前处于哪个页面 ('home', 'download', 'calibrate', 'params', 'versions', 'faq', 'about', 'setting')
  const [activePage, setActivePage] = useState('home');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  return (
    <div id="mainApp" className="flex h-screen">
      <Sidebar
        activePage={activePage}
        onPageChange={setActivePage}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />

      <main className="flex-1 overflow-hidden flex flex-col transition-colors">
        {/* 利用 && 短路渲染，性能极高且无切换闪烁 */}
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