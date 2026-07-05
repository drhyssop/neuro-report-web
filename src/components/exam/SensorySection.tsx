'use client';

import { SensoryRow } from './SensoryRow';
import { DERMATOMES } from '@/lib/constants/regions';
import type { Region, Bilateral, SensoryStatus } from '@/types/domain';

interface Props {
  region: Region;
  value?: Record<string, Bilateral<SensoryStatus>>;
  yesterday?: Record<string, Bilateral<SensoryStatus>>;
  onChange: (next: Record<string, Bilateral<SensoryStatus>>) => void;
}

/**
 * Sensory 입력 — dermatome별 hypesthesia/paresthesia/anesthesia 등 status 기록.
 * dermatome map(그림)은 제거. dermatome별 pain 기록은 별도 DermatomePain 컴포넌트 사용.
 */
export function SensorySection({ region, value, yesterday, onChange }: Props) {
  const dermatomes = DERMATOMES[region];

  function patchOne(dermatome: string, v: Bilateral<SensoryStatus>) {
    onChange({ ...(value ?? {}), [dermatome]: v });
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[40px_1fr_1fr] gap-2 text-[10px] font-medium text-slate-400 dark:text-slate-500">
        <span />
        <span>Rt</span>
        <span>Lt</span>
      </div>
      {dermatomes.map((d) => (
        <SensoryRow
          key={d}
          dermatome={d}
          value={value?.[d]}
          yesterday={yesterday?.[d]}
          onChange={(v) => patchOne(d, v)}
        />
      ))}
    </div>
  );
}
