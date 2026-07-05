import type {
  ExamRegions,
  Region,
  Bilateral,
  MotorGrade,
  DtrGrade,
  SensoryStatus,
} from '@/types/domain';
import { MOTOR_GROUPS, DTR_GROUPS } from '@/lib/constants/regions';

/**
 * Motor/DTR/Sensory가 "정상(intact)"인지 판정하고,
 * 비정상이면 짧은 요약 문자열을 만든다.
 *
 * 화면의 intact 접기, 회진문서 표의 "기존 motor" 칸 등에 공통 사용.
 */

/** Motor 정상 기준: 5/5 또는 미입력(null) */
function isMotorNormal(v: Bilateral<MotorGrade> | undefined): boolean {
  if (!v) return true;
  const okSide = (g: MotorGrade) => g == null || g === 5;
  return okSide(v.lt) && okSide(v.rt);
}

/** DTR 정상 기준: 2(normal) 또는 미입력 */
function isDtrNormal(v: Bilateral<DtrGrade> | undefined): boolean {
  if (!v) return true;
  const okSide = (g: DtrGrade) => g == null || g === 2;
  return okSide(v.lt) && okSide(v.rt);
}

/** Sensory 정상 기준: intact 또는 null */
function isSensoryNormal(v: Bilateral<SensoryStatus> | undefined): boolean {
  if (!v) return true;
  const okSide = (s: SensoryStatus) => s == null || s === 'intact';
  return okSide(v.lt) && okSide(v.rt);
}

const SIDE_LABEL: Record<'lt' | 'rt', string> = { lt: 'Lt', rt: 'Rt' };

/** "Rt 4 / Lt 5" 처럼 비정상 쪽만 골라 표기 (motor) */
function motorSideSummary(label: string, v: Bilateral<MotorGrade>): string | null {
  const bad: string[] = [];
  for (const side of ['rt', 'lt'] as const) {
    const g = v[side];
    if (g != null && g !== 5) bad.push(`${SIDE_LABEL[side]} ${g}`);
  }
  if (bad.length === 0) return null;
  return `${label} ${bad.join('/')}`;
}

const DTR_LABEL: Record<number, string> = {
  0: '소실',
  1: '저하',
  3: '항진',
  4: 'clonus',
};

function dtrSideSummary(label: string, v: Bilateral<DtrGrade>): string | null {
  const bad: string[] = [];
  for (const side of ['rt', 'lt'] as const) {
    const g = v[side];
    if (g != null && g !== 2) bad.push(`${SIDE_LABEL[side]} ${DTR_LABEL[g] ?? g}`);
  }
  if (bad.length === 0) return null;
  return `${label} ${bad.join('/')}`;
}

const SENSORY_LABEL: Record<string, string> = {
  hyper: 'hyper',
  hypo: 'hypo',
};

function sensorySideSummary(dermatome: string, v: Bilateral<SensoryStatus>): string | null {
  const bad: string[] = [];
  for (const side of ['rt', 'lt'] as const) {
    const s = v[side];
    if (s && s !== 'intact') bad.push(`${SIDE_LABEL[side]} ${SENSORY_LABEL[s] ?? s}`);
  }
  if (bad.length === 0) return null;
  return `${dermatome} ${bad.join('/')}`;
}

export interface CategoryStatus {
  normal: boolean;       // 모두 intact?
  summary: string;       // 비정상 요약 (정상이면 'intact')
}

/** 한 region의 motor 상태 */
export function motorStatus(region: Region, examRaw: Record<string, unknown> | object | undefined): CategoryStatus {
  const exam = examRaw as Record<string, unknown> | undefined;
  if (region === 'brain') {
    // brain은 motorUpper/motorLower 구조
    const mu = exam?.motorUpper as Bilateral<MotorGrade> | undefined;
    const ml = exam?.motorLower as Bilateral<MotorGrade> | undefined;
    const normal = isMotorNormal(mu) && isMotorNormal(ml);
    if (normal) return { normal: true, summary: 'intact' };
    const bits: string[] = [];
    if (mu) { const s = motorSideSummary('U/E', mu); if (s) bits.push(s); }
    if (ml) { const s = motorSideSummary('L/E', ml); if (s) bits.push(s); }
    return { normal: false, summary: bits.join(', ') || 'intact' };
  }

  const groups = MOTOR_GROUPS[region as 'cervical' | 'lumbar'] ?? [];
  const motor = (exam?.motor ?? {}) as Record<string, Bilateral<MotorGrade>>;
  let allNormal = true;
  const bits: string[] = [];
  for (const g of groups) {
    const v = motor[g.key];
    if (!isMotorNormal(v)) {
      allNormal = false;
      const s = v ? motorSideSummary(g.label, v) : null;
      if (s) bits.push(s);
    }
  }
  if (allNormal) return { normal: true, summary: 'intact' };
  return { normal: false, summary: bits.join(', ') || 'abnormal' };
}

