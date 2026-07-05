'use client';

import type { PathologicSigns } from '@/types/domain';

interface Props {
  value?: PathologicSigns;
  onChange: (v: PathologicSigns) => void;
}

/**
 * Pathologic signs / abnormal findings 체크박스.
 * 체크 안 하면 환자일보 등에 노출 안 됨 (정상으로 간주).
 */
export function PathologicSignsSection({ value, onChange }: Props) {
  const v = value ?? {};

  function set(key: keyof PathologicSigns, checked: boolean) {
    onChange({ ...v, [key]: checked || undefined });
  }

  const items: Array<{ key: keyof PathologicSigns; label: string }> = [
    { key: 'hoffman', label: 'Hoffman sign (+)' },
    { key: 'babinski', label: 'Babinski (+)' },
    { key: 'analToneDecreased', label: 'Anal tone 저하' },
    { key: 'voidingProblem', label: 'Voiding function 이상' },
    { key: 'gaitDisturbance', label: 'Gait disturbance' },
  ];

  return (
    <div className="space-y-1.5">
      {items.map((it) => (
        <label key={it.key} className="flex items-center gap-2 text-xs dark:text-slate-300">
          <input
            type="checkbox"
            checked={!!v[it.key]}
            onChange={(e) => set(it.key, e.target.checked)}
          />
          {it.label}
        </label>
      ))}
      <p className="mt-2 text-[10px] text-slate-400 dark:text-slate-500">
        체크하지 않은 항목은 환자일보에 언급되지 않습니다 (정상으로 간주).
      </p>
    </div>
  );
}
