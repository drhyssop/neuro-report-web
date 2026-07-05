'use client';

import { useState } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils/cn';

interface CalendarEvent {
  date: string;       // YYYY-MM-DD
  patientId: string;
  patientAlias: string;
  ward: string | null;
  type: 'surgery_planned' | 'surgery_done' | 'expected_discharge' | 'admitted';
  label: string;
}

interface Props {
  events: CalendarEvent[];
}

const TYPE_COLORS: Record<CalendarEvent['type'], string> = {
  surgery_planned: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  surgery_done:    'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300',
  expected_discharge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  admitted:        'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
};

const TYPE_LABEL: Record<CalendarEvent['type'], string> = {
  surgery_planned: '수술예정',
  surgery_done: '수술',
  expected_discharge: '퇴원',
  admitted: '입원',
};

export function CalendarView({ events }: Props) {
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() }; // month 0-based
  });

  // 이벤트를 날짜별로 그룹핑
  const eventsByDate = new Map<string, CalendarEvent[]>();
  for (const e of events) {
    const list = eventsByDate.get(e.date) ?? [];
    list.push(e);
    eventsByDate.set(e.date, list);
  }

  // 월별 날짜 생성
  const first = new Date(cursor.year, cursor.month, 1);
  const last = new Date(cursor.year, cursor.month + 1, 0);
  const firstWeekday = first.getDay(); // 0=Sun
  const daysInMonth = last.getDate();

  const cells: Array<{ date: string; day: number } | null> = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const mm = String(cursor.month + 1).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    cells.push({ date: `${cursor.year}-${mm}-${dd}`, day: d });
  }
  // 7의 배수로 채우기
  while (cells.length % 7 !== 0) cells.push(null);

  const today = new Date().toISOString().slice(0, 10);

  function prev() {
    setCursor((c) => {
      const m = c.month - 1;
      return m < 0 ? { year: c.year - 1, month: 11 } : { ...c, month: m };
    });
  }
  function next() {
    setCursor((c) => {
      const m = c.month + 1;
      return m > 11 ? { year: c.year + 1, month: 0 } : { ...c, month: m };
    });
  }
  function thisMonth() {
    const d = new Date();
    setCursor({ year: d.getFullYear(), month: d.getMonth() });
  }

  return (
    <div className="space-y-3">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={prev}
            className="rounded-md border border-slate-300 px-2 py-1 text-xs dark:border-slate-700 dark:text-slate-300"
          >
            ←
          </button>
          <div className="text-sm font-medium dark:text-slate-100">
            {cursor.year}년 {cursor.month + 1}월
          </div>
          <button
            type="button"
            onClick={next}
            className="rounded-md border border-slate-300 px-2 py-1 text-xs dark:border-slate-700 dark:text-slate-300"
          >
            →
          </button>
        </div>
        <button
          type="button"
          onClick={thisMonth}
          className="rounded-md border border-slate-300 px-2 py-1 text-xs dark:border-slate-700 dark:text-slate-300"
        >
          오늘
        </button>
      </div>

      {/* 범례 */}
      <div className="flex flex-wrap gap-2 text-[10px]">
        {Object.entries(TYPE_LABEL).map(([k, v]) => (
          <span
            key={k}
            className={`rounded px-1.5 py-0.5 ${TYPE_COLORS[k as CalendarEvent['type']]}`}
          >
            {v}
          </span>
        ))}
      </div>

      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 text-center text-[10px] font-medium text-slate-500 dark:text-slate-400">
        {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => (
          <div key={i} className={cn(i === 0 && 'text-red-500', i === 6 && 'text-blue-500')}>
            {d}
          </div>
        ))}
      </div>

      {/* 캘린더 그리드 */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell, idx) => {
          if (!cell)
            return (
              <div
                key={idx}
                className="aspect-square rounded border border-transparent"
              />
            );
          const dayEvents = eventsByDate.get(cell.date) ?? [];
          const isToday = cell.date === today;
          const dayOfWeek = idx % 7;
          return (
            <div
              key={idx}
              className={cn(
                'min-h-[80px] rounded border p-1 text-[10px]',
                isToday
                  ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-950'
                  : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900',
              )}
            >
              <div
                className={cn(
                  'mb-1 text-right text-[10px] font-medium',
                  dayOfWeek === 0 && 'text-red-500',
                  dayOfWeek === 6 && 'text-blue-500',
                  !isToday && dayOfWeek !== 0 && dayOfWeek !== 6 && 'text-slate-700 dark:text-slate-300',
                )}
              >
                {cell.day}
              </div>
              <div className="space-y-0.5">
                {dayEvents.slice(0, 3).map((e, i) => (
                  <Link
                    key={i}
                    href={`/patient/${e.patientId}`}
                    className={cn(
                      'block truncate rounded px-1 py-0.5',
                      TYPE_COLORS[e.type],
                    )}
                    title={`${e.patientAlias} ${e.label}`}
                  >
                    {e.patientAlias}
                  </Link>
                ))}
                {dayEvents.length > 3 && (
                  <div className="text-[9px] text-slate-400">+{dayEvents.length - 3}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
