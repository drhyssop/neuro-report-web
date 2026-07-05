'use client';

import { useState, type ReactNode } from 'react';

interface Props {
  title: string;
  children: ReactNode;
  /** 접기 가능 여부. false면 항상 펼침 (일반 Section처럼 동작) */
  collapsible?: boolean;
  /**
   * 정상(intact) 상태인지. true면 기본적으로 접힌 상태로 시작하고
   * 헤더에 요약(intact)을 보여준다.
   */
  isNormal?: boolean;
  /** 접혔을 때 헤더 옆에 보여줄 요약 텍스트 (예: 'intact', 'Rt LE 4/5') */
  summary?: string;
  /** 강제로 펼침 시작 여부 (isNormal=false면 자동 펼침) */
  defaultOpen?: boolean;
}

/**
 * 접을 수 있는 섹션.
 * - collapsible=false → 항상 펼친 일반 섹션
 * - collapsible=true + isNormal=true → 접힌 상태로 시작, 헤더에 'intact' 표시
 * - collapsible=true + isNormal=false → 펼친 상태로 시작 (비정상이라 봐야 함)
 */
export function CollapsibleSection({
  title,
  children,
  collapsible = false,
  isNormal = false,
  summary,
  defaultOpen,
}: Props) {
  const initialOpen = defaultOpen ?? (collapsible ? !isNormal : true);
  const [open, setOpen] = useState(initialOpen);

  if (!collapsible) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-3 text-sm font-medium text-slate-700 dark:text-slate-200">{title}</div>
        {children}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 p-4 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
          <span className="text-slate-400 dark:text-slate-500">{open ? '▼' : '▶'}</span>
          {title}
        </span>
        {!open && summary && (
          <span
            className={
              isNormal
                ? 'truncate text-xs text-emerald-600 dark:text-emerald-400'
                : 'truncate text-xs text-amber-600 dark:text-amber-400'
            }
          >
            {summary}
          </span>
        )}
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}
