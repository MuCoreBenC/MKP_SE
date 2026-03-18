import { create } from 'zustand';

type DownloadPageUiState = {
  localSearchQuery: string;
  localSortMode: 'custom' | 'version-desc' | 'updated-desc' | 'name-asc';
  isMultiSelectMode: boolean;
  selectedLocalFiles: string[];
  newlyDownloadedFile: string | null;
  setLocalSearchQuery: (value: string) => void;
  setLocalSortMode: (value: DownloadPageUiState['localSortMode']) => void;
  setMultiSelectMode: (value: boolean) => void;
  setSelectedLocalFiles: (value: string[]) => void;
  setNewlyDownloadedFile: (value: string | null) => void;
  resetTransientState: () => void;
};

export const useDownloadPageUiStore = create<DownloadPageUiState>((set) => ({
  localSearchQuery: '',
  localSortMode: 'custom',
  isMultiSelectMode: false,
  selectedLocalFiles: [],
  newlyDownloadedFile: null,
  setLocalSearchQuery: (value) => set({ localSearchQuery: value }),
  setLocalSortMode: (value) => set({ localSortMode: value }),
  setMultiSelectMode: (value) => set({ isMultiSelectMode: value }),
  setSelectedLocalFiles: (value) => set({ selectedLocalFiles: value }),
  setNewlyDownloadedFile: (value) => set({ newlyDownloadedFile: value }),
  resetTransientState: () => set({
    localSearchQuery: '',
    isMultiSelectMode: false,
    selectedLocalFiles: [],
    newlyDownloadedFile: null
  })
}));
