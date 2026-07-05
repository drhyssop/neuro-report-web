'use client';

import { useState, useRef, useEffect } from 'react';
import { RegionTabs } from './RegionTabs';
import { LumbarForm } from './LumbarForm';
import { CervicalForm } from './CervicalForm';
import { ThoracicForm } from './ThoracicForm';
import { BrainForm } from './BrainForm';
import { createClient } from '@/lib/supabase/client';
import { patientRepository } from '@/lib/repositories/patientRepository';
import { buildSymptomList, buildPhysicalList } from '@/lib/services/examFormatters';
import type {
  ExamRegions,
  Region,
  LumbarExam,
  CervicalExam,
  ThoracicExam,
  BrainExam,
} from '@/types/domain';

interface Props {
  patientId: string;
  initialBaseline: ExamRegions;
  initialActiveRegion: Region;
}

/**
 * "기존 증상" (입원 시 baseline) 섹션.
 * - 기본은 읽기 모드: 증상 요약을 보여줌
 * - "편집" 누르면 region 탭 + Form 으로 입력/수정 → patients.baseline_regions 저장
 * - 입원 시 한 번 채우고, 추가 정보 생기면 다시 편집
 */
export function BaselineSection({ patientId, initialBaseline, initialActiveRegion }: Props) {
  const [editing, setEditing] = useState(false);
  const [baseline, setBaseline] = useState<ExamRegions>(initialBaseline);
  const [active, setActive] = useState<Region>(initialActiveRegion);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [hasUnsaved, setHasUnsaved] = useState(false);

  const saveTimer = useRef<NodeJS.Timeout | null>(null);
  const baselineRef = useRef(baseline);
  baselineRef.current = baseline;
  const hasUnsavedRef = useRef(hasUnsaved);
  hasUnsavedRef.current = hasUnsaved;

  // unmount 시 미저장 변경 강제 저장
  useEffect(() => {
    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
      if (hasUnsavedRef.current) {
        void save(baselineRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save(next: ExamRegions) {
    setSaving(true);
    try {
      const supabase = createClient();
      await patientRepository.updateBaselineRegions(supabase, patientId, next);
      setSavedAt(new Date());
      setHasUnsaved(false);
    } catch (err) {
      console.error('[BASELINE SAVE] 실패:', err);
      alert('기존 증상 저장 실패: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSaving(false);
    }
  }

  function scheduleSave(next: ExamRegions) {
    setHasUnsaved(true);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void save(next), 800);
  }

  function updateRegion<K extends keyof ExamRegions>(key: K, data: ExamRegions[K]) {
    const next = { ...baseline, [key]: data };
    setBaseline(next);
    scheduleSave(next);
  }

  const { symptoms: rawSymptoms } = buildSymptomList(baseline);
  // '통증 없음' 한 항목뿐이면 증상 줄을 숨기기 위해 필터
  const symptoms = rawSymptoms.filter((s) => s !== '통증 없음');
  const physical = buildPhysicalList(baseline);
  // 각 region의 History(hx) 텍스트를 모음 (입력한 그대로 배너에 노출)
  const historyText = (['brain', 'cervical', 'thoracic', 'lumbar'] as const)
    .map((r) => {
      const exam = baseline[r] as { hx?: string } | undefined;
      return exam?.hx?.trim() || '';
    })
    .filter(Boolean)
    .join(' / ');
  const hasContent = symptoms.length > 0 || physical.length > 0 || historyText.length > 0;

  const hasData = {
    brain: !!baseline.brain && Object.keys(baseline.brain).length > 0,
    cervical: !!baseline.cervical && Object.keys(baseline.cervical).length > 0,
    thoracic: !!baseline.thoracic && Object.keys(baseline.thoracic).length > 0,
    lumbar: !!baseline.lumbar && Object.keys(baseline.lumbar).length > 0,
  };

  return (
    <div className="rounded-lg border-2 border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/50">
      {/* 헤더 */}
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            📋 기존 증상 (입원 시)
          </span>
          {editing && saving && (
            <span className="text-[10px] text-slate-400">저장 중…</span>
          )}
          {editing && !saving && savedAt && (
            <span className="text-[10px] text-slate-400">
              저장됨 {savedAt.toLocaleTimeString('ko-KR', { hour12: false })}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setEditing((e) => !e)}
          className="rounded-md border border-slate-300 px-3 py-1 text-xs dark:border-slate-600 dark:text-slate-300"
        >
          {editing ? '완료' : '편집'}
        </button>
      </div>

      {/* 읽기 모드 — 요약 */}
      {!editing && (
        <div className="px-4 py-3 text-sm">
          {!hasContent ? (
            <p className="text-slate-400 dark:text-slate-500">
              입원 시 기존 증상이 입력되지 않았습니다. &quot;편집&quot;을 눌러 입력하세요.
            </p>
          ) : (
            <div className="space-y-1.5">
              {historyText && (
                <div className="flex gap-2">
                  <span className="shrink-0 font-medium text-slate-500 dark:text-slate-400">History:</span>
                  <span className="whitespace-pre-wrap text-slate-700 dark:text-slate-200">
                    {historyText}
                  </span>
                </div>
              )}
              {symptoms.length > 0 && (
                <div className="flex gap-2">
                  <span className="shrink-0 font-medium text-slate-500 dark:text-slate-400">증상:</span>
                  <span className="text-slate-700 dark:text-slate-200">
                    {symptoms.join(', ')}
                  </span>
                </div>
              )}
              <div className="flex gap-2">
                <span className="shrink-0 font-medium text-slate-500 dark:text-slate-400">Physical:</span>
                <span className="text-slate-700 dark:text-slate-200">
                  {physical.length > 0 ? (
                    physical.join(', ')
                  ) : (
                    <span className="text-emerald-600 dark:text-emerald-400">intact</span>
                  )}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 편집 모드 — Form */}
      {editing && (
        <div className="space-y-3 p-3">
          <RegionTabs active={active} onChange={setActive} hasData={hasData} />
          {active === 'brain' && (
            <BrainForm
              value={(baseline.brain ?? {}) as BrainExam}
              onChange={(v) => updateRegion('brain', v)}
              collapsibleNeuro
            />
          )}
          {active === 'cervical' && (
            <CervicalForm
              value={(baseline.cervical ?? {}) as CervicalExam}
              onChange={(v) => updateRegion('cervical', v)}
              collapsibleNeuro
            />
          )}
          {active === 'thoracic' && (
            <ThoracicForm
              value={(baseline.thoracic ?? {}) as ThoracicExam}
              onChange={(v) => updateRegion('thoracic', v)}
              collapsibleNeuro
            />
          )}
          {active === 'lumbar' && (
            <LumbarForm
              value={(baseline.lumbar ?? {}) as LumbarExam}
              onChange={(v) => updateRegion('lumbar', v)}
              collapsibleNeuro
            />
          )}
        </div>
      )}
    </div>
  );
}
