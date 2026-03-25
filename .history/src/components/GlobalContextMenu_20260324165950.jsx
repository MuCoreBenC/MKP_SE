// src/components/GlobalContextMenu.jsx
import React, { useState, useEffect, useRef } from 'react';

// 全局闭包变量
let resolvePromise = null;
let triggerRender = null;

export const MKPContextMenu = {
  show(x, y, items) {
    // 如果上一个菜单还没关，先把它静默关掉
    if (resolvePromise) {
      resolvePromise(null);
    }
    return new Promise((resolve) => {
      resolvePromise = resolve;
      if (triggerRender) {
        triggerRender({ isOpen: true, x, y, items });
      }
    });
  },
  hide() {
    if (triggerRender) triggerRender(prev => ({ ...prev, isOpen: false }));
    if (resolvePromise) {
      resolvePromise(null);
      resolvePromise = null;
    }
  }
};

export default function GlobalContextMenu() {
  const [state, setState] = useState({
    isOpen: false,
    x: 0,
    y: 0,
    items: [], // { action: '...', label: '...', disabled: false, type: 'separator' }
  });

  const menuRef = useRef(null);

  useEffect(() => {
    triggerRender = setState;
    return () => { triggerRender = null; };
  }, []);

  // 点击外部自动关闭
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (state.isOpen && menuRef.current && !menuRef.current.contains(e.target)) {
        MKPContextMenu.hide();
      }
    };
    // 监听滚轮滚动自动关闭
    const handleScroll = () => {
      if (state.isOpen) MKPContextMenu.hide();
    };

    if (state.isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('wheel', handleScroll, { passive: true });
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('wheel', handleScroll);
    };
  }, [state.isOpen]);

  const handleItemClick = (action, disabled) => {
    if (disabled) return;
    setState(prev => ({ ...prev, isOpen: false }));
    if (resolvePromise) {
      resolvePromise(action);
      resolvePromise = null;
    }
  };

  // 计算安全位置（防止菜单超出屏幕边缘）
  let safeX = state.x;
  let safeY = state.y;
  if (menuRef.current && state.isOpen) {
    const rect = menuRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    if (safeX + rect.width > viewportWidth - 10) safeX = viewportWidth - rect.width - 10;
    if (safeY + rect.height > viewportHeight - 10) safeY = viewportHeight - rect.height - 10;
  }

  return (
    <div 
      ref={menuRef}
      className={`param-context-menu fixed z-[10000] w-56 bg-white dark:bg-[#252526] rounded-xl shadow-xl border border-gray-100 dark:border-[#333] py-1.5 text-sm transform transition-all duration-150 origin-top-left flex flex-col ${state.isOpen ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none'}`}
      style={{ 
        left: `${safeX}px`, 
        top: `${safeY}px`,
        visibility: state.isOpen ? 'visible' : 'hidden' 
      }}
      onContextMenu={(e) => e.preventDefault()} // 防止在菜单里再触发右键
    >
      {state.items.map((item, index) => {
        // 渲染分割线
        if (item.type === 'separator') {
          return <div key={`sep-${index}`} className="h-px bg-gray-100 dark:bg-[#333] my-1 w-full mx-auto max-w-[90%]"></div>;
        }

        // 渲染删除按钮 (特殊红色样式)
        const isDelete = item.action === 'delete';
        const baseClass = isDelete 
          ? "w-full text-left px-4 py-2.5 hover:bg-red-50 dark:hover:bg-red-900/30 flex items-center gap-3 text-red-600 dark:text-red-400 transition-colors"
          : "w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-[#333] flex items-center gap-3 text-gray-700 dark:text-gray-200 transition-colors";
        
        const disabledClass = item.disabled ? "opacity-45 cursor-not-allowed" : "cursor-pointer";

        return (
          <button
            key={`${item.action}-${index}`}
            onClick={() => handleItemClick(item.action, item.disabled)}
            className={`${baseClass} ${disabledClass}`}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}