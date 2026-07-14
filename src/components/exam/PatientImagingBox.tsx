'use client';

import { useState, useTransition, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { ImagingLogEntry } from '@/types/domainV2';

interface Props {
  patientId: string;
  imagingLog: ImagingLogEntry[];
}

const MODALITIES = ['X-ray', 'CT', 'MRI', 'US', 'Bone scan', 'EMG/NCS', 'Other'] as const;

const inputCls =
  'rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100';

export function PatientImagingBox({ patientId, imagingLog }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [newKind, setNewKind] = useState<'preop' | 'followup'>('followup');
  const [newModality, setNewModality] = useState<ImagingLogEntry['modality']>('X-ray');
  const [newDate, setNewDate] = useState(new Date().toISOString().slice(0, 10));
  const [newFindings, setNewFindings] = useState('');

  async function save(next: ImagingLogEntry[]) {
    const supabase = createClient();
    startTransition(async () => {
      await supabase
        .from('patients')
        .update({ imaging_log: next })
        .eq('id', patientId);
      router.refresh();
    });
  }

  function add() {
    save([
      ...imagingLog,
      { kind: newKind, modality: newModality, date: newDate, findings: newFindings || undefined },
    ]);
    setNewFindings('');
    setAdding(false);
  }

  function update(idx: number, patch: Partial<ImagingLogEntry>) {
    save(imagingLog.map((e, i) => (i === idx ? { ...e, ...patch } : e)));
  }

  function remove(idx: number) {
    if (!confirm('이 영상 기록을 삭제합니까?')) return;
    save(imagingLog.filter((_, i) => i !== idx));
  }

  const sorted = [...imagingLog]
    .map((e, idx) => ({ ...e, idx }))
    .sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 lg:col-span-2">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-medium text-slate-700 dark:text-slate-200">
          영상 검사 ({imagingLog.length})
        </div>
        <button
          type="button"
          onClick={() => setAdding(!adding)}
          className="rounded border border-slate-300 px-2 py-0.5 text-[10px] dark:border-slate-600 dark:text-slate-300"
        >
          {adding ? '취소' : '+ 추가'}
        </button>
      </div>

      {adding && (
        <div className="mb-2 space-y-1 rounded-md border border-dashed border-slate-300 p-2 dark:border-slate-700">
          <div className="grid grid-cols-[1fr_1fr_1fr] gap-1">
            <select
              value={newKind}
              onChange={(e) => setNewKind(e.target.value as 'preop' | 'followup')}
              className={inputCls}
            >
              <option value="preop">수술 전</option>
              <option value="followup">F/U</option>
            </select>
            <select
              value={newModality}
              onChange={(e) => setNewModality(e.target.value as ImagingLogEntry['modality'])}
              className={inputCls}
            >
              {MODALITIES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className={inputCls}
            />
          </div>
          <textarea
            value={newFindings}
            onChange={(e) => setNewFindings(e.target.value)}
            placeholder="소견"
            rows={2}
            className={`${inputCls} w-full`}
          />
          <button
            type="button"
            onClick={add}
            disabled={isPending}
            className="w-full rounded-md bg-slate-900 px-3 py-1 text-xs text-white disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
          >
            추가
          </button>
        </div>
      )}

      <div className="space-y-1">
        {sorted.length === 0 ? (
          <p className="text-[10px] text-slate-400 dark:text-slate-500">기록 없음</p>
        ) : (
          sorted.map((e) => (
            <div
              key={e.idx}
              className="rounded-md border border-slate-200 p-1.5 text-xs dark:border-slate-700"
            >
              <div className="flex items-center justify-between gap-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span
                    className={`rounded px-1 py-0.5 text-[9px] font-medium ${
                      e.kind === 'preop'
                        ? 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300'
                        : 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300'
                    }`}
                  >
                    {e.kind === 'preop' ? '수술 전' : 'F/U'}
                  </span>
                  <span className="font-medium dark:text-slate-100">{e.modality}</span>
                  <input
                    type="date"
                    value={e.date}
                    onChange={(ev) => ev.target.value && update(e.idx, { date: ev.target.value })}
                    className="rounded border border-slate-300 bg-white px-1 py-0.5 text-[10px] text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
                  />
                  {e.kind === 'followup' && (
                    <button
                      type="button"
                      onClick={() =>
                        update(e.idx, { mviewActive: e.mviewActive === false ? true : false })
                      }
                      disabled={isPending}
                      title="m-view F/U 리스트 노출 여부"
                      className={`rounded border px-1 py-0.5 text-[9px] ${
                        e.mviewActive === false
                          ? 'border-slate-300 text-slate-400 dark:border-slate-600 dark:text-slate-500'
                          : 'border-green-300 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300'
                      }`}
                    >
                      {e.mviewActive === false ? 'm-view 내림' : 'm-view 표시중'}
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => remove(e.idx)}
                  disabled={isPending}
                  className="rounded border border-red-200 px-1 py-0.5 text-[9px] text-red-600 dark:border-red-900 dark:text-red-400"
                >
                  삭제
                </button>
              </div>
              <FindingsEditor
                key={`f-${e.idx}`}
                initial={e.findings ?? ''}
                onSave={(v) => update(e.idx, { findings: v || undefined })}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/**
 * 영상 소견 편집기 — 로컬 state로 입력받고 디바운스로 저장.
 * (props에 직접 묶으면 저장→refresh 때문에 타이핑이 튕겨서 수정이 불가능했음)
 */
function FindingsEditor({
  initial,
  onSave,
}: {
  initial: string;
  onSave: (v: string) => void;
}) {
  const [text, setText] = useState(initial);
  const timer = useRef<NodeJS.Timeout | null>(null);
  const textRef = useRef(text);
  textRef.current = text;

  // 외부(서버) 값이 바뀌면 동기화 — 단, 편집 중이 아닐 때만
  useEffect(() => {
    setText(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  function change(v: string) {
    setText(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      onSave(v);
      timer.current = null;
    }, 700);
  }

  // 포커스 잃으면 즉시 저장, unmount 시에도 미저장분 저장
  function flush() {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
      onSave(textRef.current);
    }
  }
  useEffect(() => {
    return () => {
      if (timer.current) {
        clearTimeout(timer.current);
        onSave(textRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <textarea
      value={text}
      onChange={(ev) => change(ev.target.value)}
      onBlur={flush}
      placeholder="소견 (자유 입력 · 수정 가능)"
      rows={2}
      className={`${inputCls} mt-1 w-full`}
    />
  );
}
