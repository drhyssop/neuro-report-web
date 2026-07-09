import {
  roundingSortKey,
  computePod,
  surgeryStatus,
  formatSurgeryDateNatural,
  antibioticShort,
  antibioticDays,
  formatMedications,
  formatLabs,
} from '@/types/domainV2';
import type {
  AntibioticEntry,
  DrainTube,
  DrainOutputs,
  ConsultReferral,
  Medications,
  Labs,
} from '@/types/domainV2';
import { detectChanges, describeChanges } from './diffDetector';
import type { ExamRegions } from '@/types/domain';
import {
  formatDrainsLog,
  buildSymptomList,
  buildPhysicalList,
  buildPhysicalGrouped,

} from './examFormatters';

export interface PatientReportData {
  id: string;
  alias: string;
  ward: string | null;
  bedSeat: number | null;
  age: number | null;
  sex: string | null;
  hospitalDay: number;
  pastOpHistory: string | null;
  surgeryName: string | null;
  surgeryStatus: 'planned' | 'done' | null;
  surgeryDateNatural: string | null;
  pod: number | null;
  drainsText: string;     // 'Rt JP(1) 50 / Lt JP(1) 40 (← 70/50)' or ''
  drainsActive: number;   // 활성 drain 수
  fever: boolean;
  feverTemp: number | null;
  ongoingAntibiotics: Array<{ short: string; days: number; startedAt: string }>;
  isConsult: boolean;
  consultDept: string | null;
  consultHistory: string | null;
  // 회진 확인 + 오늘 변화
  reviewed: boolean;
  hasChange: boolean;
  changeBits: {
    worsened: string[];
    improved: string[];
    other: string[];
  };
  symptoms: string[];
  physical: string[];
  historyHx: string;
  notesToday: string;
  // baseline (입원 시 기존 증상/physical)
  baselineSymptoms: string[];
  baselinePhysical: string[];
  baselinePhysicalGroups: { label: string; items: string[]; severe?: boolean }[];
  // 참고 정보
  patientMemo: string | null;
  // 오늘 소견 (서술형, 오늘자 exam의 daily_note)
  dailyNote: string | null;
  // 타과 협진 의뢰 (날짜순 desc)
  consults: ConsultReferral[];
  // 참고 정보 추가
  bmd: string | null;
  medicationsText: string;
  labsText: string;
}

interface PatientRow {
  id: string;
  alias: string;
  ward: string | null;
  bed_seat?: number | null;
  age: number | null;
  sex: string | null;
  admitted_at: string;
  past_op_history?: string | null;
  surgery_name?: string | null;
  surgery_date?: string | null;
  bmd?: string | null;
  is_consult?: boolean | null;
  consult_dept?: string | null;
  consult_history?: string | null;
  patient_memo?: string | null;
  medications?: unknown;
  antibiotics_log?: unknown;
  drains_log?: unknown;
  consults_log?: unknown;
  baseline_regions?: unknown;
}

