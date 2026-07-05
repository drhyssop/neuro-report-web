'use client';

import { cn } from '@/lib/utils/cn';
import type { Bilateral, SensoryStatus } from '@/types/domain';

interface Props {
  dermatome: string;
  value?: Bilateral<SensoryStatus>;
  yesterday?: Bilateral<SensoryStatus>;
  onChange: (v: Bilateral<SensoryStatus>) => void;
}

/** 디폴트는 'intact' — null도 intact로 간주 */
const OPTIONS: Array<{ value: SensoryStatus; label: string; symbol: string; tone: 'good' | 'warn' | 'bad' }> = [
  { value: 'hyper', label: 'Hyperesthesia', symbol: '↑', tone: 'warn' },
  { value: 'intact', label: 'Intact', symbol: '−', tone: 'good' },
  { value: 'hypo', label: 'Hypoesthesia', symbol: '↓', tone: 'bad' },
];

export function SensoryRow({ dermatome, value, onChange }: Props) {
  // null/undefined → 'intact' 기본
  const lt: SensoryStatus = value?.lt ?? 'intact';
  const rt: SensoryStatus = value?.rt ?? 'intact';

  return (
    <div className="grid grid-cols-[40px_1fr_1fr] items-center gap-2 py-1">
      <span className="text-xs font-medium text-slate-700 dark:text-slate-200">{dermatome}</span>
      <SensoryButtons side="Rt" value={rt} onChange={(v) => onChange({ lt, rt: v })} />
      <SensoryButtons side="Lt" value={lt} onChange={(v) => onChange({ lt: v, rt })} />
    </div>
  );
}

function SensoryButtons({
  side,
  value,
  onChange,
}: {
  side: string;
  value: SensoryStatus;
  onChange: (v: SensoryStatus) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-[10px] text-slate-400 dark:text-slate-500">{side}</span>
      <div className="flex gap-0.5">
        {OPTIONS.map((opt) => {
          const selected = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              title={opt.label}
              className={cn(
                'h-7 w-7 rounded border text-sm font-bold',
                selected
                  ? sensoryColor(opt.tone)
                  : 'border-slate-300 bg-white text-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-500',
              )}
            >
              {opt.symbol}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function sensoryColor(tone: 'good' | 'warn' | 'bad'): string {
  if (tone === 'good') return 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-300';
  if (tone === 'warn') return 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-300';
  return 'border-red-300 bg-red-50 text-red-800 dark:border-red-700 dark:bg-red-950 dark:text-red-300';
}
