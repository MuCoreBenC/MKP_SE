import React, { useState, useEffect, useMemo } from 'react';
import { Icon } from '../components/Icons';
import { MKPModal } from '../components/GlobalModal';

// 网格常量定义
const Z_OFFSETS = [-0.5, -0.4, -0.3, -0.2, -0.1, 0, 0.1, 0.2, 0.3, 0.4, 0.5];
const XY_OFFSETS = [-1.0, -0.8, -0.6, -0.4, -0.2, 0, 0.2, 0.4, 0.6, 0.8, 1.0];

export default function CalibrationPage({ onPrev }) {
  // ==========================================
  // 1. 核心状态 (State)
  // ==========================================
  // 模拟从当前应用的 JSON 预设中读取到的真实偏移值
  const [currentOffsets, setCurrentOffsets] = useState({ x: 0, y: 0, z: -0.2 });
  const [hasActivePreset, setHasActivePreset] = useState(true);

  // 用户在网格上点击选中的偏移补偿值
  const [selectedZ, setSelectedZ] = useState(null);
  const [selectedXY, setSelectedXY] = useState({ x: 0, y: 0 });

  // UI 面板状态 (默认隐藏网格，展示 placeholder)
  const [isZGridOpen, setIsZGridOpen] = useState(false);
  const [isXYGridOpen, setIsXYGridOpen] = useState(false);

  // ==========================================
  // 2. 派生数据 (Derived State：无需手动操作 DOM，全自动计算)
  // ==========================================
  const newZ = selectedZ !== null ? (currentOffsets.z + selectedZ).toFixed(2) : '--';
  const newX = (currentOffsets.x + selectedXY.x).toFixed(2);
  const newY = (currentOffsets.y + selectedXY.y).toFixed(2);

  const scriptPath = hasActivePreset 
    ? `"C:\\Program Files\\MKP\\mkp.exe" --Json "C:\\UserData\\a1_standard_v3.json" --Gcode` 
    : '请先选择机型和版本';

  // ==========================================
  // 3. 业务交互动作 (Actions)
  // ==========================================
  const handleCopyScript = () => {
    navigator.clipboard.writeText(scriptPath);
    // 实际项目中可以调用你的 btn-q-bounce 或者直接弹窗
    MKPModal.alert({ title: '复制成功', msg: '后处理脚本路径已复制！', type: 'success' });
  };

  const handleSaveZ = async () => {
    if (selectedZ === null) return;
    const confirm = await MKPModal.confirm({
      title: '保存 Z 轴偏移',
      msg: `确定将预设 Z 轴偏移修改为 <span class="font-bold text-blue-500">${newZ}mm</span> 吗？`,
      type: 'warning'
    });

    if (confirm) {
      // 模拟写入...
      setCurrentOffsets(prev => ({ ...prev, z: parseFloat(newZ) }));
      setSelectedZ(null);
      MKPModal.alert({ title: '保存成功', msg: 'Z 轴偏移已更新！', type: 'success' });
    }
  };

  const handleSaveXY = async () => {
    if (selectedXY.x === 0 && selectedXY.y === 0) {
      MKPModal.alert({ title: '提示', msg: '偏移量没有任何变化。', type: 'info' });
      return;
    }
    
    const confirm = await MKPModal.confirm({
      title: '保存 XY 轴偏移',
      msg: `X 将变为 <b>${newX}</b>，Y 将变为 <b>${newY}</b>，确定保存吗？`,
      type: 'warning'
    });

    if (confirm) {
      // 模拟写入...
      setCurrentOffsets(prev => ({ ...prev, x: parseFloat(newX), y: parseFloat(newY) }));
      setSelectedXY({ x: 0, y: 0 });
      MKPModal.alert({ title: '保存成功', msg: 'XY 轴偏移已更新！', type: 'success' });
    }
  };

  const handleOpen3mf = async (axis) => {
    // 伪装加载动画
    MKPModal.alert({ title: '正在下发切片', msg: '已成功拉起切片软件并加载测试模型！', type: 'success' });
    if (axis === 'Z') setIsZGridOpen(true);
    if (axis === 'XY') setIsXYGridOpen(true);
  };

  // ==========================================
  // 4. 视图渲染 (View)
  // ==========================================
  return (
    <div id="page-calibrate" className="page flex-1" data-fixed-header="true">
      <div className="page-header w-full">
        <div className="page-header-top">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">校准偏移</h1>
          <div className="flex items-center gap-3">
            <button onClick={onPrev} className="btn-secondary px-6 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 transition-all">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 17l-5-5m0 0l5-5m-5 5h12"/></svg>
              <span>上一步</span>
            </button>
          </div>
        </div>
        <div className="page-header-sub"></div>
      </div>

      <div className="page-content hide-scrollbar pb-12">
        <div className="max-w-4xl">
          
          {/* --- 脚本路径复制区 --- */}
          <div className="bg-white dark:bg-[#252526] rounded-xl card-shadow border border-transparent dark:border-[#333] p-5 mb-5 transition-colors">
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">脚本路径：主页-&gt;其他-&gt;后处理脚本</div>
            <div className="flex items-center gap-2">
              <input type="text" className="input-field input-readonly flex-1 px-4 py-2.5 rounded-lg text-sm font-mono text-gray-500" readOnly value={scriptPath} />
              <button onClick={handleCopyScript} className="theme-btn-soft h-9 min-w-[36px] px-2 rounded-lg flex items-center justify-center transition-all">
                <Icon name="setting" className="w-4 h-4" /> {/* 替换成复制图标 */}
              </button>
            </div>
          </div>

          {/* --- Z轴偏移校准 --- */}
          <div className="bg-white dark:bg-[#252526] rounded-xl card-shadow border border-transparent dark:border-[#333] p-5 mb-5 transition-colors">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                <Icon name="setting" className="w-5 h-5 theme-text" /> Z轴偏移校准
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => setIsZGridOpen(true)} className="bg-white dark:bg-[#252526] border border-gray-200 dark:border-[#444] text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-[#2A2A2A] transition-all shadow-sm">
                  直接修改
                </button>
                <button onClick={() => handleOpen3mf('Z')} className="theme-btn-solid px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all">
                  <Icon name="calibrate" className="w-4 h-4" />
                  <span>打开校准模型</span>
                </button>
              </div>
            </div>
            
            {!isZGridOpen ? (
              <div className="py-8 bg-gray-50 dark:bg-[#1E1E1E] rounded-xl border border-dashed border-gray-200 dark:border-[#444] flex flex-col items-center justify-center">
                <Icon name="info" className="w-10 h-10 text-gray-400 mb-2" />
                <div className="text-2xl font-black theme-text mb-3">
                  当前Z偏移：<span>{currentOffsets.z.toFixed(2)}</span>
                </div>
                <span className="text-sm text-gray-400">点击右上方直接修改或打开测试模型</span>
              </div>
            ) : (
              <div className="animate-scale-in">
                {/* 核心魔法：Z轴网格渲染。取代了几十行的 DOM 拼接！ */}
                <div className="flex gap-2 justify-between items-end overflow-x-auto py-4">
                  {Z_OFFSETS.map(offset => {
                    const isSelected = selectedZ === offset;
                    const isZero = offset === 0;
                    const displayText = offset > 0 ? `+${offset}` : offset;
                    
                    return (
                      <button 
                        key={offset}
                        onClick={() => setSelectedZ(offset)}
                        className="z-block-item flex flex-col items-center justify-end gap-1 outline-none group cursor-pointer h-[140px] w-10 shrink-0"
                      >
                        <div className={`w-full transition-all duration-200 rounded-lg border-2 shadow-sm relative flex items-center justify-center ${
                            isZero ? 'bg-[#C0C0C0] dark:bg-[#555] h-[40px]' : 'bg-[#D9D9D9] dark:bg-[#444] h-[30px]'
                          } ${
                            isSelected ? 'border-current theme-text scale-110' : 'border-transparent group-hover:border-gray-400'
                          }`}
                        >
                          {isZero && <div className="w-2 h-2 rounded-full bg-gray-500 dark:bg-gray-400"></div>}
                        </div>
                        <div className="h-[24px] flex items-start justify-center mt-2">
                          <span className={`font-mono tabular-nums transition-colors ${isZero ? 'text-2xl font-black' : 'text-sm font-medium'} ${isSelected ? 'theme-text' : 'text-gray-500 dark:text-gray-400 group-hover:text-gray-900'}`}>
                            {displayText}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
                
                {/* 动态计算结果条 */}
                <div className="mt-6 p-4 rounded-xl bg-gray-50 dark:bg-[#1E1E1E] flex items-center justify-between border border-gray-100 dark:border-[#333]">
                  <div className="flex items-center gap-6">
                    <div>
                      <div className="text-xs text-gray-500 mb-1">当前值 (原预设)</div>
                      <div className="text-xl font-mono text-gray-700 dark:text-gray-300">{currentOffsets.z.toFixed(2)}</div>
                    </div>
                    <div className="text-2xl text-gray-300 font-light">+</div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">补偿量 (网格选中)</div>
                      <div className={`text-xl font-mono font-bold ${selectedZ !== null ? 'theme-text' : 'text-gray-400'}`}>
                        {selectedZ !== null ? (selectedZ > 0 ? `+${selectedZ}` : selectedZ) : '--'}
                      </div>
                    </div>
                    <div className="text-2xl text-gray-300 font-light">=</div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">将写入的新预设值</div>
                      <div className="text-3xl font-mono font-black theme-text">{newZ}</div>
                    </div>
                  </div>
                  <button 
                    onClick={handleSaveZ}
                    disabled={selectedZ === null} 
                    className="theme-btn-solid px-6 py-3 rounded-xl font-bold shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
                  >
                    写入新 Z 偏移
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* --- XY轴偏移校准 --- */}
          <div className="bg-white dark:bg-[#252526] rounded-xl card-shadow border border-transparent dark:border-[#333] p-5 transition-colors">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                <Icon name="setting" className="w-5 h-5 theme-text" /> XY轴偏移校准
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => setIsXYGridOpen(true)} className="bg-white dark:bg-[#252526] border border-gray-200 dark:border-[#444] text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-[#2A2A2A] transition-all shadow-sm">
                  直接修改
                </button>
                <button onClick={() => handleOpen3mf('XY')} className="theme-btn-solid px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all">
                  <Icon name="calibrate" className="w-4 h-4" />
                  <span>打开校准模型</span>
                </button>
              </div>
            </div>

            {!isXYGridOpen ? (
              <div className="h-48 bg-gray-50 dark:bg-[#1E1E1E] rounded-xl border border-dashed border-gray-200 dark:border-[#444] flex flex-col items-center justify-center">
                <Icon name="info" className="w-10 h-10 text-gray-400 mb-2" />
                <div className="text-xl font-black theme-text mb-3 text-center">
                  当前XY偏移：X <span>{currentOffsets.x.toFixed(2)}</span> / Y <span>{currentOffsets.y.toFixed(2)}</span>
                </div>
                <span className="text-sm text-gray-400">点击右上方直接修改或打开测试模型</span>
              </div>
            ) : (
              <div className="animate-scale-in">
                {/* XY 网格区：用最精简的代码重现十字架坐标系！ */}
                <div className="flex items-center justify-center py-6">
                  
                  {/* Y 轴控制 (纵向) */}
                  <div className="flex flex-col-reverse justify-between gap-1 mr-6 border-r-2 border-gray-100 dark:border-[#333] pr-4">
                    {XY_OFFSETS.map(offset => {
                      const isSelected = selectedXY.y === offset;
                      const label = offset > 0 ? `+${offset.toFixed(1)}` : offset.toFixed(1);
                      return (
                        <button key={`y-${offset}`} onClick={() => setSelectedXY(p => ({ ...p, y: offset }))} className="flex items-center justify-end gap-2 group outline-none">
                          <span className={`text-xs font-mono w-8 text-right ${isSelected ? 'theme-text font-bold' : 'text-gray-400 group-hover:text-gray-600'}`}>{label}</span>
                          <div className={`w-8 h-4 rounded border-2 transition-all ${isSelected ? 'border-current theme-text bg-blue-50/50' : 'border-transparent bg-[#D9D9D9] dark:bg-[#444] group-hover:bg-gray-400'}`}></div>
                        </button>
                      );
                    })}
                    <div className="text-xs font-bold text-gray-400 text-right w-full mb-1">Y 轴 (前后)</div>
                  </div>

                  {/* X 轴控制 (横向) */}
                  <div className="flex flex-col">
                    <div className="text-xs font-bold text-gray-400 mb-2 ml-1">X 轴 (左右)</div>
                    <div className="flex items-end gap-1 border-b-2 border-gray-100 dark:border-[#333] pb-4">
                      {XY_OFFSETS.map(offset => {
                        const isSelected = selectedXY.x === offset;
                        const label = offset > 0 ? `+${offset.toFixed(1)}` : offset.toFixed(1);
                        return (
                          <button key={`x-${offset}`} onClick={() => setSelectedXY(p => ({ ...p, x: offset }))} className="flex flex-col items-center justify-end gap-2 group outline-none w-6">
                            <div className={`w-4 h-8 rounded border-2 transition-all ${isSelected ? 'border-current theme-text bg-blue-50/50' : 'border-transparent bg-[#D9D9D9] dark:bg-[#444] group-hover:bg-gray-400'}`}></div>
                            <span className={`text-[10px] font-mono ${isSelected ? 'theme-text font-bold' : 'text-gray-400 group-hover:text-gray-600'}`}>{label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  
                </div>

                {/* 动态计算结果条 */}
                <div className="mt-4 p-4 rounded-xl bg-gray-50 dark:bg-[#1E1E1E] flex flex-col sm:flex-row items-center justify-between border border-gray-100 dark:border-[#333] gap-4">
                  <div className="grid grid-cols-2 gap-x-8 gap-y-2">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold bg-gray-200 dark:bg-[#333] text-gray-600 dark:text-gray-300 px-2 py-1 rounded">原 X</span>
                      <span className="font-mono text-gray-500">{currentOffsets.x.toFixed(2)}</span>
                      <span className="text-gray-400">+</span>
                      <span className={`font-mono font-bold ${selectedXY.x !== 0 ? 'theme-text' : 'text-gray-400'}`}>{selectedXY.x > 0 ? `+${selectedXY.x}` : selectedXY.x}</span>
                      <span className="text-gray-400">=</span>
                      <span className="font-mono font-black theme-text text-lg">{newX}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold bg-gray-200 dark:bg-[#333] text-gray-600 dark:text-gray-300 px-2 py-1 rounded">原 Y</span>
                      <span className="font-mono text-gray-500">{currentOffsets.y.toFixed(2)}</span>
                      <span className="text-gray-400">+</span>
                      <span className={`font-mono font-bold ${selectedXY.y !== 0 ? 'theme-text' : 'text-gray-400'}`}>{selectedXY.y > 0 ? `+${selectedXY.y}` : selectedXY.y}</span>
                      <span className="text-gray-400">=</span>
                      <span className="font-mono font-black theme-text text-lg">{newY}</span>
                    </div>
                  </div>
                  <button 
                    onClick={handleSaveXY}
                    disabled={selectedXY.x === 0 && selectedXY.y === 0} 
                    className="theme-btn-solid px-6 py-3 rounded-xl font-bold shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 whitespace-nowrap"
                  >
                    写入新 XY 偏移
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}