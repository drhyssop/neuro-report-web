'use client';

import { MotorPowerInput } from './MotorPowerInput';
import type { Bilateral, MotorGrade } from '@/types/domain';

interface Props {
  label: string;
  myotome?: string;  // 'C5', 'L4' 등 — label 옆에 괄호로 표시
  value?: Bilateral<MotorGrade>;
  yesterday?: Bilateral<MotorGrade>;
  onChange: (v: Bilateral<MotorGrade>) => void;
}

/**
 * Motor 한 항목 (예: Hip flex)의 Lt/Rt 입력을 한 줄에 표시.
 * 우측의 빠른 버튼 — 양쪽 5/5 정상 / 클리어
 */
export function BilateralRow({ label, myotome, value, yesterday, onChange }: Props) {
  const lt = value?.lt ?? null;
  const rt = value?.rt ?? null;

  function setBoth(g: MotorGrade) {
    onChange({ lt: g, rt: g });
  }

  return (
    <div className="space-y-2 rounded-md border border-slate-100 p-2 dark:border-slate-800">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
          {label}
          {myotome && <span className="ml-1 text-[10px] font-normal text-slate-400">({myotome})</span>}
        </span>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setBoth(5)}
            className="rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400"
          >
            both 5/5
          </button>
          <button
            type="button"
            onClick={() => onChange({ lt: null, rt: null })}
            className="rounded border border-slate-200 px-1.5 py-0.5 text-[10px] text-slate-500 dark:border-slate-700 dark:text-slate-400"
          >
            clear
          </button>
        </div>
      </div>
      <div className="grid grid-cols-[auto_1fr] items-center gap-x-2 gap-y-1.5">
        <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">Rt</span>
        <MotorPowerInput
          value={rt}
          yesterday={yesterday?.rt ?? undefined}
          onChange={(v) => onChange({ lt, rt: v })}
          compact
        />
        <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">Lt</span>
        <MotorPowerInput
          value={lt}
          yesterday={yesterday?.lt ?? undefined}
          onChange={(v) => onChange({ lt: v, rt })}
          compact
        />
      </div>
    </div>
  );
}
