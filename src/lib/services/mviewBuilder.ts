import {
  roundingSortKey,
  surgeryStatus,
  formatSurgeryDateNatural,
  computePod,
} from '@/types/domainV2';
import type { ImagingLogEntry, AntibioticEntry } from '@/types/domainV2';
import type { ExamRegions } from '@/types/domain';
import { buildSymptomList, buildPhysicalList } from '@/lib/services/examFormatters';
import { lookbackWindow, lookaheadWindow } from '@/lib/services/holidays';
import { dateToStr } from '@/lib/utils/date';

export interface MViewPatient {
  patientId: string;
  alias: string;
  ward: string | null;
  age: number | null;
  sex: string | null;
  isConsult: boolean;
  consultDept: string | null;
  pastOpHistory: string | null;
  surgeryName: string | null;
  surgeryLabel: string | null;
  surgeryType: 'general' | 'local';
  historyHx: string;
  symptoms: string[];
  physical: string[];
  imagingFindings: string[];
  followupFindings: string[];
  ongoingAbx: string[];
  consultHistory: string | null;
  patientMemo: string | null;
  isOnMview: boolean;
}

export interface MViewSection {
  title: string;
  accent: 'purple' | 'blue' | 'cyan' | 'amber' | 'green' | 'rose';
  patients: MViewPatient[];
}

/** 입력 환자 원본 (patients 테이블 row). 필요한 필드만 느슨하게 정의. */
export interface MViewInputPatient {
  id: string;
  alias: string;
  ward: string | null;
  bed_seat?: number | null;
  age: number | null;
  sex: string | null;
  is_consult?: boolean | null;
  consult_dept?: string | null;
  consult_history?: string | null;
  past_op_history?: string | null;
  surgery_name?: string | null;
  surgery_date?: string | null;
  surgery_type?: string | null;
  patient_memo?: string | null;
  is_on_mview?: boolean | null;
  admitted_at: string;
  mview_excluded_date?: string | null;
  baseline_regions?: unknown;
  imaging_log?: unknown;
  antibiotics_log?: unknown;
  drains_log?: unknown;
}

/** 영상 날짜 — 절대: "26.6.23" (YY.M.D, 앞자리 0 없음) */
function imgDateShort(date: string): string {
  const [y, m, d] = date.split('-');
  return `${y.slice(2)}.${parseInt(m, 10)}.${parseInt(d, 10)}`;
}

/** 영상 날짜 — 상대(F/U용): 오늘 / 어제 / Nd 전 */
function imgDateRelative(date: string, todayDate: Date): string {
  const d0 = new Date(date + 'T00:00:00');
  const t = new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate());
  const diff = Math.round((t.getTime() - d0.getTime()) / 86400000);
  if (diff === 0) return '오늘';
  if (diff === 1) return '어제';
  if (diff > 1) return `${diff}d 전`;
  if (diff === -1) return '내일';
  return `${Math.abs(diff)}d 후`;
}

/**
 * 영상 표시 형식:
 *  - 수술 전/일반: "MRI: 소견 (26.6.23)"  (수술 전 표기 없음, 절대 날짜)
 *  - F/U:          "X-ray(f/u): 소견 (오늘/어제/2d 전)"  (상대 날짜)
 *  - 소견 없으면 콜론 생략: "MRI (26.6.23)"
 */
export function formatImaging(
  e: ImagingLogEntry,
  todayDate: Date,
): string {
  const isFu = e.kind === 'followup';
  const label = isFu ? `${e.modality}(f/u)` : e.modality;
  const dateStr = isFu ? imgDateRelative(e.date, todayDate) : imgDateShort(e.date);
  const body = e.findings ? `: ${e.findings}` : '';
  return `${label}${body} (${dateStr})`;
}

