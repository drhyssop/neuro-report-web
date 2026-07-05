/**
 * v2 도메인 타입 — 환자 정보 확장, 일일 기록 항목
 *
 * 기존 domain.ts와 같이 사용. 점진적 확장.
 */

// ===== 환자 정보 확장 =====
export type Sex = 'M' | 'F';

export interface PreopImagingEntry {
  modality: 'X-ray' | 'CT' | 'MRI' | 'US' | 'Bone scan' | 'EMG/NCS' | 'Other';
  date?: string;     // YYYY-MM-DD
  findings?: string;
}

export interface PatientExtras {
  age?: number;
  sex?: Sex;
  ward?: string;             // '1013', '926' 등
  expectedDischarge?: string; // YYYY-MM-DD
  surgeryName?: string;
  surgeryDate?: string;       // 통합된 수술일 — 오늘 이전이면 실시, 이후면 예정
  isConsult?: boolean;
  consultDept?: string;      // 'EDDO' 등
  consultHistory?: string;
  patientMemo?: string;
  antibioticsLog?: AntibioticEntry[];  // 누적 항생제 기록
  imagingLog?: ImagingLogEntry[];      // 누적 영상 검사 (preop + followup)
}

// ===== 환자 단위 누적 기록 =====

/**
 * 항생제 한 회차 — 한 번 시작 ~ 종료까지.
 * ended_at이 null이면 현재 사용 중.
 */
export interface AntibioticEntry {
  name: string;              // 'refosporen' 등 ANTIBIOTIC_OPTIONS 중 하나, 또는 자유 입력
  started_at: string;        // YYYY-MM-DD
  ended_at?: string | null;  // null이면 진행 중
  note?: string;
}

/**
 * 영상 검사 한 건 — 수술 전이든 후든 통합.
 *   kind: 'preop' — 수술 전
 *         'followup' — 수술 후 / 일반 follow-up
 */
export interface ImagingLogEntry {
  modality: 'X-ray' | 'CT' | 'MRI' | 'US' | 'Bone scan' | 'EMG/NCS' | 'Other';
  date: string;
  findings?: string;
  kind: 'preop' | 'followup';
  /** f/u 검사를 m-view에 노출할지. false면 m-view에서 내림 (기본 true=노출) */
  mviewActive?: boolean;
}

// ===== 일일 검사 항목 (examinations 컬럼) =====

/**
 * Drain tube — 환자 단위 누적 (patient.drains_log).
 * 한 환자에 여러 drain이 있을 수 있고, 각 drain은 시작일 / 제거일을 가짐.
 *   id: 'drain_xxx' uuid
 *   index: 같은 type/side 안에서의 번호 (1, 2...) — UI 표시용
 */
export interface DrainTube {
  id: string;
  type: 'JP' | 'HV' | 'Other'; // HV = Hemovac
  side: 'Lt' | 'Rt' | 'Mid';
  index: number;
  started_at: string;          // YYYY-MM-DD
  ended_at?: string | null;    // 제거 날짜, null이면 사용 중
  note?: string;
}

/**
 * 타과 협진 의뢰 기록 (우리 입원환자 → 다른 과).
 * drain/antibiotics처럼 환자 단위로 누적되며 퇴원까지 유지된다.
 * m-view의 '협진 환자'(is_consult, 타과→우리)와는 완전히 별개.
 */
export interface ConsultReferral {
  id: string;
  date: string;                // 의뢰일 YYYY-MM-DD
  dept: string;                // 의뢰 과 (예: 'CM', 'CV', 'GS')
  content: string;             // 의뢰 사유/내용
  answer?: string | null;      // 회신 내용 (없으면 대기중)
  answered_at?: string | null; // 회신일 YYYY-MM-DD
}

/**
 * 매일의 drain 배액량 (cc) — examinations.drain_outputs JSONB.
 *   key: drain_id, value: cc (number)
 */
