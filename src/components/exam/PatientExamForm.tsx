'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { RegionTabs } from './RegionTabs';
import { LumbarForm } from './LumbarForm';
import { CervicalForm } from './CervicalForm';
import { ThoracicForm } from './ThoracicForm';
import { BrainForm } from './BrainForm';
import { DailyExtras } from './DailyExtras';
import { createClient } from '@/lib/supabase/client';
import { examRepository } from '@/lib/repositories/examRepository';
import { detectChanges } from '@/lib/services/diffDetector';
import { generateSoapNote } from '@/lib/services/noteGenerator';
import { ChangeBanner } from './ChangeBanner';
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
  patientAlias: string;
  diagnosis: string | null;
  examId: string;
  examDate: string;
  hospitalDay: number | null;
  initialRegions: ExamRegions;
  yesterdayRegions: ExamRegions | null;
  baselineRegions: ExamRegions | null;
  initialActiveRegion: Region;
  initialReviewedAt?: string | null;
  initialDailyNote?: string | null;
  initialExtras?: {
    fever?: boolean;
    fever_temp?: number | null;
    drainOutputs?: import('@/types/domainV2').DrainOutputs;
    labs?: import('@/types/domainV2').Labs;
  };
  drainsLog: import('@/types/domainV2').DrainTube[];
  yesterdayDrainOutputs: import('@/types/domainV2').DrainOutputs;
  examHistory: Array<{ exam_date: string; drain_outputs?: import('@/types/domainV2').DrainOutputs }>;
}

