'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Holiday } from '@/lib/repositories/holidayRepository';

// 양력 고정 공휴일 (표시용 — 자동 인식되므로 등록 불필요)
const FIXED = [
  '01-01 신정',
  '03-01 삼일절',
  '05-05 어린이날',
  '06-06 현충일',
  '08-15 광복절',
  '10-03 개천절',
  '10-09 한글날',
  '12-25 성탄절',
];

export function HolidayManager({ initial }: { initial: Holiday[] }) {
  const router = useRouter();
  const [holidays, setHolidays] = useState<Holiday[]>(initial);
  const [date, setDate] = useState('');
  const [label, setLabel] = useState('');
  const [isPending, startTransition] = useTransition();

  function add() {
    if (!date) return;
    const supabase = createClient();
    startTransition(async () => {
      await supabase.from('holidays').upsert({ date, label: label || null });
      setHolidays((h) =>
        [...h.filter((x) => x.date !== date), { date, label: label || null }].sort((a, b) =>
          a.date.localeCompare(b.date),
        ),
      );
      setDate('');
      setLabel('');
      router.refresh();
    });
  }

  function remove(d: string) {
    const supabase = createClient();
    startTransition(async () => {
      await supabase.from('holidays').delete().eq('date', d);
      setHolidays((h) => h.filter((x) => x.date !== d));
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-2 text-sm font-medium dark:text-slate-200">공휴일 추가 (음력·임시공휴일·병원 휴진일)</h2>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="text-[10px] text-slate-500 dark:text-slate-400">날짜</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="block rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
          <div className="flex-1">
            <label className="text-[10px] text-slate-500 dark:text-slate-400">이름 (선택)</label>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="예: 설날, 임시공휴일, 창립기념일"
              className="block w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
          <button
            type="button"
            onClick={add}
            disabled={isPending || !date}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
          >
            추가
          </button>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium dark:text-slate-200">등록된 공휴일 ({holidays.length})</h2>
        {holidays.length === 0 ? (
          <p className="text-xs text-slate-400 dark:text-slate-500">아직 등록된 공휴일이 없습니다.</p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-md border border-slate-200 dark:divide-slate-800 dark:border-slate-700">
            {holidays.map((h) => (
              <li key={h.date} className="flex items-center justify-between px-3 py-2 text-sm">
                <span className="dark:text-slate-200">
                  {h.date}
                  {h.label && <span className="ml-2 text-slate-500 dark:text-slate-400">{h.label}</span>}
                </span>
                <button
                  type="button"
                  onClick={() => remove(h.date)}
                  disabled={isPending}
                  className="text-xs text-red-500 hover:text-red-600"
                >
                  삭제
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium text-slate-500 dark:text-slate-400">
          자동 인식되는 고정 공휴일 (등록 불필요)
        </h2>
        <div className="flex flex-wrap gap-1.5">
          {FIXED.map((f) => (
            <span
              key={f}
              className="rounded border border-slate-200 px-2 py-0.5 text-[11px] text-slate-500 dark:border-slate-700 dark:text-slate-400"
            >
              {f}
            </span>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-slate-400 dark:text-slate-500">
          토·일요일은 자동으로 회진 없는 날로 처리됩니다. 설·추석 등 음력 공휴일과 대체·임시공휴일만 위에 등록하세요.
        </p>
      </section>
    </div>
  );
}
