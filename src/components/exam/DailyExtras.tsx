'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { examRepository } from '@/lib/repositories/examRepository';
import type { DrainTube, DrainOutputs, Labs } from '@/types/domainV2';
import { DrainSection } from './DrainSection';

interface Props {
  patientId: string;
  examId: string;
  initial: {
    fever?: boolean;
    fever_temp?: number | null;
    drainOutputs?: DrainOutputs;
    labs?: Labs;
  };
  drainsLog: DrainTube[];
  /** 어제자 examination의 drain_outputs */
  yesterdayDrainOutputs: DrainOutputs;
  /** 환자의 모든 examinations (POD별 표시용) - {exam_date, drain_outputs} */
  examHistory: Array<{ exam_date: string; drain_outputs?: DrainOutputs }>;
}

const inputCls =
  'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500';

export function DailyExtras({
  patientId,
  examId,
  initial,
  drainsLog,
  yesterdayDrainOutputs,
  examHistory,
}: Props) {
  const [fever, setFever] = useState(!!initial.fever);
  const [feverTemp, setFeverTemp] = useState<string>(
    initial.fever_temp != null ? String(initial.fever_temp) : '',
  );
  const [drainOutputs, setDrainOutputs] = useState<DrainOutputs>(initial.drainOutputs ?? {});
  const [labs, setLabs] = useState<Labs>(initial.labs ?? {});
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const timer = useRef<NodeJS.Timeout | null>(null);

  // 마운트 직후의 불필요한 저장 방지 — 초기값으로 useEffect가 한 번 트리거되면
  // 800ms 후 동일한 값으로 저장이 일어나는데, 그건 의미 없는 write.
  const didMount = useRef(false);

  // 최신 값들을 ref에 동기화 — unmount cleanup에서 stale closure 방지
  const feverRef = useRef(fever);
  const feverTempRef = useRef(feverTemp);
  const drainOutputsRef = useRef(drainOutputs);
  const labsRef = useRef(labs);
  feverRef.current = fever;
  feverTempRef.current = feverTemp;
  drainOutputsRef.current = drainOutputs;
  labsRef.current = labs;

  // 실제 저장 함수
  async function doSave(f: boolean, ft: string, d: DrainOutputs, l: Labs) {
    const supabase = createClient();
    const tempNum = ft ? parseFloat(ft) : null;
    await examRepository.updateExtras(supabase, examId, {
      fever: f,
      fever_temp: tempNum,
      drain_outputs: d,
      labs: l,
    });
    setSavedAt(new Date());
  }

  useEffect(() => {
    // 마운트 직후 첫 호출은 스킵 (초기값으로 저장하는 거 방지)
    if (!didMount.current) {
      didMount.current = true;
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void doSave(fever, feverTemp, drainOutputs, labs);
    }, 800);
    // 의존성 cleanup 시 clearTimeout만. unmount 시 강제 저장은 별도 useEffect에서.
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fever, feverTemp, drainOutputs, labs]);

  // unmount 시 미저장 변경 강제 저장
  useEffect(() => {
    return () => {
      // 디바운스 타이머가 살아 있으면, 아직 저장 안 된 변경이 있는 것.
      // 최신 값을 ref에서 꺼내 동기로 저장 호출.
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
        void doSave(feverRef.current, feverTempRef.current, drainOutputsRef.current, labsRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex justify-end text-[10px] text-slate-400 dark:text-slate-500">
        {savedAt ? `저장됨 · ${savedAt.toLocaleTimeString('ko-KR', { hour12: false })}` : '자동 저장'}
      </div>

      {/* 발열 */}
      <Section title="V/S — 발열">
        <label className="flex items-center gap-2 text-xs dark:text-slate-300">
          <input
            type="checkbox"
            checked={fever}
            onChange={(e) => setFever(e.target.checked)}
          />
          오늘 발열 있음 (체크 안하면 자동으로 "발열 없음"으로 기록)
        </label>
        {fever && (
          <div className="mt-2">
            <label className="text-[10px] text-slate-500 dark:text-slate-400">최고 체온 (°C)</label>
            <input
              type="number"
              step="0.1"
              min="35"
              max="42"
              value={feverTemp}
              onChange={(e) => setFeverTemp(e.target.value)}
              placeholder="38.5"
              className={`ml-2 w-24 ${inputCls.replace('w-full', '')}`}
            />
          </div>
        )}
      </Section>

      {/* Lab — 나갔을 때만 입력 (WBC/Hb/CRP/Cr) */}
      <Section title="Lab (나갔을 때 입력)">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {([
            ['wbc', 'WBC'],
            ['hb', 'Hb'],
            ['crp', 'CRP'],
            ['cr', 'Cr'],
          ] as const).map(([key, label]) => (
            <div key={key}>
              <label className="text-[10px] text-slate-500 dark:text-slate-400">{label}</label>
              <input
                type="number"
                step="any"
                value={labs[key] ?? ''}
                onChange={(e) =>
                  setLabs({ ...labs, [key]: e.target.value === '' ? null : parseFloat(e.target.value) })
                }
                placeholder="-"
                className={inputCls}
              />
            </div>
          ))}
        </div>
      </Section>

      {/* Drain — 누적 관리 + 오늘 cc 입력 */}
      <DrainSection
        patientId={patientId}
        drainsLog={drainsLog}
        todayOutputs={drainOutputs}
        yesterdayOutputs={yesterdayDrainOutputs}
        examHistory={examHistory}
        onOutputsChange={setDrainOutputs}
      />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-3 text-sm font-medium text-slate-700 dark:text-slate-200">{title}</div>
      {children}
    </div>
  );
}
