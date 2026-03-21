import React, { useLayoutEffect, useRef, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';

export type MountReactPageOptions = {
  target: HTMLElement;
  fallbackTarget?: HTMLElement | null;
};

type CreateReactPageMountOptions = {
  pageName: string;
  render: (context: {
    fallbackTarget?: HTMLElement | null;
    markReady: () => void;
  }) => ReactNode;
};

type ReactPageErrorBoundaryProps = {
  children: ReactNode;
  onError: (error: Error, info: unknown) => void;
};

type ReactPageErrorBoundaryState = {
  hasError: boolean;
};

class ReactPageErrorBoundary extends React.Component<
  ReactPageErrorBoundaryProps,
  ReactPageErrorBoundaryState
> {
  constructor(props: ReactPageErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: unknown) {
    this.props.onError(error, info);
  }

  render() {
    if (this.state.hasError) {
      return null;
    }

    return this.props.children;
  }
}

export function ReadySignal({ onReady, children }: { onReady: () => void; children: ReactNode }) {
  const readyRef = useRef(false);

  useLayoutEffect(() => {
    if (readyRef.current) {
      return;
    }

    readyRef.current = true;
    onReady();
  }, [onReady]);

  return children;
}

export function setReactPageVisibility(
  target: HTMLElement,
  fallbackTarget: HTMLElement | null | undefined,
  reactVisible: boolean
) {
  target.classList.toggle('hidden', !reactVisible);
  target.setAttribute('aria-hidden', reactVisible ? 'false' : 'true');

  if (fallbackTarget) {
    fallbackTarget.classList.toggle('hidden', reactVisible);
    fallbackTarget.setAttribute('aria-hidden', reactVisible ? 'true' : 'false');
  }
}

export function LegacyShellBridge({
  fallbackTarget,
  onReady
}: {
  fallbackTarget?: HTMLElement | null;
  onReady?: () => void;
}) {
  if (!fallbackTarget) {
    throw new Error('LegacyShellBridge requires a fallback target');
  }

  const hostRef = useRef<HTMLDivElement | null>(null);
  const adoptedNodesRef = useRef<Node[]>([]);

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    const adoptedNodes = Array.from(fallbackTarget.childNodes);
    adoptedNodesRef.current = adoptedNodes;
    adoptedNodes.forEach((node) => {
      host.appendChild(node);
    });
    onReady?.();

    return () => {
      adoptedNodesRef.current.forEach((node) => {
        fallbackTarget.appendChild(node);
      });
      adoptedNodesRef.current = [];
    };
  }, [fallbackTarget, onReady]);

  return <div ref={hostRef} className="mkp-react-page-legacy-bridge" />;
}

export function createReactPageMount({ pageName, render }: CreateReactPageMountOptions) {
  let root: Root | null = null;

  return function mountReactPage({ target, fallbackTarget }: MountReactPageOptions) {
    setReactPageVisibility(target, fallbackTarget, false);
    let hasMarkedReady = false;

    const markReady = () => {
      if (hasMarkedReady) {
        return;
      }

      hasMarkedReady = true;
      setReactPageVisibility(target, fallbackTarget, true);
    };

    if (!root) {
      root = createRoot(target);
    }

    try {
      root.render(
        <React.StrictMode>
          <ReactPageErrorBoundary
            onError={(error) => {
              console.error(`[MKP React Pages] ${pageName} page render failed`, error);
              setReactPageVisibility(target, fallbackTarget, false);
            }}
          >
            {render({ fallbackTarget, markReady })}
          </ReactPageErrorBoundary>
        </React.StrictMode>
      );

      return true;
    } catch (error) {
      console.error(`[MKP React Pages] ${pageName} page mount failed`, error);
      setReactPageVisibility(target, fallbackTarget, false);
      return false;
    }
  };
}
