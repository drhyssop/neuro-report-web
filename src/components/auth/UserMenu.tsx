'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { lockAction, signOutAction } from '@/lib/auth/actions';

interface Props {
  displayName: string;
  role: 'user' | 'admin';
}

export function UserMenu({ displayName, role }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  // 표시명 첫 글자 (initial) — 아바타에 표시
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
        aria-label="계정 메뉴"
      >
        {initial}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-2 min-w-[180px] rounded-md border border-slate-200 bg-white py-2 shadow-md dark:border-slate-700 dark:bg-slate-800">
          {/* 헤더 — 표시명 + admin 배지 */}
          <div className="border-b border-slate-100 px-3 pb-2 text-xs dark:border-slate-700">
            <div className="flex items-center gap-1">
              <span className="font-medium text-slate-900 dark:text-slate-100">{displayName}</span>
              {role === 'admin' && (
                <span className="rounded bg-slate-900 px-1 py-0.5 text-[9px] text-white dark:bg-slate-100 dark:text-slate-900">
                  admin
                </span>
              )}
            </div>
          </div>
          {role === 'admin' && (
            <Link
              href="/admin/users"
              onClick={() => setOpen(false)}
              className="block px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              계정 관리
            </Link>
          )}
          <Link
            href="/archive"
            onClick={() => setOpen(false)}
            className="block px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700 sm:hidden"
          >
            아카이브
          </Link>
          <Link
            href="/settings/backup"
            onClick={() => setOpen(false)}
            className="block px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            백업 / 복원
          </Link>
          <form action={lockAction}>
            <button
              type="submit"
              className="w-full px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              잠금
            </button>
          </form>
          <form action={signOutAction}>
            <button
              type="submit"
              className="w-full px-3 py-1.5 text-left text-xs text-red-600 hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              로그아웃
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
