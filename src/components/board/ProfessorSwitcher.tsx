'use client';

import { useTransition } from 'react';
import { selectProfessorAction } from '@/lib/actions/professor';

interface Professor {
  initial: string;
  name?: string | null;
}

/**
 * 교수님 전환 바 — 보드/m-view/회진문서 상단.
 * 'ALL' = 전체 보드 (모든 교수님 환자).
 */
export function ProfessorSwitcher({
  professors,
  selected,
}: {
  professors: Professor[];
  selected: string | null;
}) {
  const [isPending, startTransition] = useTransition();

  function pick(v: string) {
    startTransition(async () => {
      await selectProfessorAction(v);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className="mr-1 text-[11px] text-slate-400 dark:text-slate-500">교수</span>
      {professors.map((p) => (
        <button
          key={p.initial}
          type="button"
          onClick={() => pick(p.initial)}
          disabled={isPending}
          title={p.name ?? undefined}
          className={
            selected === p.initial
              ? 'rounded-md bg-slate-900 px-2.5 py-1 text-xs font-bold text-white dark:bg-slate-100 dark:text-slate-900'
              : 'rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800'
          }
        >
          {p.initial}
        </button>
      ))}
      <button
        type="button"
        onClick={() => pick('ALL')}
        disabled={isPending}
        className={
          selected === 'ALL'
            ? 'rounded-md bg-blue-600 px-2.5 py-1 text-xs font-bold text-white'
            : 'rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800'
        }
      >
        전체
      </button>
    </div>
  );
}
