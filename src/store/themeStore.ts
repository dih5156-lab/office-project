import { create } from 'zustand';

type Theme = 'light' | 'dark';

interface ThemeState {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (t: Theme) => void;
}

const stored = (localStorage.getItem('office_theme') as Theme) || 'light';

export const useThemeStore = create<ThemeState>((set) => ({
  theme: stored,

  toggleTheme: () =>
    set((s) => {
      const next: Theme = s.theme === 'light' ? 'dark' : 'light';
      localStorage.setItem('office_theme', next);
      document.documentElement.classList.toggle('dark', next === 'dark');
      return { theme: next };
    }),

  setTheme: (t) => {
    localStorage.setItem('office_theme', t);
    document.documentElement.classList.toggle('dark', t === 'dark');
    set({ theme: t });
  },
}));

// 초기화: 저장된 테마 적용
document.documentElement.classList.toggle('dark', stored === 'dark');
