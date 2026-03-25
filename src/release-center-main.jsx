import React from 'react';
import ReactDOM from 'react-dom/client';
import ReleasePage from './pages/ReleasePage';
import GlobalModal from './components/GlobalModal';

import './renderer/assets/css/tailwind-compiled.css';
import './renderer/assets/css/style.css';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <div className="h-screen">
      <ReleasePage />
      <GlobalModal />
    </div>
  </React.StrictMode>,
);
