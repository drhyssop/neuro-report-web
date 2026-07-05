'use client';

import { cn } from '@/lib/utils/cn';
import type { Bilateral, DtrGrade } from '@/types/domain';

interface Props {
  label: string;
  value?: Bilateral<DtrGrade>;
  onChange: (v: Bilateral<DtrGrade>) => void;
}

export function DtrRow({ label, value, onChange }: Props) {
  const lt = value?.lt ?? null;
  const rt = value?.rt ?? null;

  return (
    <div className="grid grid-cols-[1fr_1fr_1fr] items-center gap-2 py-1">
      <span className="text-xs font-medium text-slate-700 dark:text-slate-200">{label}</span>
      <DtrButtons side="Rt" value={rt} onChange={(v) => onChange({ lt, rt: v })} />
      <DtrButtons side="Lt" value={lt} onChange={(v) => onChange({ lt: v, rt })} />
    </div>
  );
}

function DtrButtons({
  side,
  value,
  onChange,
}: {
  side: string;
  value: DtrGrade;
  onChange: (v: DtrGrade) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-[10px] text-slate-400 dark:text-slate-500">{side}</span>
      <div className="flex gap-0.5">
        {[0, 1, 2, 3, 4].map((g) => {
          const selected = value === g;
          return (
            <button
              key={g}
              type="button"
              onClick={() => onChange(selected ? null : (g as DtrGrade))}
              className={cn(
                'h-6 w-6 rounded border text-[10px] font-medium',
                selected
                  ? dtrColor(g)
                  : 'border-slate-300 bg-white text-slate-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400',
              )}
            >
              {g === 2 ? '2+' : g}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function dtrColor(g: number): string {
  if (g === 2) return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300';
  if (g === 0 || g === 4) return 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300';
  return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300';
}
