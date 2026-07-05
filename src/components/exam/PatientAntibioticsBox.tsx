'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ANTIBIOTIC_OPTIONS, antibioticShort, antibioticDays } from '@/types/domainV2';
import type { AntibioticEntry } from '@/types/domainV2';

interface Props {
  patientId: string;
  antibioticsLog: AntibioticEntry[];
}

const inputCls =
  'rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100';

export function PatientAntibioticsBox({ patientId, antibioticsLog }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState<string>('');
  const [newCustom, setNewCustom] = useState('');
  const [newStarted, setNewStarted] = useState(new Date().toISOString().slice(0, 10));

  async function save(next: AntibioticEntry[]) {
    const supabase = createClient();
    startTransition(async () => {
      await supabase
        .from('patients')
        .update({ antibiotics_log: next })
        .eq('id', patientId);
      router.refresh();
    });
  }

  function add() {
    const name = newCustom.trim() || newName;
    if (!name) return;
    save([...antibioticsLog, { name, started_at: newStarted, ended_at: null }]);
    setNewName('');
    setNewCustom('');
    setAdding(false);
  }

  function end(idx: number, endedAt: string) {
    save(antibioticsLog.map((e, i) => (i === idx ? { ...e, ended_at: endedAt } : e)));
  }

  function remove(idx: number) {
    if (!confirm('이 항생제 기록을 삭제합니까?')) return;
    save(antibioticsLog.filter((_, i) => i !== idx));
  }

  const ongoing = antibioticsLog.filter((e) => !e.ended_at);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-medium text-slate-700 dark:text-slate-200">
          항생제 ({ongoing.length} 사용중)
        </div>
        <button
          type="button"
          onClick={() => setAdding(!adding)}
          className="rounded border border-slate-300 px-2 py-0.5 text-[10px] dark:border-slate-600 dark:text-slate-300"
        >
          {adding ? '취소' : '+ 시작'}
        </button>
      </div>

      {adding && (
        <div className="mb-2 space-y-1 rounded-md border border-dashed border-slate-300 p-2 dark:border-slate-700">
          <div className="grid grid-cols-[1fr_auto] gap-1">
            <select value={newName} onChange={(e) => setNewName(e.target.value)} className={inputCls}>
              <option value="">선택…</option>
              {ANTIBIOTIC_OPTIONS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={newStarted}
              onChange={(e) => setNewStarted(e.target.value)}
              className={inputCls}
            />
          </div>
          <input
            value={newCustom}
            onChange={(e) => setNewCustom(e.target.value)}
            placeholder="직접 입력"
            className={`${inputCls} w-full`}
          />
          <button
            type="button"
            onClick={add}
            disabled={isPending || (!newName && !newCustom.trim())}
            className="w-full rounded-md bg-slate-900 px-3 py-1 text-xs text-white disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
          >
            추가
          </button>
        </div>
      )}

      <div className="space-y-1">
        {antibioticsLog.length === 0 ? (
          <p className="text-[10px] text-slate-400 dark:text-slate-500">기록 없음</p>
        ) : (
          antibioticsLog.map((e, idx) => (
            <AbxRow
              key={idx}
              entry={e}
              isPending={isPending}
              onEnd={(d) => end(idx, d)}
              onRemove={() => remove(idx)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function AbxRow({
  entry,
  isPending,
  onEnd,
  onRemove,
}: {
  entry: AntibioticEntry;
  isPending: boolean;
  onEnd: (date: string) => void;
  onRemove: () => void;
}) {
  const [showEnd, setShowEnd] = useState(false);
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const days = antibioticDays(entry, new Date());

  return (
    <div className="rounded-md border border-slate-200 p-1.5 text-xs dark:border-slate-700">
      <div className="flex items-center justify-between gap-1">
        <div className="flex-1 truncate">
          <span className="font-medium dark:text-slate-100">
            {antibioticShort(entry.name)}
          </span>
          <span className="ml-1 text-[10px] text-slate-500 dark:text-slate-400">
            {entry.ended_at ? `(${days}d 종료)` : `${days}d`}
          </span>
        </div>
        <div className="flex gap-1">
          {!entry.ended_at && !showEnd && (
            <button
              type="button"
              onClick={() => setShowEnd(true)}
              disabled={isPending}
              className="rounded border border-slate-300 px-1 py-0.5 text-[9px] dark:border-slate-600 dark:text-slate-300"
            >
              종료
            </button>
          )}
          <button
            type="button"
            onClick={onRemove}
            disabled={isPending}
            className="rounded border border-red-200 px-1 py-0.5 text-[9px] text-red-600 dark:border-red-900 dark:text-red-400"
          >
            삭제
          </button>
        </div>
      </div>
      {showEnd && (
        <div className="mt-1 flex gap-1">
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className={inputCls}
          />
          <button
            type="button"
            onClick={() => {
              onEnd(endDate);
              setShowEnd(false);
            }}
            disabled={isPending}
            className="rounded-md bg-slate-900 px-2 py-0.5 text-[9px] text-white dark:bg-slate-100 dark:text-slate-900"
          >
            확정
          </button>
        </div>
      )}
    </div>
  );
}
