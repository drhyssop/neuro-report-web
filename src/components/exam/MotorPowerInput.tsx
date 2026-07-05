'use client';

import { cn } from '@/lib/utils/cn';
import type { MotorGrade } from '@/types/domain';

interface Props {
  value: MotorGrade;
  yesterday?: MotorGrade;
  onChange: (v: MotorGrade) => void;
  compact?: boolean;
}

/**
 * MRC 0-5 버튼 그룹.
 * - 어제 값과 다르면 호전(▲)/악화(▼) 표시
 * - 클릭으로 0-5 선택, 한 번 더 클릭하면 해제(null)
 */
export function MotorPowerInput({ value, yesterday, onChange, compact = false }: Props) {
  const delta = value != null && yesterday != null ? value - yesterday : null;

  return (
    <div className="flex items-center gap-2">
      <div className={cn('flex gap-1', compact ? 'gap-0.5' : 'gap-1')}>
        {[0, 1, 2, 3, 4, 5].map((g) => {
          const selected = value === g;
          return (
            <button
              key={g}
              type="button"
              onClick={() => onChange(selected ? null : (g as MotorGrade))}
              className={cn(
                'rounded-md border text-xs font-medium transition',
                compact ? 'h-7 w-7' : 'h-8 w-8',
                selected
                  ? gradeColor(g)
                  : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-slate-500',
              )}
            >
              {g}
            </button>
          );
        })}
      </div>
      {delta != null && delta !== 0 && (
        <span
          className={cn(
            'text-[10px] font-medium',
            delta > 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400',
          )}
        >
          {delta > 0 ? `▲ from ${yesterday}` : `▼ from ${yesterday}`}
        </span>
      )}
      {delta === 0 && (
        <span className="text-[10px] text-slate-400 dark:text-slate-500">= 어제</span>
      )}
    </div>
  );
}

function gradeColor(g: number): string {
  if (g >= 5) return 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-300';
  if (g >= 4) return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-400';
  if (g >= 3) return 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300';
  if (g >= 2) return 'border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-300';
  return 'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-300';
}
