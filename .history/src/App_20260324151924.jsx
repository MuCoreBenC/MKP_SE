// src/App.jsx
import React, { useState } from 'react';
import Sidebar from './components/layout/Sidebar';
import HomePage from './pages/HomePage';
import DownloadPage from './pages/DownloadPage';
import CalibrationPage from './pages/CalibrationPage';

export default function App() {
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
        {activePage === 'home' && (
          <HomePage onNext={() => setActivePage('download')} />
        )}
        
        {activePage === 'download' && (
          <DownloadPage 
            onPrev={() => setActivePage('home')} 
            onNext={() => setActivePage('calibrate')} 
          />
        )}
        
        {activePage === 'calibrate' && (
          <CalibrationPage 
            onPrev={() => setActivePage('download')} 
          />
        )}
      </main>
    </div>
  );
}