'use client';

import { useState, useTransition } from 'react';
import type { DrainTube, DrainOutputs } from '@/types/domainV2';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

interface Props {
  patientId: string;
  drainsLog: DrainTube[];
  todayOutputs: DrainOutputs;
  yesterdayOutputs: DrainOutputs;
  examHistory: Array<{ exam_date: string; drain_outputs?: DrainOutputs }>;
  onOutputsChange: (next: DrainOutputs) => void;
}

const inputCls =
  'rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100';

export function DrainSection({
  patientId,
  drainsLog,
  todayOutputs,
  yesterdayOutputs,
  examHistory,
  onOutputsChange,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [newType, setNewType] = useState<'JP' | 'HV' | 'Other'>('JP');
  const [newSide, setNewSide] = useState<'Lt' | 'Rt' | 'Mid'>('Rt');
  const [newStarted, setNewStarted] = useState(new Date().toISOString().slice(0, 10));
  const [showHistory, setShowHistory] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [removeDate, setRemoveDate] = useState(new Date().toISOString().slice(0, 10));

  const today = new Date().toISOString().slice(0, 10);

  // 활성/제거된 drain 분리
  const activeDrains = drainsLog.filter((d) => !d.ended_at);
  const endedDrains = drainsLog.filter((d) => !!d.ended_at);

  function todayLabel(d: DrainTube): string {
    return `${d.side} ${d.type}(${d.index})`;
  }

  function updateOutput(drainId: string, ccStr: string) {
    const next = { ...todayOutputs };
    if (ccStr === '') {
      delete next[drainId];
    } else {
      const cc = parseInt(ccStr);
      if (!isNaN(cc)) next[drainId] = cc;
    }
    onOutputsChange(next);
  }

  async function addDrain() {
    // 같은 type/side 안에서 index 계산
    const sameTypeSide = drainsLog.filter(
      (d) => d.type === newType && d.side === newSide,
    );
    const maxIndex = sameTypeSide.reduce((m, d) => Math.max(m, d.index), 0);

    const newDrain: DrainTube = {
      id: crypto.randomUUID(),
      type: newType,
      side: newSide,
      index: maxIndex + 1,
      started_at: newStarted,
      ended_at: null,
    };

    const supabase = createClient();
    const next = [...drainsLog, newDrain];
    startTransition(async () => {
      await supabase
        .from('patients')
        .update({ drains_log: next })
        .eq('id', patientId);
      setAdding(false);
      router.refresh();
    });
  }

  // 제거 날짜를 선택해서 확정 (주말/휴일 제거분을 소급 입력 가능)
  function confirmRemove(drainId: string, date: string) {
    const supabase = createClient();
    const next = drainsLog.map((d) =>
      d.id === drainId ? { ...d, ended_at: date } : d,
    );
    setRemovingId(null);
    startTransition(async () => {
      await supabase.from('patients').update({ drains_log: next }).eq('id', patientId);
      router.refresh();
    });
  }

  async function deleteDrain(drainId: string) {
    if (!confirm('이 drain 기록을 완전히 삭제합니다 (잘못 추가한 경우).')) return;
    const supabase = createClient();
    const next = drainsLog.filter((d) => d.id !== drainId);
    startTransition(async () => {
      await supabase
        .from('patients')
        .update({ drains_log: next })
        .eq('id', patientId);
      router.refresh();
    });
  }

  // 제거 취소 — ended_at을 다시 null로 (제거 버튼 잘못 눌렀을 때)
  async function restoreDrain(drainId: string) {
    const supabase = createClient();
    const next = drainsLog.map((d) =>
      d.id === drainId ? { ...d, ended_at: null } : d,
    );
    startTransition(async () => {
      await supabase
        .from('patients')
        .update({ drains_log: next })
        .eq('id', patientId);
      router.refresh();
    });
  }

  // 히스토리 — 모든 drain(활성+제거)의 일자별 cc 모음
  const recent = [...examHistory]
    .sort((a, b) => b.exam_date.localeCompare(a.exam_date))
    .slice(0, 10)
    .reverse();

  // 추이 컬럼: 활성 먼저, 그 다음 제거된 drain (제거 후에도 그동안 얼마 나왔는지 확인용)
  const trendDrains = [...activeDrains, ...endedDrains];

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-medium text-slate-700 dark:text-slate-200">
          Drain (cc)
        </div>
        <button
          type="button"
          onClick={() => setAdding(!adding)}
          className="rounded-md border border-slate-300 px-2 py-1 text-[10px] dark:border-slate-600 dark:text-slate-300"
        >
          {adding ? '취소' : '+ Drain 추가'}
        </button>
      </div>

      {/* 추가 폼 */}
      {adding && (
        <div className="mb-3 grid grid-cols-[1fr_1fr_1fr_auto] gap-2 rounded-md border border-dashed border-slate-300 p-2 dark:border-slate-700">
          <select
            value={newType}
            onChange={(e) => setNewType(e.target.value as 'JP' | 'HV' | 'Other')}
            className={inputCls}
          >
            <option value="JP">JP</option>
            <option value="HV">HV (Hemovac)</option>
            <option value="Other">Other</option>
          </select>
          <select
            value={newSide}
            onChange={(e) => setNewSide(e.target.value as 'Lt' | 'Rt' | 'Mid')}
            className={inputCls}
          >
            <option value="Rt">Rt</option>
            <option value="Lt">Lt</option>
            <option value="Mid">Mid</option>
          </select>
          <input
            type="date"
            value={newStarted}
            onChange={(e) => setNewStarted(e.target.value)}
            className={inputCls}
          />
          <button
            type="button"
            onClick={addDrain}
            disabled={isPending}
            className="rounded-md bg-slate-900 px-3 py-1 text-xs text-white disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
          >
            추가
          </button>
        </div>
      )}

      {/* 활성 drain 입력 */}
      {activeDrains.length === 0 ? (
        <p className="text-[10px] text-slate-400 dark:text-slate-500">활성 drain 없음</p>
      ) : (
        <div className="space-y-1.5">
          <div className="grid grid-cols-[1fr_80px_60px_auto] items-center gap-2 border border-transparent px-2 text-[10px] font-medium text-slate-500 dark:text-slate-400">
            <span>Drain</span>
            <span className="text-center">오늘 cc</span>
            <span className="text-center">어제</span>
            <span></span>
          </div>
          {activeDrains.map((d) => (
            <div
              key={d.id}
              className="grid grid-cols-[1fr_80px_60px_auto] items-center gap-2 rounded-md border border-slate-200 p-2 text-xs dark:border-slate-700"
            >
              <div>
                <span className="font-medium dark:text-slate-100">{todayLabel(d)}</span>
                <span className="ml-2 text-[10px] text-slate-400 dark:text-slate-500">
                  since {d.started_at}
                </span>
              </div>
              <input
                type="number"
                value={todayOutputs[d.id] ?? ''}
                onChange={(e) => updateOutput(d.id, e.target.value)}
                placeholder="cc"
                className={`${inputCls} w-full text-center`}
              />
              <span className="text-center text-[10px] text-slate-500 dark:text-slate-400">
                {yesterdayOutputs[d.id] != null ? `${yesterdayOutputs[d.id]}` : '-'}
              </span>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setRemovingId(d.id);
                    setRemoveDate(today);
                  }}
                  disabled={isPending}
                  className="rounded border border-amber-300 px-1.5 py-0.5 text-[9px] text-amber-700 dark:border-amber-800 dark:text-amber-400"
                >
                  제거
                </button>
                <button
                  type="button"
                  onClick={() => deleteDrain(d.id)}
                  disabled={isPending}
                  className="rounded border border-red-200 px-1.5 py-0.5 text-[9px] text-red-600 dark:border-red-900 dark:text-red-400"
                >
                  삭제
                </button>
              </div>
            </div>
          ))}
          {/* 제거 날짜 선택 (주말/휴일 제거분 소급 입력) */}
          {removingId && (
            <div className="col-span-full flex flex-wrap items-center gap-2 rounded-md border border-amber-300 bg-amber-50 p-2 dark:border-amber-800 dark:bg-amber-950/40">
              <span className="text-[11px] text-amber-800 dark:text-amber-300">제거 날짜:</span>
              <input
                type="date"
                value={removeDate}
                max={today}
                onChange={(e) => setRemoveDate(e.target.value)}
                className="rounded border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              />
              <button
                type="button"
                onClick={() => confirmRemove(removingId, removeDate)}
                disabled={isPending || !removeDate}
                className="rounded bg-amber-600 px-2 py-1 text-[11px] font-medium text-white disabled:opacity-50"
              >
                제거 확정
              </button>
              <button
                type="button"
                onClick={() => setRemovingId(null)}
                className="rounded border border-slate-300 px-2 py-1 text-[11px] text-slate-600 dark:border-slate-600 dark:text-slate-300"
              >
                취소
              </button>
            </div>
          )}
        </div>
      )}

      {/* 제거된 drain */}
      {endedDrains.length > 0 && (
        <div className="mt-3">
          <div className="mb-1 text-[10px] font-medium text-slate-500 dark:text-slate-400">
            제거된 drain
          </div>
          <div className="space-y-1">
            {endedDrains.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
              >
                <span>
                  {todayLabel(d)} · {d.started_at} → {d.ended_at} 제거됨
                </span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => restoreDrain(d.id)}
                    disabled={isPending}
                    className="rounded border border-emerald-300 px-1.5 py-0.5 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400"
                  >
                    제거 취소
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteDrain(d.id)}
                    disabled={isPending}
                    className="rounded border border-red-200 px-1.5 py-0.5 text-red-600 dark:border-red-900 dark:text-red-400"
                  >
                    삭제
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 일자별 추이 (toggle) — 제거된 drain 포함 */}
      {trendDrains.length > 0 && recent.length > 0 && (
        <div className="mt-3 border-t border-slate-100 pt-2 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setShowHistory(!showHistory)}
            className="text-[10px] text-slate-500 hover:text-slate-700 dark:text-slate-400"
          >
            {showHistory ? '추이 숨기기 ▲' : '최근 추이 보기 ▼'}
          </button>
          {showHistory && (
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="text-slate-500 dark:text-slate-400">
                    <th className="px-1 py-0.5 text-left">날짜</th>
                    {trendDrains.map((d) => (
                      <th key={d.id} className="px-1 py-0.5 text-center">
                        <div className="font-medium">{todayLabel(d)}</div>
                        {d.ended_at && (
                          <div className="font-normal text-amber-600 dark:text-amber-400">
                            {d.ended_at.slice(5)} 제거
                          </div>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recent.map((e) => (
                    <tr
                      key={e.exam_date}
                      className="border-t border-slate-100 dark:border-slate-800"
                    >
                      <td className="px-1 py-0.5 font-medium dark:text-slate-300">
                        {e.exam_date}
                      </td>
                      {trendDrains.map((d) => {
                        const cc = e.drain_outputs?.[d.id];
                        // 제거일 이후 날짜는 회색 '제거' 표기
                        const removedBefore = d.ended_at != null && e.exam_date > d.ended_at;
                        return (
                          <td
                            key={d.id}
                            className="px-1 py-0.5 text-center text-slate-600 dark:text-slate-400"
                          >
                            {cc != null ? (
                              cc
                            ) : removedBefore ? (
                              <span className="text-slate-300 dark:text-slate-600">제거</span>
                            ) : (
                              '-'
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