export function collectReports(
  patients: PatientRow[],
  examsByPatient: Map<string, Record<string, unknown>[]>,
  todayDate: Date,
): PatientReportData[] {
  const sorted = [...patients].sort(
    (a, b) => roundingSortKey(a.ward, a.bed_seat ?? null) - roundingSortKey(b.ward, b.bed_seat ?? null),
  );

  return sorted.map((p) => {
    const exams = examsByPatient.get(p.id) ?? [];
    // 가장 최근 exam을 "현재 상태"로 간주 — 오늘 입력 안 했어도 마지막 상태가 환자일보에 유지됨
    const latestExam = exams.length > 0 ? exams[0] : undefined; // findByPatient는 desc 정렬
    const priorExams = exams.slice(1);
    const baseline = (p.baseline_regions ?? {}) as ExamRegions;

    const admittedDate = new Date(p.admitted_at);
    const hd =
      Math.floor(
        (todayDate.getTime() - admittedDate.getTime()) / (24 * 60 * 60 * 1000),
      ) + 1;

    // Drain — 새 모델. latest exam의 drain_outputs를 "현재 cc"로
    const drainsLog = (p.drains_log as DrainTube[] | null) ?? [];
    const todayOutputs = (latestExam?.drain_outputs as DrainOutputs | undefined) ?? {};
    // drain 직전값: 각 drain마다 가장 최근 "기록이 있는" 이전 exam의 값 (전날 대비 표시용)
    const prevDrainOutputs: DrainOutputs = {};
    for (const d of drainsLog) {
      for (const e of priorExams) {
        const out = (e.drain_outputs as DrainOutputs | undefined) ?? {};
        if (out[d.id] != null) {
          prevDrainOutputs[d.id] = out[d.id];
          break;
        }
      }
    }
    const drainsText = formatDrainsLog(drainsLog, todayOutputs, prevDrainOutputs);
    const drainsActive = drainsLog.filter((d) => !d.ended_at).length;

    // 증상 변화 — 오늘 exam이 있을 때만 (latest가 오늘자) 의미가 있다.
    const todayStr = todayDate.toISOString().slice(0, 10);
    const latestIsToday = latestExam?.exam_date === todayStr;
    // 회진 확인: 오늘자 exam이 있고 reviewed_at이 찍혀 있으면 확인됨.
    const reviewed = latestIsToday && latestExam?.reviewed_at != null;

    // 변화는 "입원시(baseline) 대비"로 비교 — latest exam 기준으로 항상 계산.
    // 빈 exam과 비교해 baseline 전체가 변화로 잡히던 문제를 원천 차단.
    let changeBits = { worsened: [] as string[], improved: [] as string[], other: [] as string[] };
    if (latestExam) {
      const changes = detectChanges(baseline, (latestExam.regions ?? {}) as ExamRegions);
      changeBits = describeChanges(changes);
    }
    const hasChange =
      changeBits.worsened.length > 0 ||
      changeBits.improved.length > 0 ||
      changeBits.other.length > 0;

    const antibioticsLog = (p.antibiotics_log as AntibioticEntry[] | null) ?? [];
    const ongoing = antibioticsLog
      .filter((e) => !e.ended_at)
      .map((e) => ({
        short: antibioticShort(e.name),
        days: antibioticDays(e, todayDate),
        startedAt: e.started_at,
      }));

    const regions = (latestExam?.regions ?? {}) as ExamRegions;
    const { symptoms } = buildSymptomList(regions);
    const physical = buildPhysicalList(regions);

    // baseline (입원 시 기존 증상) — 오늘 증상과 동일한 리치 포맷 사용
    const { symptoms: blSymRaw } = buildSymptomList(baseline);
    const baselineSymptoms = blSymRaw.filter((s) => s !== '통증 없음');
    const baselinePhysical = buildPhysicalList(baseline);
    const baselinePhysicalGroups = buildPhysicalGrouped(baseline);

    const notes: string[] = [];
    const hxBits: string[] = [];
    for (const r of ['brain', 'cervical', 'thoracic', 'lumbar'] as const) {
      const exam = regions[r];
      if (!exam) continue;
      if ('hx' in exam && exam.hx) hxBits.push(exam.hx);
      if ('notes' in exam && exam.notes) notes.push(exam.notes);
    }

    return {
      id: p.id,
      alias: p.alias,
      ward: p.ward,
      bedSeat: (p.bed_seat as number | null) ?? null,
      age: p.age,
      sex: p.sex,
      hospitalDay: hd,
      pastOpHistory: p.past_op_history ?? null,
      surgeryName: p.surgery_name ?? null,
      surgeryStatus: surgeryStatus(p.surgery_date, todayDate),
      surgeryDateNatural: formatSurgeryDateNatural(p.surgery_date, todayDate),
      pod: computePod(p.surgery_date, todayDate),
      drainsText,
      drainsActive,
      fever: !!latestExam?.fever,
      feverTemp: (latestExam?.fever_temp as number | null) ?? null,
      ongoingAntibiotics: ongoing,
      isConsult: !!p.is_consult,
      consultDept: p.consult_dept ?? null,
      consultHistory: p.consult_history ?? null,
      reviewed,
      hasChange,
      changeBits,
      symptoms,
      physical,
      historyHx: hxBits.join(' / '),
      notesToday: notes.join(' / '),
      baselineSymptoms: baselineSymptoms,
      baselinePhysical: baselinePhysical,
      baselinePhysicalGroups: baselinePhysicalGroups,
      patientMemo: p.patient_memo ?? null,
      dailyNote: (latestExam?.daily_note as string | null) ?? null,
      consults: [...((p.consults_log as ConsultReferral[] | null) ?? [])].sort((a, b) =>
        a.date < b.date ? 1 : -1,
      ),
      bmd: (p.bmd as string | null) ?? null,
      medicationsText: formatMedications(p.medications as Medications | null),
      labsText: formatLabs((latestExam?.labs as Labs | undefined) ?? null),
    };
  });
}

