/**
 * Global View Mode Store
 * 
 * Controls Business vs Technical view toggle across Score Guide, 
 * Audit Detail, and Page Detail screens.
 * 
 * Persisted in localStorage.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ViewMode = 'business' | 'technical';

interface ViewModeState {
  mode: ViewMode;
  setMode: (mode: ViewMode) => void;
  toggleMode: () => void;
}

export const useViewMode = create<ViewModeState>()(
  persist(
    (set) => ({
      mode: 'business',
      setMode: (mode) => set({ mode }),
      toggleMode: () => set((state) => ({ 
        mode: state.mode === 'business' ? 'technical' : 'business' 
      })),
    }),
    {
      name: 'ov_view_mode',
    }
  )
);