export type DrainOutputs = Record<string, number>;

// === legacy Drain (호환용) ===
export interface Drain {
  type: 'JP' | 'Hemovac' | 'Other';
  side: 'Lt' | 'Rt' | 'Mid';
  label?: string;        // 'JP-1', 'JP-2' 등 (Lt에 여러 개일 때 구분)
  output?: number;       // 배액량 mL
}

export interface FollowupImaging {
  modality: 'X-ray' | 'CT' | 'MRI' | 'US' | 'Other';
  findings?: string;
}

// 의국에서 자주 쓰는 항생제 (토글 선택지)
export const ANTIBIOTIC_OPTIONS = [
  'refosporen',
  'amikacin',
  'cycin',
  'vancomycin',
  'teicoplanin',
  'tabactam',
  'suprax (po)',
] as const;
export type Antibiotic = typeof ANTIBIOTIC_OPTIONS[number];

// 항생제 약어 매핑 — 보드/환자일보에 짧게 표시
export const ANTIBIOTIC_SHORT: Record<string, string> = {
  refosporen: 'Refo',
  amikacin: 'AMK',
  cycin: 'Cycin',
  vancomycin: 'Vanco',
  teicoplanin: 'Teico',
  tabactam: 'Tabactam',
  'suprax (po)': 'Suprax',
};

export function antibioticShort(name: string): string {
  const lc = name.toLowerCase().trim();
  if (ANTIBIOTIC_SHORT[lc]) return ANTIBIOTIC_SHORT[lc];
  // 자유 입력의 경우 첫 5글자 capitalize
  return name.charAt(0).toUpperCase() + name.slice(1, 5);
}

/**
 * 항생제 사용 일수 계산 — started_at부터 (ended_at ?? today)까지
 */
export function antibioticDays(
  entry: { started_at: string; ended_at?: string | null },
  asOf?: Date,
): number {
  const start = new Date(entry.started_at + 'T00:00:00');
  const end = entry.ended_at
    ? new Date(entry.ended_at + 'T00:00:00')
    : asOf ?? new Date();
  const ms = end.getTime() - start.getTime();
  return Math.max(0, Math.floor(ms / (24 * 60 * 60 * 1000))) + 1;
}

// ===== Sensory 재설계 — dermatome pain 기록 =====
export const PAIN_QUALITIES = [
  'tingling',       // 저림
  'shooting',       // 찌릿
  'dull',           // 둔통
  'sharp',          // 예리한 통증
  'radiating',      // 방사통
  'burning',        // 화끈
  'numbness',       // 무감각
] as const;
export type PainQuality = typeof PAIN_QUALITIES[number];

export const PAIN_QUALITY_KR: Record<PainQuality, string> = {
  tingling: '저림',
  shooting: '찌릿',
  dull: '둔통',
  sharp: '예리한 통증',
  radiating: '방사통',
  burning: '화끈',
  numbness: '무감각',
};

export interface DermatomePainEntry {
  dermatome: string;     // 'L4', 'L5', 'S1', 'C6' 등 (멀티선택은 콤마 join: "L4,L5")
  side: 'Lt' | 'Rt' | 'Bil';
  nrs?: number;          // 0-10
  qualities?: PainQuality[];
  /**
   * dermatome별 통증/저림 구분. 키 = dermatome(예: 'L4'), 값 = 'pain' | 'tingling'.
   * 키가 없으면 통증(pain)으로 간주 → 기존 데이터/대부분 케이스 호환.
   */
  dermatomeQualities?: Record<string, 'pain' | 'tingling'>;
  sameAsYesterday?: boolean;
  note?: string;
}

// ===== Motor에 매칭되는 myotome =====
export const CERVICAL_MYOTOME: Record<string, string> = {
  shoulder: 'C5',
  elbowFlex: 'C5/C6',
  elbowExt: 'C7',
  wristExt: 'C6',
  wristFlex: 'C7',
  grasp: 'C7/C8',
  fingerAbd: 'T1',
};

