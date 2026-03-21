import { LegacyShellBridge } from '../../runtime/react-page-runtime';

export function ParamsPage({
  fallbackTarget,
  markReady
}: {
  fallbackTarget?: HTMLElement | null;
  markReady: () => void;
}) {
  return <LegacyShellBridge fallbackTarget={fallbackTarget} onReady={markReady} />;
}
