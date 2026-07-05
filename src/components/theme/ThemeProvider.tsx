'use client';

import { useEffect } from 'react';

const THEME_KEY = 'nr_theme';

/**
 * 다크 모드 초기화 + localStorage 동기화.
 * SSR 시 hydration mismatch를 막기 위해 useEffect에서 적용.
 */
export function ThemeProvider() {
  useEffect(() => {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      const isDark =
        saved === 'dark' ||
        (saved == null && window.matchMedia('(prefers-color-scheme: dark)').matches);
      document.documentElement.classList.toggle('dark', isDark);
    } catch {
      // localStorage 접근 실패 무시
    }
  }, []);
  return null;
}

export function toggleTheme(): 'light' | 'dark' {
  const isDark = document.documentElement.classList.contains('dark');
  const next = isDark ? 'light' : 'dark';
  document.documentElement.classList.toggle('dark', !isDark);
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch {
    // 무시
  }
  return next;
}
