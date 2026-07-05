'use client';

import { useEffect, useState } from 'react';
import { toggleTheme } from './ThemeProvider';

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'));
  }, []);

  function handleClick() {
    const next = toggleTheme();
    setIsDark(next === 'dark');
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      title={isDark ? '라이트 모드로 전환' : '다크 모드로 전환'}
      className="rounded-md border border-slate-200 px-2 py-1 text-xs dark:border-slate-700 dark:text-slate-300"
    >
      {isDark ? '☀️' : '🌙'}
    </button>
  );
}