export const LUMBAR_MYOTOME: Record<string, string> = {
  hipFlex: 'L2',
  kneeExt: 'L3',
  kneeFlex: 'L5/S1',
  ankleDF: 'L4',
  ankleEHL: 'L5',
  anklePF: 'S1',
};

// Motor 항목 한글 라벨
export const CERVICAL_MOTOR_LABEL: Record<string, string> = {
  shoulder: 'Shoulder abd',
  elbowFlex: 'Elbow flex',
  elbowExt: 'Elbow ext',
  wristExt: 'Wrist ext',
  wristFlex: 'Wrist flex',
  grasp: 'Grasp',
  fingerAbd: 'Finger abd',
};

export const LUMBAR_MOTOR_LABEL: Record<string, string> = {
  hipFlex: 'Hip flex',
  kneeExt: 'Knee ext',
  kneeFlex: 'Knee flex',
  ankleDF: 'Ankle DF',
  ankleEHL: 'EHL',
  anklePF: 'Ankle PF',
};

// ===== 복용약 / lab =====
export interface Medications {
  lyrica?: number | null;        // 50 | 75 | 150 | 300, 켜졌지만 용량 미선택이면 0/null
  lyricaOn?: boolean;            // 용량 없이도 표시되게
  nucynta?: boolean;
  pelubi?: boolean;
  ultracet?: boolean;
  custom?: string[];            // 수동 추가 약
  osteo?: 'prolia' | 'evenity' | null; // 골다공증약 (단일선택)
}

export const OSTEO_LABEL: Record<'prolia' | 'evenity', string> = {
  prolia: '프롤리아',
  evenity: '이베니티',
};

/** 복용약을 "lyrica 50, nucynta, pelubi, ultracet, 이베니티" 형태로 */
export function formatMedications(m?: Medications | null): string {
  if (!m) return '';
  const bits: string[] = [];
  if (m.lyricaOn || m.lyrica) bits.push(m.lyrica ? `lyrica ${m.lyrica}` : 'lyrica');
  if (m.nucynta) bits.push('nucynta');
  if (m.pelubi) bits.push('pelubi');
  if (m.ultracet) bits.push('ultracet');
  for (const c of m.custom ?? []) if (c.trim()) bits.push(c.trim());
  if (m.osteo) bits.push(OSTEO_LABEL[m.osteo]); // 골다공증약은 마지막
  return bits.join(', ');
}

export interface Labs {
  wbc?: number | null;
  hb?: number | null;
  crp?: number | null;
  cr?: number | null;
}

/** lab을 "WBC 9000 Hb 9.6 CRP 5.4 Cr 1.0" 형태로 (입력된 항목만) */
export function formatLabs(l?: Labs | null): string {
  if (!l) return '';
  const bits: string[] = [];
  if (l.wbc != null) bits.push(`WBC ${l.wbc}`);
  if (l.hb != null) bits.push(`Hb ${l.hb}`);
  if (l.crp != null) bits.push(`CRP ${l.crp}`);
  if (l.cr != null) bits.push(`Cr ${l.cr}`);
  return bits.join(' ');
}

// ===== 회진 정렬 룰 =====
/**
 * 병동 정렬:
 *   1) 층 desc (높은 층 먼저: 10층 → 9층 → 8층)
 *   2) 같은 층 안에서 호수 룰:
 *      14, 15, 16, ..., 19 (오름) → 13, 12, ..., 01 (내림)
 *      26, 27, ..., 35 (오름) → 25, 24, ..., 20 (내림)
 *   3) 호수가 없는 환자는 마지막
 *
 * ward: '1013' → 층=10, 호=13
 *       '926'  → 층=9, 호=26
 *       '801'  → 층=8, 호=01
 */