/** 원본 환자 → MViewPatient 변환. m-view 화면과 회진문서 출력이 공유. */
export function buildMViewPatient(p: MViewInputPatient, todayDate: Date): MViewPatient {
  const baseline = (p.baseline_regions ?? {}) as ExamRegions;

  const isLocal = p.surgery_type === 'local';
  let surgeryLabel: string | null = null;
  if (p.surgery_date) {
    const status = surgeryStatus(p.surgery_date, todayDate);
    const pod = computePod(p.surgery_date, todayDate);
    if (isLocal) {
      // 로컬(국소시술)은 입원 경과(POD)가 없으니 항상 수술 예정일을 자연어로 표시.
      const nat = formatSurgeryDateNatural(p.surgery_date, todayDate);
      surgeryLabel = nat ? `${nat}${status === 'planned' ? ' 예정' : ''}` : null;
    } else if (status === 'done' && pod !== null) {
      surgeryLabel = `POD #${pod}`;
    } else if (status === 'planned') {
      surgeryLabel = `${formatSurgeryDateNatural(p.surgery_date, todayDate)} 예정`;
    }
  }

  const hxBits: string[] = [];
  for (const r of ['brain', 'cervical', 'thoracic', 'lumbar'] as const) {
    const exam = baseline[r];
    if (exam && 'hx' in exam && exam.hx) hxBits.push(exam.hx as string);
  }

  const { symptoms: rawSym } = buildSymptomList(baseline);
  const symptoms = rawSym.filter((s) => s !== '통증 없음');
  const physical = buildPhysicalList(baseline);

  const imagingFindings: string[] = ((p.imaging_log as ImagingLogEntry[] | null) ?? [])
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((e) => formatImaging(e, todayDate));
  // F/U 카드용 — followup 검사만 (내린 검사 제외)
  const followupFindings: string[] = ((p.imaging_log as ImagingLogEntry[] | null) ?? [])
    .filter((e) => e.kind === 'followup' && e.mviewActive !== false)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((e) => formatImaging(e, todayDate));

  const log = (p.antibiotics_log as AntibioticEntry[] | null) ?? [];
  const ongoingAbx = log
    .filter((e) => !e.ended_at)
    .map((e) => {
      const start = new Date(e.started_at + 'T00:00:00');
      const days = Math.floor((todayDate.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1;
      return `${e.name} ${days}d`;
    });

  return {
    patientId: p.id,
    alias: p.alias,
    ward: p.ward,
    age: p.age,
    sex: p.sex,
    isConsult: !!p.is_consult,
    consultDept: p.consult_dept ?? null,
    pastOpHistory: p.past_op_history ?? null,
    surgeryName: p.surgery_name ?? null,
    surgeryLabel,
    surgeryType: isLocal ? 'local' : 'general',
    historyHx: hxBits.join(' / '),
    symptoms,
    physical,
    imagingFindings,
    followupFindings,
    ongoingAbx,
    consultHistory: p.consult_history ?? null,
    patientMemo: p.patient_memo ?? null,
    isOnMview: !!p.is_on_mview,
  };
}

/**
 * 원본 환자 목록 → m-view 섹션들. m-view 화면과 회진문서 출력이 이 함수 하나를 공유하므로
 * 분류 규칙이 절대 어긋나지 않는다.
 */
export function buildMViewSections(
  patients: MViewInputPatient[],
  todayDate: Date,
  holidaySet: Set<string> = new Set(),
): MViewSection[] {
  const today = dateToStr(todayDate);

  // 공휴일/주말을 건너뛴 회진 창
  const lookback = lookbackWindow(todayDate, holidaySet); // drain 제거 / f/u 검사
  const lookahead = lookaheadWindow(todayDate, holidaySet); // 수술예정

  const sortByWard = <T extends { ward: string | null; bed_seat?: number | null }>(arr: T[]) =>
    [...arr].sort(
      (a, b) =>
        roundingSortKey(a.ward, a.bed_seat ?? null) - roundingSortKey(b.ward, b.bed_seat ?? null),
    );

  const build = (p: MViewInputPatient) => buildMViewPatient(p, todayDate);

  // 수술 섹션 전용 정렬: G(일반) 먼저 → L(로컬) 나중, 각 그룹 내 병동 순서.
  const sortSurgery = (arr: MViewInputPatient[]) =>
    [...arr].sort((a, b) => {
      const la = a.surgery_type === 'local' ? 1 : 0;
      const lb = b.surgery_type === 'local' ? 1 : 0;
      if (la !== lb) return la - lb;
      return roundingSortKey(a.ward, a.bed_seat ?? null) - roundingSortKey(b.ward, b.bed_seat ?? null);
    });

  // 오늘 m-view에서 제외된 환자(mview_excluded_date === today)는 모든 섹션에서 숨김
  const visible = patients.filter((p) => (p.mview_excluded_date ?? null) !== today);

  const todaySurgery = sortSurgery(visible.filter((p) => p.surgery_date === today)).map(build);
  // 수술예정: 다음 회진 전까지 예정된 수술 (공휴일 건너뜀)
  const upcomingSurgery = sortSurgery(
    visible.filter((p) => p.surgery_date != null && lookahead.has(p.surgery_date)),
  ).map(build);
  // F/U: f/u 검사일이 회진 창(뒤돌아보기) 안이면 자동 노출. 창을 벗어나면 자동으로 안 뜸.
  //   - mviewActive === false : 내림 (창 안이라도 숨김)
  //   - mviewActive === true  : 수동 강제 노출 (창 밖이어도 표시 — 특이 사정용)
  //   - 그 외(기본)           : 창 안일 때만 표시
  const fuVisible = (e: ImagingLogEntry): boolean => {
    if (e.kind !== 'followup') return false;
    if (e.mviewActive === false) return false;
    if (e.mviewActive === true) return true;
    return lookback.has(e.date);
  };
  const followupImaging = sortByWard(
    visible.filter((p) => ((p.imaging_log as ImagingLogEntry[] | null) ?? []).some(fuVisible)),
  ).map(build);
  const drainRemoved = sortByWard(
    visible.filter((p) => {
      const log = (p.drains_log as { ended_at?: string | null }[] | null) ?? [];
      if (log.length === 0) return false;
      // 아직 active drain이 남아있으면 제외 (모두 제거됐을 때만)
      const anyActive = log.some((d) => !d.ended_at);
      if (anyActive) return false;
      // 모두 제거됨 — 제거 완료가 회진 창 안이면 노출 (공휴일 건너뜀)
      return log.some((d) => d.ended_at != null && lookback.has(d.ended_at));
    }),
  ).map(build);
  const consult = sortByWard(visible.filter((p) => p.is_consult)).map(build);

  const usedIds = new Set<string>([
    ...todaySurgery.map((x) => x.patientId),
    ...upcomingSurgery.map((x) => x.patientId),
    ...followupImaging.map((x) => x.patientId),
    ...drainRemoved.map((x) => x.patientId),
    ...consult.map((x) => x.patientId),
  ]);
  const manualAdded = sortByWard(
    visible.filter((p) => p.is_on_mview && !usedIds.has(p.id)),
  ).map(build);

  return [
    { title: '오늘 수술', accent: 'purple', patients: todaySurgery },
    {
      title: '수술 예정 (다음 회진 전)',
      accent: 'blue',
      patients: upcomingSurgery,
    },
    { title: 'F/U 검사 환자', accent: 'green', patients: followupImaging },
    { title: 'Drain 제거', accent: 'cyan', patients: drainRemoved },
    { title: '협진 환자', accent: 'amber', patients: consult },
    { title: '수동 추가', accent: 'rose', patients: manualAdded },
  ];
}
