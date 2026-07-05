'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Medications } from '@/types/domainV2';

interface Props {
  patientId: string;
  medications: Medications;
}

function cn(...c: (string | false | undefined)[]) {
  return c.filter(Boolean).join(' ');
}

export function PatientMedicationsBox({ patientId, medications }: Props) {
  const router = useRouter();
  const [value, setValue] = useState<Medications>(medications ?? {});
  const [customInput, setCustomInput] = useState('');
  const [isPending, startTransition] = useTransition();

  function save(next: Medications) {
    setValue(next);
    startTransition(async () => {
      const supabase = createClient();
      await supabase.from('patients').update({ medications: next }).eq('id', patientId);
      router.refresh();
    });
  }

  const lyricaOn = !!(value.lyricaOn || value.lyrica);
  const toggle = (k: 'nucynta' | 'pelubi' | 'ultracet') => save({ ...value, [k]: !value[k] });
  const toggleLyrica = () =>
    lyricaOn ? save({ ...value, lyricaOn: false, lyrica: null }) : save({ ...value, lyricaOn: true });
  const setDose = (d: number) => save({ ...value, lyricaOn: true, lyrica: value.lyrica === d ? null : d });
  const setOsteo = (o: 'prolia' | 'evenity' | null) => save({ ...value, osteo: value.osteo === o ? null : o });
  function addCustom() {
    const t = customInput.trim();
    if (!t) return;
    save({ ...value, custom: [...(value.custom ?? []), t] });
    setCustomInput('');
  }
  const removeCustom = (i: number) =>
    save({ ...value, custom: (value.custom ?? []).filter((_, idx) => idx !== i) });

  const pill = 'rounded-md border px-2.5 py-1 text-[11px] font-medium transition';
  const on = 'border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900';
  const off = 'border-slate-300 text-slate-600 dark:border-slate-600 dark:text-slate-300';

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-200">
        복용약{isPending && <span className="ml-1 text-[10px] text-slate-400">저장 중…</span>}
      </div>

      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <button type="button" onClick={toggleLyrica} className={cn(pill, lyricaOn ? on : off)}>
            lyrica
          </button>
          {lyricaOn &&
            [50, 75, 150, 300].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDose(d)}
                className={cn(
                  'rounded-md border px-2 py-1 text-[11px]',
                  value.lyrica === d
                    ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-300'
                    : 'border-slate-300 text-slate-500 dark:border-slate-600 dark:text-slate-400',
                )}
              >
                {d}
              </button>
            ))}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {(['nucynta', 'pelubi', 'ultracet'] as const).map((k) => (
            <button key={k} type="button" onClick={() => toggle(k)} className={cn(pill, value[k] ? on : off)}>
              {k}
            </button>
          ))}
        </div>

        <div>
          <div className="flex gap-1.5">
            <input
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addCustom();
                }
              }}
              placeholder="기타 약 추가"
              className="flex-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
            <button type="button" onClick={addCustom} className={cn(pill, off)}>
              추가
            </button>
          </div>
          {(value.custom ?? []).length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {(value.custom ?? []).map((c, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-0.5 text-[11px] dark:border-slate-600 dark:text-slate-300"
                >
                  {c}
                  <button type="button" onClick={() => removeCustom(i)} className="text-slate-400 hover:text-red-500">
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="mb-1 text-[10px] text-slate-500 dark:text-slate-400">골다공증약 (택1)</div>
          <div className="flex flex-wrap gap-1.5">
            {([['prolia', '프롤리아'], ['evenity', '이베니티']] as const).map(([k, label]) => (
              <button key={k} type="button" onClick={() => setOsteo(k)} className={cn(pill, value.osteo === k ? on : off)}>
                {label}
              </button>
            ))}
            {value.osteo && (
              <button type="button" onClick={() => setOsteo(null)} className="px-1.5 py-1 text-[10px] text-slate-400">
                안 씀
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