/**
 * 특수병실 → 층/병실내 순서 매핑 (대소문자 무시).
 * order는 같은 층 숫자병실 "뒤"에서의 나열 순서.
 */
export const SPECIAL_WARDS: Record<string, { floor: number; order: number }> = {
  sb: { floor: 5, order: 0 },
  eb: { floor: 5, order: 1 },
  ma: { floor: 5, order: 2 },
  mb: { floor: 5, order: 3 },
  mc: { floor: 5, order: 4 },
  iia: { floor: 3, order: 0 },
  iib: { floor: 3, order: 1 },
  ea: { floor: 1, order: 0 },
  si: { floor: 9, order: 0 },
  su: { floor: 9, order: 1 },
};

/**
 * 병동 문자열 파싱.
 *  - 숫자 병동: 뒤 2자리=호수, 앞=층  (예: "1015" → 10층 15호)
 *  - 특수병실: 알파벳 코드 매핑 (예: "sb", "SB" → 5층 특수)
 */
export function parseWard(
  ward?: string | null,
): { floor: number; room: number; special?: number } | null {
  if (!ward) return null;
  // 특수병실 코드 우선 (알파벳만 추출해서 매핑)
  const alpha = ward.toLowerCase().replace(/[^a-z]/g, '');
  if (alpha && SPECIAL_WARDS[alpha]) {
    const { floor, order } = SPECIAL_WARDS[alpha];
    return { floor, room: -1, special: order };
  }
  const cleaned = ward.replace(/[^0-9]/g, '');
  if (cleaned.length < 3) return null;
  const room = parseInt(cleaned.slice(-2), 10);
  const floor = parseInt(cleaned.slice(0, -2), 10);
  if (isNaN(room) || isNaN(floor)) return null;
  return { floor, room };
}

/**
 * 회진 순서 정렬 키 — 작을수록 먼저.
 *  - 층: 10층 최우선 → 그다음 높은 층부터 낮은 층 (10 제외)
 *  - 호수: 같은 층에서 내림차순 (15→14→…→1)
 *  - 특수병실: 같은 층 숫자병실 뒤에, 나열 순서대로
 *  - 자리(seat): 같은 호수에서 6→5→…→1, 모름(null)은 맨 뒤
 */
export function roundingSortKey(ward?: string | null, seat?: number | null): number {
  const parsed = parseWard(ward);
  if (!parsed) return Number.MAX_SAFE_INTEGER;
  const { floor, room, special } = parsed;

  // 층 우선순위: 10층 → -1 (최상단), 그 외 → (100 - floor) 내림차순
  const floorRank = floor === 10 ? -1 : 100 - floor;

  // 호수 우선순위:
  //   - 14호 이상: 오름차순 (14,15,16,…) → 먼저
  //   - 13호 이하: 내림차순 (13,12,…,1) → 그 뒤
  //   특수병실은 맨 뒤(200+order)
  let roomRank: number;
  if (special != null) {
    roomRank = 200 + special;
  } else if (room >= 14) {
    roomRank = room; // 14,15,… (작을수록 먼저)
  } else {
    roomRank = 100 - room; // 13→87, 12→88, …, 1→99 (14+ 그룹 뒤, 내림차순)
  }

  // 자리: 6→0, 5→1, …, 1→5, 모름(null/0)→6 (맨 뒤)
  const seatRank = seat && seat >= 1 && seat <= 6 ? 6 - seat : 6;

  return floorRank * 100000 + roomRank * 100 + seatRank;
}

/**
 * POD 계산 (수술일 기준 오늘까지의 일수)
 *   surgery_date == today → POD #0 (수술 당일)
 *   다음날 → POD #1
 *   수술 전 (미래일) → null (예정)
 */
export function computePod(surgeryDate?: string | null, asOf?: Date): number | null {
  if (!surgeryDate) return null;
  const d0 = new Date(surgeryDate + 'T00:00:00');
  const d1 = asOf ?? new Date();
  const ms = d1.getTime() - d0.getTime();
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  return days >= 0 ? days : null;
}

