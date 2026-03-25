import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// 严格引入你原本的 Tailwind 和自定义样式，绝不加别的！
import './renderer/assets/css/tailwind-compiled.css';
import './renderer/assets/css/style.css';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);