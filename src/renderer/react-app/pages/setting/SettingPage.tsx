import { LegacyShellBridge } from '../../runtime/react-page-runtime';

export function SettingPage({
  fallbackTarget,
  markReady
}: {
  fallbackTarget?: HTMLElement | null;
  markReady: () => void;
}) {
  return <LegacyShellBridge fallbackTarget={fallbackTarget} onReady={markReady} />;
}