/**
 * 환자일보 메인 줄 (1줄).
 * [협진(GI)] [병동] 이름 35M (HD#3) (s/p past op) · 수술명 (POD #N or 예정일) · drain · 발열 · 증상변화 · abx
 */
export function reportMainLine(r: PatientReportData): string {
  const parts: string[] = [];
  if (r.isConsult) parts.push(`[협진(${r.consultDept || ''})]`);

  const head = r.ward ? `[${r.ward}] ${r.alias}` : r.alias;
  parts.push(head);

  const ageStr = r.age != null ? `${r.age}${r.sex || ''}` : '';
  const hdStr = `HD#${r.hospitalDay}`;
  if (ageStr) parts.push(`${ageStr} (${hdStr})`);
  else parts.push(`(${hdStr})`);

  const pastOp = r.pastOpHistory ? `s/p ${r.pastOpHistory}` : null;
  if (r.surgeryName) {
    const pieces: string[] = [];
    if (pastOp) pieces.push(`(${pastOp})`);
    if (r.surgeryStatus === 'done' && r.pod !== null) {
      pieces.push(`${r.surgeryName} (POD #${r.pod})`);
    } else if (r.surgeryStatus === 'planned' && r.surgeryDateNatural) {
      pieces.push(`${r.surgeryName} (${r.surgeryDateNatural} 예정)`);
    } else {
      pieces.push(r.surgeryName);
    }
    parts.push(pieces.join(' '));
  } else if (pastOp) {
    parts.push(`(${pastOp})`);
  }

  if (r.drainsText) parts.push(`drain: ${r.drainsText}`);

  if (r.fever) {
    parts.push(r.feverTemp ? `발열 ${r.feverTemp}°C` : '발열');
  } else {
    parts.push('발열 없음');
  }

  if (!r.reviewed) {
    parts.push('미확인');
  } else if (r.hasChange) {
    const cps: string[] = [];
    for (const t of r.changeBits.improved) cps.push(`▲${t}`);
    for (const t of r.changeBits.worsened) cps.push(`▼${t}`);
    for (const t of r.changeBits.other) cps.push(t);
    parts.push(cps.join(', '));
  } else {
    parts.push('증상변화 없음');
  }

  if (r.ongoingAntibiotics.length > 0) {
    const abxStr = r.ongoingAntibiotics.map((a) => `${a.short} ${a.days}d`).join(', ');
    parts.push(`abx: ${abxStr}`);
  }

  return parts.join(' · ');
}

/**
 * 환자일보 2줄 — 참고사항.
 * 순서: 협진 메모 · 증상 · 피지컬 · hx · notes
 */
export function reportSecondLine(r: PatientReportData): string {
  const bits: string[] = [];
  if (r.isConsult && r.consultHistory) bits.push(`협진 메모: ${r.consultHistory}`);
  if (r.symptoms.length > 0) bits.push(r.symptoms.join(', '));
  if (r.physical.length > 0) bits.push(r.physical.join(', '));
  if (r.historyHx) bits.push(`hx: ${r.historyHx}`);
  if (r.notesToday) bits.push(r.notesToday);
  return bits.join(' · ');
}

/**
 * 타과 협진 의뢰 한 건을 한 줄 텍스트로 (환자일보 텍스트복사/Word용).
 *   대기: "CM(5/26 의뢰): 폐기능 저하 — 대기중"
 *   회신: "CM(5/26→5/27): 폐기능 저하 → 수술 가능"
 */
export function formatConsultLine(c: ConsultReferral): string {
  const d = c.date.slice(5);
  if (c.answer) {
    const ad = c.answered_at ? c.answered_at.slice(5) : '';
    return `${c.dept}(${d}→${ad}): ${c.content} → ${c.answer}`;
  }
  return `${c.dept}(${d} 의뢰): ${c.content} — 대기중`;
}