export function PatientExamForm(props: Props) {
  const [active, setActive] = useState<Region>(props.initialActiveRegion);
  const [regions, setRegions] = useState<ExamRegions>(props.initialRegions);
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [hasUnsaved, setHasUnsaved] = useState(false);
  // 오늘 회진에서 이 환자를 확인했는지 (변화 입력 or "변화 없음" 버튼)
  const [reviewed, setReviewed] = useState<boolean>(!!props.initialReviewedAt);
  // 오늘 소견 (서술형 자유 메모) — exam 레벨, 탭 전환에도 유지
  const [dailyNote, setDailyNote] = useState<string>(props.initialDailyNote ?? '');
  const noteTimer = useRef<NodeJS.Timeout | null>(null);

  const saveTimer = useRef<NodeJS.Timeout | null>(null);
  // 디바운스 저장 시 reviewed로 기록할지 여부 (자동채움은 false)
  const pendingReviewRef = useRef<boolean>(true);

  // 핵심: regions와 hasUnsaved의 최신 값을 ref에 동기화.
  // unmount cleanup 등에서 stale closure 문제를 막기 위함.
  const regionsRef = useRef(regions);
  regionsRef.current = regions;
  const hasUnsavedRef = useRef(hasUnsaved);
  hasUnsavedRef.current = hasUnsaved;
  const dailyNoteRef = useRef(dailyNote);
  dailyNoteRef.current = dailyNote;

  // Realtime 구독 제거 — last-write-wins 정책.
  // 여러 기기에서 같은 환자 동시 입력은 거의 없는 시나리오이고,
  // 있더라도 마지막 저장이 항상 DB의 최종 상태가 되어야 한다.
  // (다른 기기에서 화면 새로고침하면 DB의 최신 상태가 자동으로 보임)

  // 페이지 떠나기 전 경고 (미저장 변경이 있을 때만)
  useEffect(() => {
    function beforeUnload(e: BeforeUnloadEvent) {
      if (hasUnsaved) {
        e.preventDefault();
        e.returnValue = '';
      }
    }
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [hasUnsaved]);

  const changes = useMemo(
    () => (props.yesterdayRegions ? detectChanges(props.yesterdayRegions, regions) : []),
    [props.yesterdayRegions, regions],
  );
  const worsened = changes.filter((c) => c.kind === 'worsened').length;
  const improved = changes.filter((c) => c.kind === 'improved').length;

  function scheduleSave(next: ExamRegions, markReviewed = true) {
    setHasUnsaved(true);
    pendingReviewRef.current = markReviewed;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void save(next, pendingReviewRef.current);
    }, 800);
  }

  async function save(next: ExamRegions, markReviewed = true) {
    setSaving(true);
    const supabase = createClient();
    try {
      const note = generateSoapNote({
        patientAlias: props.patientAlias,
        diagnosis: props.diagnosis ?? undefined,
        examDate: props.examDate,
        hospitalDay: props.hospitalDay ?? undefined,
        regions: next,
        changes: props.yesterdayRegions ? detectChanges(props.yesterdayRegions, next) : [],
      });
      await examRepository.updateRegions(supabase, props.examId, next, note, markReviewed);
      setLastSavedAt(new Date());
      setHasUnsaved(false);
      if (markReviewed) setReviewed(true);
    } catch (err) {
      console.error('[SAVE] 실패:', err);
      alert('저장 실패! Console에서 에러를 확인해주세요.\n' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSaving(false);
    }
  }

  // 수동 저장 (저장 버튼)
  async function saveNow() {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    await save(regions);
  }

  // 페이지 떠날 때 마지막 저장 강제
  // ref를 사용해야 stale closure 문제를 피할 수 있다.
  // hasUnsaved가 false이면 (이미 저장 완료) cleanup에서 save를 다시 호출하지 않는다.
  useEffect(() => {
    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
      // 미저장 변경이 있을 때만 마지막 저장.
      // 이미 저장된 상태라면 redundant save로 빈 객체로 덮어쓰는 사고를 막음.
      if (hasUnsavedRef.current) {
        void save(regionsRef.current);
      }
      // 오늘 소견 디바운스가 살아있으면 즉시 저장
      if (noteTimer.current) {
        clearTimeout(noteTimer.current);
        noteTimer.current = null;
        const supabase = createClient();
        void examRepository.updateExtras(supabase, props.examId, {
          daily_note: dailyNoteRef.current || null,
        });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * 부위 단위 업데이트. Last-write-wins 정책이라 단순함.
   */
  function updateRegion<K extends keyof ExamRegions>(
    key: K,
    data: ExamRegions[K],
    markReviewed = true,
  ) {
    const next = { ...regions, [key]: data };
    setRegions(next);
    scheduleSave(next, markReviewed);
  }

  // "변화 없음" — 어제와 동일함을 확인만 기록 (regions 변경 없음)
  async function markNoChange() {
    const supabase = createClient();
    try {
      await examRepository.markReviewed(supabase, props.examId);
      setReviewed(true);
      setLastSavedAt(new Date());
    } catch (err) {
      console.error('[REVIEW] 실패:', err);
      alert('회진 확인 기록 실패! ' + (err instanceof Error ? err.message : String(err)));
    }
  }

  // 기존 증상(baseline)을 오늘 폼으로 불러오기.
  // 자동 시드(이전 검사 없을 때)로 대부분 커버되지만,
  // baseline을 회진 시작 후 입력했거나 오늘 값을 baseline 기준으로 되돌리고 싶을 때 사용.
  function loadBaseline() {
    if (!props.baselineRegions || Object.keys(props.baselineRegions).length === 0) {
      alert('입원 시 기존 증상이 입력되어 있지 않습니다. 먼저 위의 "기존 증상"을 입력하세요.');
      return;
    }
    if (
      !confirm(
        '오늘 증상을 입원 시 기존 증상 값으로 채웁니다. 오늘 입력한 내용은 덮어쓰여집니다. 계속할까요?',
      )
    )
      return;
    const next = JSON.parse(JSON.stringify(props.baselineRegions)) as ExamRegions;
    setRegions(next);
    scheduleSave(next);
  }

  // 오늘 소견 저장 (디바운스). 소견 작성은 회진 확인으로 간주.
  function onDailyNoteChange(text: string) {
    setDailyNote(text);
    if (noteTimer.current) clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(() => {
      void (async () => {
        try {
          const supabase = createClient();
          await examRepository.updateExtras(supabase, props.examId, { daily_note: text || null });
          await examRepository.markReviewed(supabase, props.examId);
          setReviewed(true);
          setLastSavedAt(new Date());
        } catch (err) {
          console.error('[NOTE] 저장 실패:', err);
        }
      })();
    }, 800);
  }

  const hasData = {
    brain: !!regions.brain && Object.keys(regions.brain).length > 0,
    cervical: !!regions.cervical && Object.keys(regions.cervical).length > 0,
    thoracic: !!regions.thoracic && Object.keys(regions.thoracic).length > 0,
    lumbar: !!regions.lumbar && Object.keys(regions.lumbar).length > 0,
  };

  return (
    <div className="space-y-4">
      {/* 변화 양상 배너 — 기존 대비 + 어제 대비 (+추이 버튼) */}
      <ChangeBanner
        baseline={props.baselineRegions}
        yesterday={props.yesterdayRegions}
        today={regions}
        trendHref={`/patient/${props.patientId}/trend`}
      />

      {/* 상태 바 */}
      <div className="flex items-center justify-between rounded-md bg-white px-3 py-2 text-xs dark:bg-slate-900">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            🩺 오늘 증상
          </span>
          {reviewed ? (
            <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              ✓ 회진 확인됨
            </span>
          ) : (
            <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[11px] text-amber-700 dark:bg-amber-950 dark:text-amber-300">
              미확인
            </span>
          )}
          <button
            type="button"
            onClick={loadBaseline}
            className="rounded border border-slate-300 px-2 py-0.5 text-[11px] text-slate-600 dark:border-slate-600 dark:text-slate-300"
            title="입원 시 기존 증상 값으로 오늘 폼을 채웁니다"
          >
            기존 증상 불러오기
          </button>
        </div>
        <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500">
          {saving ? (
            <span>저장 중…</span>
          ) : hasUnsaved ? (
            <span className="text-amber-600 dark:text-amber-400">⚠ 미저장 변경</span>
          ) : lastSavedAt ? (
            <span>저장됨 · {lastSavedAt.toLocaleTimeString('ko-KR', { hour12: false })}</span>
          ) : (
            <span>자동 저장</span>
          )}
        </div>
      </div>

      {/* 오늘 소견 — 서술형 자유 메모 (exam 레벨, 탭 전환에도 유지). 회진문서에 노출됨 */}
      <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
        <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
          오늘 소견 / 기타 메모
        </label>
        <textarea
          value={dailyNote}
          onChange={(e) => onDailyNoteChange(e.target.value)}
          placeholder='서술형으로 자유롭게. 예: "저린감은 좋아졌는데 통증은 아직 있다", "보행 시작함"'
          rows={2}
          className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
        />
      </div>

      <RegionTabs active={active} onChange={setActive} hasData={hasData} />

      {/* DailyExtras를 모든 region form에 주입 — examId 동일하므로 어느 탭이든 같은 데이터 */}
      {(() => {
        const dailyExtras = (
          <DailyExtras
            patientId={props.patientId}
            examId={props.examId}
            initial={{
              fever: props.initialExtras?.fever,
              fever_temp: props.initialExtras?.fever_temp,
              drainOutputs: props.initialExtras?.drainOutputs ?? {},
              labs: props.initialExtras?.labs ?? {},
            }}
            drainsLog={props.drainsLog}
            yesterdayDrainOutputs={props.yesterdayDrainOutputs}
            examHistory={props.examHistory}
          />
        );

        if (active === 'brain')
          return (
            <BrainForm
              value={(regions.brain ?? {}) as BrainExam}
              yesterday={props.yesterdayRegions?.brain as BrainExam | undefined}
              onChange={(v) => updateRegion('brain', v)}
              onAutoInit={(v) => updateRegion('brain', v, false)}
              collapsibleNeuro
              hideHistory
              dailyExtras={dailyExtras}
            />
          );
        if (active === 'cervical')
          return (
            <CervicalForm
              value={(regions.cervical ?? {}) as CervicalExam}
              yesterday={props.yesterdayRegions?.cervical as CervicalExam | undefined}
              onChange={(v) => updateRegion('cervical', v)}
              onAutoInit={(v) => updateRegion('cervical', v, false)}
              collapsibleNeuro
              hideHistory
              dailyExtras={dailyExtras}
            />
          );
        if (active === 'thoracic')
          return (
            <ThoracicForm
              value={(regions.thoracic ?? {}) as ThoracicExam}
              yesterday={props.yesterdayRegions?.thoracic as ThoracicExam | undefined}
              onChange={(v) => updateRegion('thoracic', v)}
              onAutoInit={(v) => updateRegion('thoracic', v, false)}
              collapsibleNeuro
              hideHistory
              dailyExtras={dailyExtras}
            />
          );
        if (active === 'lumbar')
          return (
            <LumbarForm
              value={(regions.lumbar ?? {}) as LumbarExam}
              yesterday={props.yesterdayRegions?.lumbar as LumbarExam | undefined}
              onChange={(v) => updateRegion('lumbar', v)}
              onAutoInit={(v) => updateRegion('lumbar', v, false)}
              collapsibleNeuro
              hideHistory
              dailyExtras={dailyExtras}
            />
          );
        return null;
      })()}

      <div className="flex gap-2 pt-2">
        <button
          type="button"
          onClick={saveNow}
          disabled={saving || !hasUnsaved}
          className="rounded-md bg-slate-900 px-4 py-1.5 text-xs font-medium text-white disabled:opacity-40 dark:bg-slate-100 dark:text-slate-900"
        >
          {saving ? '저장 중…' : hasUnsaved ? '저장' : '저장됨'}
        </button>
        <button
          type="button"
          onClick={markNoChange}
          disabled={reviewed && !hasUnsaved}
          className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs text-emerald-700 disabled:opacity-40 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
          title="어제와 동일함을 확인만 기록합니다 (증상 변경 없음)"
        >
          {reviewed ? '✓ 확인됨' : '변화 없음 (회진 확인)'}
        </button>
      </div>
    </div>
  );
}
