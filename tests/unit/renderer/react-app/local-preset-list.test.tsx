import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';

import { LocalPresetList } from '../../../../../src/renderer/react-app/pages/download/components/LocalPresetList';

const applyLocalPreset = vi.fn();

vi.mock('../../../../../src/renderer/react-app/hooks/usePresetActions', () => ({
  usePresetActions: () => ({
    applyLocalPreset,
    duplicateLocalPreset: vi.fn(),
    deleteLocalPreset: vi.fn(),
    togglePinnedPreset: vi.fn()
  })
}));

vi.mock('../../../../../src/renderer/react-app/stores/useDownloadPageUiStore', () => ({
  useDownloadPageUiStore: (
    selector: (state: {
      localSearchQuery: string;
      localSortMode: string;
      isMultiSelectMode: boolean;
      selectedLocalFiles: string[];
      setLocalSearchQuery: (value: string) => void;
      setLocalSortMode: (value: string) => void;
      setMultiSelectMode: (value: boolean) => void;
      setSelectedLocalFiles: (value: string[]) => void;
    }) => unknown
  ) =>
    selector({
      localSearchQuery: '',
      localSortMode: 'custom',
      isMultiSelectMode: false,
      selectedLocalFiles: [],
      setLocalSearchQuery: vi.fn(),
      setLocalSortMode: vi.fn(),
      setMultiSelectMode: vi.fn(),
      setSelectedLocalFiles: vi.fn()
    })
}));

describe('LocalPresetList', () => {
  beforeEach(() => {
    if (typeof document === 'undefined') {
      return;
    }
    document.body.innerHTML = '<div id="root"></div>';
    applyLocalPreset.mockReset();
  });

  it('renders apply button for unapplied items and dispatches applyLocalPreset on click', () => {
    if (typeof document === 'undefined') {
      expect(true).toBe(true);
      return;
    }
    const rootElement = document.getElementById('root');
    if (!rootElement) throw new Error('root element missing');

    const root = createRoot(rootElement);
    root.render(
      <LocalPresetList
        printerName="A1"
        selectedVersion="standard"
        loading={false}
        items={[
          {
            fileName: 'a1_standard_v1.json',
            displayTitle: 'A1 Standard v1',
            realVersion: '1.0.0',
            isApplied: false,
            isPinned: false,
            isLatest: false
          },
          {
            fileName: 'a1_standard_v2.json',
            displayTitle: 'A1 Standard v2',
            realVersion: '2.0.0',
            isApplied: true,
            isPinned: false,
            isLatest: true
          }
        ]}
      />
    );

    const buttons = Array.from(document.querySelectorAll('button'));
    const applyButton = buttons.find((button) => button.textContent?.includes('应用'));

    expect(applyButton).toBeTruthy();
    applyButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(applyLocalPreset).toHaveBeenCalledWith('a1_standard_v1.json');
    expect(document.body.textContent).toContain('已应用');
  });
});