/** 한 region의 DTR 상태 */
export function dtrStatus(region: Region, examRaw: Record<string, unknown> | object | undefined): CategoryStatus {
  const exam = examRaw as Record<string, unknown> | undefined;
  if (region === 'thoracic') {
    const v = exam?.dtr as Bilateral<DtrGrade> | undefined;
    if (isDtrNormal(v)) return { normal: true, summary: 'intact' };
    const s = v ? dtrSideSummary('DTR', v) : null;
    return { normal: false, summary: s || 'abnormal' };
  }
  const groups = DTR_GROUPS[region] ?? [];
  const dtr = (exam?.dtr ?? {}) as Record<string, Bilateral<DtrGrade>>;
  let allNormal = true;
  const bits: string[] = [];
  for (const g of groups) {
    const v = dtr[g.key];
    if (!isDtrNormal(v)) {
      allNormal = false;
      const s = v ? dtrSideSummary(g.label, v) : null;
      if (s) bits.push(s);
    }
  }
  if (allNormal) return { normal: true, summary: 'intact' };
  return { normal: false, summary: bits.join(', ') || 'abnormal' };
}

/** 한 region의 Sensory 상태 */
export function sensoryStatus(region: Region, examRaw: Record<string, unknown> | object | undefined): CategoryStatus {
  const exam = examRaw as Record<string, unknown> | undefined;
  if (region === 'brain') {
    const s = exam?.sensory as SensoryStatus | undefined;
    if (s == null || s === 'intact') return { normal: true, summary: 'intact' };
    return { normal: false, summary: SENSORY_LABEL[s] ?? String(s) };
  }
  const sensory = (exam?.sensory ?? {}) as Record<string, Bilateral<SensoryStatus>>;
  let allNormal = true;
  const bits: string[] = [];
  for (const [derm, v] of Object.entries(sensory)) {
    if (!isSensoryNormal(v)) {
      allNormal = false;
      const s = sensorySideSummary(derm, v);
      if (s) bits.push(s);
    }
  }
  if (allNormal) return { normal: true, summary: 'intact' };
  return { normal: false, summary: bits.join(', ') || 'abnormal' };
}

/**
 * 한 region 전체가 "완전 정상"인지 (motor + dtr + sensory 모두 intact).
 * 회진문서 표의 "기존 motor: intact" 한 줄 표기에 사용.
 */
export function regionNeuroSummary(
  region: Region,
  exam: Record<string, unknown> | object | undefined,
): { motor: CategoryStatus; dtr: CategoryStatus; sensory: CategoryStatus; allNormal: boolean } {
  const motor = motorStatus(region, exam);
  const dtr = dtrStatus(region, exam);
  const sensory = sensoryStatus(region, exam);
  return {
    motor,
    dtr,
    sensory,
    allNormal: motor.normal && dtr.normal && sensory.normal,
  };
}

/**
 * baseline regions에서 "기존 증상" 요약 텍스트를 만든다.
 * 회진문서 표의 "입원시 증상/motor" 칸에 사용.
 * 예: "Lt L5 numbness · Motor: Rt LE Knee ext 4 · DTR intact"
 */
export function baselineSummary(baseline: ExamRegions | null | undefined): {
  symptoms: string[];
  motorText: string;
} {
  if (!baseline) return { symptoms: [], motorText: 'intact' };

  const symptoms: string[] = [];
  const motorBits: string[] = [];

  for (const region of ['brain', 'cervical', 'thoracic', 'lumbar'] as Region[]) {
    const exam = baseline[region] as Record<string, unknown> | undefined;
    if (!exam) continue;

    // 통증/증상
    if (region === 'cervical') {
      if (exam.nuchalPain) symptoms.push('Nuchal pain');
      if (exam.radicularPain) symptoms.push('C-radicular pain');
    }
    if (region === 'lumbar') {
      if (exam.backPain) symptoms.push('Back pain');
      if (exam.radicularPain) symptoms.push('L-radicular pain');
      if (exam.nic) symptoms.push('NIC');
    }

    // sensory 비정상
    const sens = sensoryStatus(region, exam);
    if (!sens.normal) symptoms.push(sens.summary);

    // motor 비정상
    const mot = motorStatus(region, exam);
    if (!mot.normal) motorBits.push(`${region.charAt(0).toUpperCase()}: ${mot.summary}`);
  }

  return {
    symptoms,
    motorText: motorBits.length > 0 ? motorBits.join(' · ') : 'intact',
  };
}
