import { create } from 'zustand';
import api from '../services/api';

export const useModeStore = create((set, get) => ({
  mode: localStorage.getItem('fleetos_mode') || 'demo', // 'demo' | 'real'
  isDemo: (localStorage.getItem('fleetos_mode') || 'demo') === 'demo',
  isToggling: false,

  setMode: (newMode) => {
    localStorage.setItem('fleetos_mode', newMode);
    set({ mode: newMode, isDemo: newMode === 'demo' });
    window.dispatchEvent(new CustomEvent('fleetos:mode-change', { detail: { mode: newMode } }));
  },

  toggleMode: async () => {
    const current = get().mode;
    const next = current === 'demo' ? 'real' : 'demo';
    set({ isToggling: true });

    try {
      if (next === 'demo') {
        await api.post('/tracking/simulation/start').catch(() => {});
      } else {
        await api.post('/tracking/simulation/stop').catch(() => {});
      }
    } catch {
      // non-critical if offline
    } finally {
      localStorage.setItem('fleetos_mode', next);
      set({ mode: next, isDemo: next === 'demo', isToggling: false });
      window.dispatchEvent(new CustomEvent('fleetos:mode-change', { detail: { mode: next } }));
    }
  },
}));
