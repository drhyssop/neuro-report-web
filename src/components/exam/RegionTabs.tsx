'use client';

import { cn } from '@/lib/utils/cn';
import type { Region } from '@/types/domain';

interface Props {
  active: Region;
  onChange: (r: Region) => void;
  hasData: Partial<Record<Region, boolean>>; // 어떤 부위에 데이터가 있는지
}

const TABS: { value: Region; label: string }[] = [
  { value: 'brain', label: 'Brain' },
  { value: 'cervical', label: 'Cervical' },
  { value: 'thoracic', label: 'Thoracic' },
  { value: 'lumbar', label: 'Lumbar' },
];

export function RegionTabs({ active, onChange, hasData }: Props) {
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-slate-200 dark:border-slate-700">
      {TABS.map((t) => (
        <button
          key={t.value}
          type="button"
          onClick={() => onChange(t.value)}
          className={cn(
            'relative px-3 py-2 text-xs font-medium transition',
            active === t.value
              ? 'border-b-2 border-slate-900 text-slate-900 dark:border-slate-100 dark:text-slate-100'
              : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200',
          )}
        >
          {t.label}
          {hasData[t.value] && (
            <span className="ml-1 inline-block h-1 w-1 rounded-full bg-emerald-500" />
          )}
        </button>
      ))}
    </div>
  );
}
