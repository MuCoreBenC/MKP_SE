// src/components/GcodeEditor.jsx
import React, { useState } from 'react';
import { MKPContextMenu } from './GlobalContextMenu';
import { getGcodeLineHint } from '../utils/paramsData';

export default function GcodeEditor({ value, onChange }) {
  const [mode, setMode] = useState('raw'); // 'raw' | 'structured'

  // 将原始文本按行切分
  const lines = String(value || '').split('\n');
  const renderLines = lines.length > 0 ? lines : [''];

  // 处理单行修改
  const handleLineChange = (index, newValue) => {
    const newLines = [...renderLines];
    newLines[index] = newValue;
    onChange(newLines.join('\n'));
  };

  // 处理右键菜单动作
  const handleContextMenu = async (e, index) => {
    e.preventDefault();
    const actions = [
      { action: 'insertAbove', label: '上方插入一行' },
      { action: 'insertBelow', label: '下方插入一行' },
      { action: 'copyLine', label: '复制这一行' },
      { action: 'deleteLine', label: '删除这一行', disabled: renderLines.length <= 1 }
    ];

    const action = await MKPContextMenu.show(e.clientX, e.clientY, actions);
    if (!action) return;

    const newLines = [...renderLines];
    if (action === 'insertAbove') {
      newLines.splice(index, 0, '');
    } else if (action === 'insertBelow') {
      newLines.splice(index + 1, 0, '');
    } else if (action === 'deleteLine') {
      newLines.splice(index, 1);
    } else if (action === 'copyLine') {
      navigator.clipboard.writeText(newLines[index]);
    }
    onChange(newLines.join('\n'));
  };

  return (
    <div className="param-row param-row-block param-row-gcode" data-param-gcode="true">
      <div className="param-row-head">
        <div className="param-row-main">
          <div className="param-field-title">宏文本编辑</div>
          <div className="param-field-sub">默认整段编辑，可切换为分行精修</div>
        </div>
        
        <div className="param-field-actions">
          <div className="gcode-mode-switch">
            <button 
              type="button" 
              className={`gcode-mode-btn ${mode === 'raw' ? 'is-active' : ''}`} 
              onClick={() => setMode('raw')}
            >整段编辑</button>
            <button 
              type="button" 
              className={`gcode-mode-btn ${mode === 'structured' ? 'is-active' : ''}`} 
              onClick={() => setMode('structured')}
            >分行编辑</button>
          </div>
        </div>
      </div>

      <div className="param-row-control param-row-control-block">
        <div className="gcode-card-shell">
          
          {/* 整段编辑模式 */}
          {mode === 'raw' && (
            <textarea 
              className="dynamic-param-input param-editable param-textarea gcode-raw-input w-full" 
              rows="10"
              value={value}
              onChange={(e) => onChange(e.target.value)}
            />
          )}

          {/* 分行精修模式 */}
          {mode === 'structured' && (
            <div className="gcode-structured-shell">
              <div className="gcode-structured-toolbar mb-2 text-xs text-gray-500">右键行号或整行可插入、复制、删除</div>
              <div className="gcode-editor flex flex-col gap-2">
                {renderLines.map((line, index) => (
                  <div 
                    key={index} 
                    className="gcode-line-row grid items-center gap-2" 
                    style={{ gridTemplateColumns: '92px minmax(0, 1fr)' }}
                    onContextMenu={(e) => handleContextMenu(e, index)}
                  >
                    <div className="gcode-line-meta flex flex-col gap-1 cursor-context-menu">
                      <span className="gcode-line-number text-[11px] font-bold text-gray-500">{index + 1}</span>
                      <span className="gcode-line-kind inline-flex items-center justify-center px-2 py-1 rounded-full text-[11px] font-semibold theme-text theme-bg-soft">
                        {getGcodeLineHint(line)}
                      </span>
                    </div>
                    <input 
                      type="text" 
                      value={line} 
                      onChange={(e) => handleLineChange(index, e.target.value)}
                      className="param-editable gcode-line-input w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-[#333] bg-white dark:bg-[#252526] text-sm focus:border-blue-500 outline-none transition-colors dark:text-gray-100" 
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}