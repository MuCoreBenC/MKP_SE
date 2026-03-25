// src/components/GlobalModal.jsx
import React, { useState, useEffect, useRef } from 'react';

// 💡 1. 独立于 React 生命周期的“闭包变量”，用于保存 Promise 的 resolve 函数和触发器
let resolvePromise = null;
let triggerRender = null;

// 💡 2. 导出原汁原味的 MKPModal 对象，用法和以前 100% 一样！
export const MKPModal = {
  show(options = {}) {
    return new Promise((resolve) => {
      resolvePromise = resolve;
      if (triggerRender) {
        triggerRender({ isOpen: true, mode: 'alert', type: 'info', ...options });
      }
    });
  },
  alert(options) { return this.show({ ...options, mode: 'alert' }); },
  confirm(options) { return this.show({ ...options, mode: 'confirm' }); },
  prompt(options) { return this.show({ ...options, mode: 'prompt' }); },
  hide() {
    if (triggerRender) triggerRender(prev => ({ ...prev, isOpen: false }));
    if (resolvePromise) {
      resolvePromise(null);
      resolvePromise = null;
    }
  }
};

// 兼容全局调用
window.MKPModal = MKPModal;

// 💡 3. 负责渲染界面的 React 组件
export default function GlobalModal() {
  const [state, setState] = useState({
    isOpen: false,
    mode: 'alert', // alert | confirm | prompt
    type: 'info', // info | success | warning | error
    title: '提示',
    msg: '',
    value: '',
    placeholder: '请输入内容',
    confirmText: '确定',
    cancelText: '取消',
    allowOutsideClick: false,
  });

  const inputRef = useRef(null);

  // 组件挂载时，把 setState 的控制权交出去
  useEffect(() => {
    triggerRender = setState;
    return () => { triggerRender = null; };
  }, []);

  // 监听 prompt 模式下的自动聚焦
  useEffect(() => {
    if (state.isOpen && state.mode === 'prompt' && inputRef.current) {
      setTimeout(() => {
        inputRef.current.focus();
        inputRef.current.select();
      }, 100);
    }
  }, [state.isOpen, state.mode]);

  // 处理关闭与完成
  const finish = (val) => {
    setState(prev => ({ ...prev, isOpen: false }));
    setTimeout(() => {
      if (resolvePromise) {
        resolvePromise(val);
        resolvePromise = null;
      }
    }, 200); // 留出 200ms 让退场动画播完
  };

  const handleCancel = () => finish(state.mode === 'prompt' ? null : false);
  const handleConfirm = () => finish(state.mode === 'prompt' ? state.value : true);

  // 监听键盘事件 (Enter 和 Escape)
  useEffect(() => {
    const onKeyDown = (e) => {
      if (!state.isOpen) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        handleCancel();
      } else if (e.key === 'Enter' && state.mode === 'prompt') {
        e.preventDefault();
        handleConfirm();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [state.isOpen, state.mode, state.value]);

  // =============== 样式与图标映射 ===============
  let iconBoxClass = "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ";
  let iconSvg = null;
  let confirmBtnStyle = {};

  if (state.type === 'error') {
    iconBoxClass += "bg-red-50 dark:bg-red-900/20";
    iconSvg = <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>;
    confirmBtnStyle = { backgroundColor: '#ef4444', color: '#ffffff' };
  } else if (state.type === 'success') {
    iconBoxClass += "bg-green-50 dark:bg-green-900/20";
    iconSvg = <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>;
    confirmBtnStyle = { backgroundColor: '#16a34a', color: '#ffffff' };
  } else if (state.type === 'warning') {
    iconBoxClass += "bg-amber-50 dark:bg-amber-900/20";
    iconSvg = <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v3.75m0 3.75h.01M10.29 3.86l-7.5 13A1.5 1.5 0 004.08 19.5h15.84a1.5 1.5 0 001.3-2.24l-7.5-13a1.5 1.5 0 00-2.6 0z"/></svg>;
    confirmBtnStyle = { backgroundColor: '#f59e0b', color: '#ffffff' };
  } else {
    iconBoxClass += "theme-bg-soft";
    iconSvg = <svg className="w-5 h-5 theme-text" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>;
  }

  return (
    <div 
      id="mkp-global-modal" 
      className={`fixed inset-0 z-[9999] flex items-center justify-center px-4 transition-all duration-300 ${state.isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
    >
      <div 
        className="absolute inset-0 bg-black/50 dark:bg-[#000000] dark:bg-opacity-70 transition-opacity duration-300"
        onMouseDown={(e) => {
          if (state.allowOutsideClick) handleCancel();
        }}
      ></div>
      
      <div 
        id="mkp-modal-card"
        className={`relative bg-white dark:bg-[#252526] w-full max-w-sm rounded-2xl shadow-2xl transform transition-transform duration-300 p-6 flex flex-col gap-6 ${state.isOpen ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'}`}
      >
        <div className="flex items-start gap-4">
          <div className={iconBoxClass}>
            {iconSvg}
          </div>
          <div className="flex-1 mt-0.5 min-w-0">
            <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">{state.title}</h3>
            {/* 完美渲染 HTML 内容（支持你传进来的带颜色的 span 等） */}
            <div 
              className="mt-2 text-sm text-gray-500 dark:text-gray-400 leading-relaxed break-words"
              dangerouslySetInnerHTML={{ __html: state.msg.includes('fetch failed') ? '无法连接到云端服务器，请检查网络连接或代理设置。' : state.msg }}
            ></div>
            
            {state.mode === 'prompt' && (
              <input 
                ref={inputRef}
                type="text" 
                placeholder={state.placeholder}
                value={state.value}
                onChange={(e) => setState(prev => ({ ...prev, value: e.target.value }))}
                className="w-full mt-4 px-3 py-2 rounded-lg text-sm bg-gray-50 dark:bg-[#1e1e1e] border border-gray-200 dark:border-[#444] focus:outline-none focus:border-blue-500 theme-ring transition-colors text-gray-900 dark:text-gray-100"
              />
            )}
          </div>
        </div>
        
        <div className="flex justify-end gap-3 mt-2">
          {state.mode !== 'alert' && (
            <button 
              onClick={handleCancel} 
              className="mkp-modal-btn mkp-modal-btn-cancel px-4 py-2 rounded-xl text-sm font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 dark:bg-[#2a2a2a] dark:text-gray-300 dark:hover:bg-[#333] transition-colors"
            >
              {state.cancelText}
            </button>
          )}
          <button 
            onClick={handleConfirm} 
            className="mkp-modal-btn mkp-modal-btn-confirm px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-sm active:scale-95 text-white theme-btn-solid"
            style={confirmBtnStyle}
          >
            {state.mode === 'prompt' && state.confirmText === '确定' ? '保存' : state.confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}