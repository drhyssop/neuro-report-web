'use client';

import { cn } from '@/lib/utils/cn';

interface Props {
  value: number | null;
  yesterday?: number | null;
  onChange: (v: number) => void;
}

export function VasSlider({ value, yesterday, onChange }: Props) {
  const current = value ?? 0;
  const delta = value != null && yesterday != null ? value - yesterday : null;
  const canSameAsYesterday = yesterday != null && yesterday !== value;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium text-slate-700 dark:text-slate-200">VAS</div>
        <div className="flex items-baseline gap-2">
          <span className="text-lg font-medium text-slate-900 dark:text-slate-100">{current}</span>
          <span className="text-xs text-slate-400 dark:text-slate-500">/10</span>
          {delta != null && delta !== 0 && (
            <span
              className={cn(
                'text-[10px] font-medium',
                delta < 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400',
              )}
            >
              {delta < 0 ? `▼${Math.abs(delta)}` : `▲${delta}`} from {yesterday}
            </span>
          )}
          {delta === 0 && yesterday != null && (
            <span className="text-[10px] text-slate-400 dark:text-slate-500">= 어제</span>
          )}
        </div>
      </div>
      <input
        type="range"
        min={0}
        max={10}
        step={1}
        value={current}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        className="w-full accent-slate-900 dark:accent-slate-100"
      />
      <div className="flex items-center justify-between">
        <div className="flex justify-between text-[10px] text-slate-400 dark:text-slate-500">
          <span>0 없음 · 5 · 10 극심</span>
        </div>
        {canSameAsYesterday && (
          <button
            type="button"
            onClick={() => onChange(yesterday)}
            className="rounded-md border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
          >
            어제와 같음 ({yesterday})
          </button>
        )}
      </div>
    </div>
  );
}