/**
 * 수술 상태: 'planned' (예정) | 'done' (실시) | null (수술 없음)
 */
export function surgeryStatus(
  surgeryDate?: string | null,
  asOf?: Date,
): 'planned' | 'done' | null {
  if (!surgeryDate) return null;
  const d0 = new Date(surgeryDate + 'T00:00:00');
  const d1 = asOf ?? new Date();
  // 오늘 0시와 비교 — 오늘이거나 과거면 done
  const today = new Date(d1.getFullYear(), d1.getMonth(), d1.getDate());
  return d0.getTime() <= today.getTime() ? 'done' : 'planned';
}

/**
 * 예정 수술일을 자연어로 — '이번주 수요일', '다음주 월요일' 등.
 * - 오늘은 '오늘'
 * - 내일은 '내일'
 * - 모레는 '모레'
 * - 이번주 안 (오늘 ~ 토요일까지) → '이번주 X요일'
 * - 다음주 (일요일 ~ 다음 토요일) → '다음주 X요일'
 * - 그 이후 → '5/27 (수)' 같은 형식
 */
const KOREAN_DAYS = ['일', '월', '화', '수', '목', '금', '토'];
export function formatSurgeryDateNatural(
  surgeryDate?: string | null,
  asOf?: Date,
): string | null {
  if (!surgeryDate) return null;
  const today = asOf ?? new Date();
  const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const target = new Date(surgeryDate + 'T00:00:00');
  const diffDays = Math.round((target.getTime() - todayMid.getTime()) / (24 * 60 * 60 * 1000));

  if (diffDays === 0) return '오늘';
  if (diffDays === 1) return '내일';
  if (diffDays === 2) return '모레';
  if (diffDays < 0) {
    // 과거: '어제', '5일 전' 등 — 실제로는 surgeryStatus가 done으로 잡으니 거의 안 옴
    if (diffDays === -1) return '어제';
    return `${Math.abs(diffDays)}일 전`;
  }

  const targetDay = target.getDay(); // 0(일)~6(토)
  const todayDay = todayMid.getDay();

  // 이번주: 오늘부터 다가오는 토요일까지 (오늘 기준 같은 주)
  const daysUntilSat = 6 - todayDay;
  if (diffDays <= daysUntilSat) {
    return `이번주 ${KOREAN_DAYS[targetDay]}요일`;
  }
  // 다음주: 다음 일요일 ~ 그 다음 토요일
  if (diffDays <= daysUntilSat + 7) {
    return `다음주 ${KOREAN_DAYS[targetDay]}요일`;
  }
  if (diffDays <= daysUntilSat + 14) {
    return `다다음주 ${KOREAN_DAYS[targetDay]}요일`;
  }
  // 그 이상은 날짜로
  const m = target.getMonth() + 1;
  const d = target.getDate();
  return `${m}/${d} (${KOREAN_DAYS[targetDay]})`;
}

// ===== m-view 한 줄 요약 (화면 상단) =====
/** m-view 리스트가 어떤 환자를 모아 보여주는지 설명하는 한 줄. */
export const MVIEW_SUMMARY =
  '오늘 수술 · 수술 예정 · F/U 검사 · drain 제거 · 협진환자 · 수동추가 가능';

/**
 * 입원예정 여부 — 입원일이 오늘보다 미래면 '입원예정', 오늘이거나 과거면 '입원환자'.
 * (별도 체크박스 없이 입원일만으로 자동 판정)
 */
export function isAdmissionPending(admittedAt?: string | null, today?: string): boolean {
  if (!admittedAt) return false;
  const t = today ?? new Date().toISOString().slice(0, 10);
  return admittedAt > t; // ISO 날짜 문자열은 사전식 비교가 곧 날짜 비교
}
