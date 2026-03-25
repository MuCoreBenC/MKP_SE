// src/utils/useHistoryState.js
import { useState, useCallback } from 'react';

export function useHistoryState(initialState) {
  // 历史记录堆栈
  const [history, setHistory] = useState([initialState]);
  // 当前所处的历史指针
  const [pointer, setPointer] = useState(0);

  const present = history[pointer];
  const canUndo = pointer > 0;
  const canRedo = pointer < history.length - 1;

  // 设置新值，并切断未来的时间线（保存快照）
  const setPresent = useCallback((newState) => {
    setHistory(prev => {
      // 截断当前指针之后的所有“未来”状态，并将新状态推入堆栈
      const past = prev.slice(0, pointer + 1);
      // 限制堆栈最大深度为 100，防止内存溢出（你原本设了 4000，但在 React 中完整树对比 100 足够了）
      if (past.length > 100) past.shift(); 
      return [...past, newState];
    });
    setPointer(prev => Math.min(prev + 1, 100));
  }, [pointer]);

  // 撤销 (Undo)
  const undo = useCallback(() => {
    if (canUndo) setPointer(prev => prev - 1);
  }, [canUndo]);

  // 重做 (Redo)
  const redo = useCallback(() => {
    if (canRedo) setPointer(prev => prev + 1);
  }, [canRedo]);

  // 重置时间线
  const reset = useCallback((newState) => {
    setHistory([newState]);
    setPointer(0);
  }, []);

  return { present, setPresent, undo, redo, canUndo, canRedo, reset };
}