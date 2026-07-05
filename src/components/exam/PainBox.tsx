'use client';

import { cn } from '@/lib/utils/cn';

/**
 * Pain 입력 박스 — 박스 1개 (Nuchal pain, Back pain, Radicular pain 등).
 *   - 활성 토글 (checkbox)
 *   - VAS 드롭다운 (1~9, 미선택 시 "통증 없음" 의미)
 *   - main 체크박스 (둘 중 하나만 선택)
 *   - extra: Radicular pain의 경우 통증/저림 quality 체크
 */
interface Props {
  title: string;
  active: boolean;
  onActiveChange: (v: boolean) => void;
  vas: number | null;
  onVasChange: (v: number | null) => void;
  isMain: boolean;
  onMainChange: (next: boolean) => void;
  extra?: React.ReactNode;
}

export function PainBox({
  title,
  active,
  onActiveChange,
  vas,
  onVasChange,
  isMain,
  onMainChange,
  extra,
}: Props) {
  return (
    <div
      className={cn(
        'rounded-md border p-3 transition',
        active
          ? 'border-slate-400 bg-slate-50 dark:border-slate-500 dark:bg-slate-800'
          : 'border-slate-200 dark:border-slate-700',
      )}
    >
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm font-medium dark:text-slate-200">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => onActiveChange(e.target.checked)}
          />
          {title}
        </label>

        {active && (
          <>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-slate-500 dark:text-slate-400">VAS</span>
              <select
                value={vas ?? ''}
                onChange={(e) =>
                  onVasChange(e.target.value ? parseInt(e.target.value) : null)
                }
                className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
              >
                <option value="">선택…</option>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>

            <label className="flex items-center gap-1.5 text-xs dark:text-slate-300">
              <input
                type="checkbox"
                checked={isMain}
                onChange={(e) => onMainChange(e.target.checked)}
              />
              <span className="font-medium">main</span>
            </label>
          </>
        )}
      </div>

      {active && extra && <div className="mt-2">{extra}</div>}
    </div>
  );
}
