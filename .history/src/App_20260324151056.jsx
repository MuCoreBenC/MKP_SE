import React, { useState } from 'react';
import Sidebar from './components/layout/Sidebar';
import HomePage from './pages/HomePage';

export default function App() {
  // 核心路由状态：控制当前显示哪个页面
  const [activePage, setActivePage] = useState('home');
  // 侧边栏折叠状态
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // （这里的数据以后可以从 store 或 context 里取，现在先写死）
  const brandName = 'Bambu Lab';
  const modelName = 'A1';
  const versionBadge = '未选择';

  return (
    <div id="mainApp" className="flex h-screen">
      
      {/* 挂载我们刚刚写好的侧边栏 */}
      <Sidebar
        activePage={activePage}
        onPageChange={setActivePage}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        brandName={brandName}
        modelName={modelName}
        versionBadge={versionBadge}
        onToggleDarkMode={() => document.documentElement.classList.toggle('dark')}
      />

      {/* 主内容区域 */}
      <main className="flex-1 overflow-hidden flex flex-col transition-colors">
        {/* 根据 activePage 的值，决定渲染哪个页面组件 */}
        {activePage === 'home' && (
          <HomePage onNext={() => setActivePage('download')} />
        )}
        
        {activePage === 'download' && (
          <div className="p-8 theme-text">【下载预设】页面开发中...</div>
        )}
        
        {activePage === 'calibrate' && (
          <div className="p-8 theme-text">【校准偏移】页面开发中...</div>
        )}
        
        {/* 其他页面同理... */}
      </main>
    </div>
  );
}