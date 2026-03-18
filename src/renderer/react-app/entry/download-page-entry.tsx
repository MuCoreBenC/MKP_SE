import React from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { DownloadPage } from '../pages/download/DownloadPage';

let reactDownloadRoot: Root | null = null;

export function mountDownloadReactPage(target: HTMLElement) {
  if (!reactDownloadRoot) {
    reactDownloadRoot = createRoot(target);
  }

  reactDownloadRoot.render(
    <React.StrictMode>
      <DownloadPage />
    </React.StrictMode>
  );
}
