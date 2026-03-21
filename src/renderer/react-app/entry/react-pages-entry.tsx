import { ReadySignal, createReactPageMount } from '../runtime/react-page-runtime';
import { DownloadPage } from '../pages/download/DownloadPage';
import { CalibratePage } from '../pages/calibrate/CalibratePage';
import { ParamsPage } from '../pages/params/ParamsPage';
import { SettingPage } from '../pages/setting/SettingPage';

export const mountDownloadReactPage = createReactPageMount({
  pageName: 'download',
  render: ({ markReady }) => (
    <ReadySignal onReady={markReady}>
      <DownloadPage />
    </ReadySignal>
  )
});

export const mountCalibrateReactPage = createReactPageMount({
  pageName: 'calibrate',
  render: ({ markReady }) => <CalibratePage markReady={markReady} />
});

export const mountParamsReactPage = createReactPageMount({
  pageName: 'params',
  render: ({ fallbackTarget, markReady }) => (
    <ParamsPage fallbackTarget={fallbackTarget} markReady={markReady} />
  )
});

export const mountSettingReactPage = createReactPageMount({
  pageName: 'setting',
  render: ({ fallbackTarget, markReady }) => (
    <SettingPage fallbackTarget={fallbackTarget} markReady={markReady} />
  )
});

export function mountRegisteredReactPages(rootDocument: Document = document) {
  const pageMounts = [
    {
      rootId: 'react-download-page-root',
      fallbackId: 'downloadLegacyShell',
      mount: mountDownloadReactPage
    },
    {
      rootId: 'react-calibrate-page-root',
      fallbackId: 'calibrateLegacyShell',
      mount: mountCalibrateReactPage
    },
    {
      rootId: 'react-params-page-root',
      fallbackId: 'paramsLegacyShell',
      mount: mountParamsReactPage
    },
    {
      rootId: 'react-setting-page-root',
      fallbackId: 'settingLegacyShell',
      mount: mountSettingReactPage
    }
  ];

  let mountedCount = 0;
  pageMounts.forEach(({ rootId, fallbackId, mount }) => {
    const target = rootDocument.getElementById(rootId);
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const fallbackTarget = rootDocument.getElementById(fallbackId);
    mount({
      target,
      fallbackTarget: fallbackTarget instanceof HTMLElement ? fallbackTarget : null
    });
    mountedCount += 1;
  });

  return mountedCount;
}

if (typeof window !== 'undefined') {
  window.MKPReactPagesBundle = {
    mountDownloadReactPage,
    mountCalibrateReactPage,
    mountParamsReactPage,
    mountSettingReactPage,
    mountRegisteredReactPages
  };
}
