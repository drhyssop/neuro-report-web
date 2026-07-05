import type {
  ExamRegions,
  PathologicSigns,
  LumbarExam,
  CervicalExam,
  BrainExam,
  Bilateral,
  MotorGrade,
  DtrGrade,
} from '@/types/domain';
import type { DermatomePainEntry, DrainTube, DrainOutputs } from '@/types/domainV2';

export const PATH_LABEL: Record<keyof PathologicSigns, string> = {
  hoffman: 'Hoffman (+)',
  babinski: 'Babinski (+)',
  analToneDecreased: 'Anal tone 저하',
  voidingProblem: 'Voiding 이상',
  gaitDisturbance: 'Gait disturbance',
};

/**
 * 양측 Motor grade를 "Rt/Lt" 통합 포맷으로 표시.
 *   둘 다 5 → null (정상은 표시 안 함)
 *   한쪽만 < 5 → 다른 쪽은 자동 5로 간주
 *   양쪽 grade가 같으면 "5/5" 식
 *   다르면 "Rt/Lt" 순서로 "4/5"
 */
export function formatMotorBilateral(b?: Bilateral<MotorGrade>): string | null {
  if (!b) return null;
  const lt = b.lt ?? 5;
  const rt = b.rt ?? 5;
  // 양쪽 모두 5 (정상) → 표시 안 함
  if (lt === 5 && rt === 5) return null;
  return `${rt}/${lt}`;
}

/**
 * 양측 DTR grade를 Rt/Lt 통합 포맷으로 표시.
 *   둘 다 2 (정상) → null
 *   한쪽만 비정상이어도 다른 쪽은 2로 간주
 */
export function formatDtrBilateral(b?: Bilateral<DtrGrade>): string | null {
  if (!b) return null;
  const lt = b.lt ?? 2;
  const rt = b.rt ?? 2;
  if (lt === 2 && rt === 2) return null;
  return `${dtrLabel(rt)}/${dtrLabel(lt)}`;
}

function dtrLabel(g: DtrGrade): string {
  if (g == null) return '2+';
  return g === 2 ? '2+' : String(g);
}

/**
 * Drain 표시 — 활성 drain들의 오늘 cc + 어제 cc 비교.
 *   "Rt JP(1) 50 / Lt JP(1) 40 (← 70/50)"
 *   "Rt JP(1) 50" — 어제 데이터 없으면 비교 부분 생략
 *   "" — 활성 drain 없음
 *
 * Rt 먼저, Lt 나중 순서로 정렬.
 */
export function formatDrainsLog(
  drainsLog: DrainTube[],
  todayOutputs: DrainOutputs,
  yesterdayOutputs: DrainOutputs,
): string {
  if (!drainsLog || drainsLog.length === 0) return '';

  // 활성 drain만
  const active = drainsLog
    .filter((d) => !d.ended_at)
    .sort((a, b) => {
      // Rt > Mid > Lt 순서
      const order: Record<string, number> = { Rt: 0, Mid: 1, Lt: 2 };
      const diff = (order[a.side] ?? 99) - (order[b.side] ?? 99);
      if (diff !== 0) return diff;
      if (a.type !== b.type) return a.type.localeCompare(b.type);
      return a.index - b.index;
    });

  if (active.length === 0) return '';

  // 각 drain: "Rt JP(2) 40(<25)" — 오늘 cc, 괄호 안은 직전 기록값
  const bits: string[] = [];
  for (const d of active) {
    const label = `${d.side} ${d.type}(${d.index})`;
    const tcc = todayOutputs[d.id];
    const ycc = yesterdayOutputs[d.id];
    const todayPart = tcc != null ? `${tcc}` : '-';
    const prevPart = ycc != null ? `(<${ycc})` : '';
    bits.push(`${label} ${todayPart}${prevPart}`);
  }

  return bits.join(' / ');
}

/** 활성 drain 개수만 빠르게 */
export function activeDrainsCount(drainsLog: DrainTube[]): number {
  if (!drainsLog) return 0;
  return drainsLog.filter((d) => !d.ended_at).length;
}

/**
 * Dermatome pain 요약. Rt 먼저, Lt 나중.
 */
export function summarizeDermatomePain(regions: ExamRegions): string {
  const bits: { side: string; text: string }[] = [];
  for (const r of ['cervical', 'thoracic', 'lumbar'] as const) {
    const exam = regions[r];
    if (!exam) continue;
    const entries = ((exam as { sensoryPain?: unknown[] }).sensoryPain ?? []) as DermatomePainEntry[];
    for (const e of entries) {
      if (!e || (!e.dermatome && !e.note)) continue;
      const der = e.dermatome ? e.dermatome.split(',').join('-') : '';
      const note = e.note?.trim();
      let s = String(e.side);
      if (der) s += ` ${der}`;
      if (note) s += ` (${note})`;
      bits.push({ side: String(e.side), text: s });
    }
  }
  // Rt 먼저, Lt 나중
  bits.sort((a, b) => (a.side === 'Rt' ? -1 : 1));
  return bits.map((b) => b.text).join('; ');
}

/**
 * 환자 증상 표시.
 * 형식 예시:
 *   - "Nuchal pain (main, VAS 7)"
 *   - "Back pain (VAS 5)"
 *   - "L4-L5 pain, tingling (main, VAS 7)"  ← radicular
 *   - "NIC (+)" — 최우선
 *
 * 순서: NIC > main 항목 > 나머지
 * 모두 미입력이면 "통증 없음"
 */
export function buildSymptomList(regions: ExamRegions): {
  symptoms: string[];
  dermatomePainSummary: string;
} {
  const items: { text: string; isMain: boolean; isNic: boolean }[] = [];

  const lum = regions.lumbar as LumbarExam | undefined;
  const cer = regions.cervical as CervicalExam | undefined;

  // === NIC ===
  if (lum?.nic) {
    items.push({ text: 'NIC (+)', isMain: false, isNic: true });
  }

  // === Lumbar ===
  if (lum?.backPain) {
    items.push({
      text: formatPainItem('Back pain', lum.backVas, lum.mainPain === 'back'),
      isMain: lum.mainPain === 'back',
      isNic: false,
    });
  }
  if (lum?.radicularPain) {
    items.push({
      text: formatRadicularItem(regions, 'lumbar', lum.radicularVas, lum.mainPain === 'radicular', lum.radicularQuality),
      isMain: lum.mainPain === 'radicular',
      isNic: false,
    });
  }

  // === Cervical ===
  if (cer?.nuchalPain) {
    items.push({
      text: formatPainItem('Nuchal pain', cer.nuchalVas, cer.mainPain === 'nuchal'),
      isMain: cer.mainPain === 'nuchal',
      isNic: false,
    });
  }
  if (cer?.radicularPain) {
    items.push({
      text: formatRadicularItem(regions, 'cervical', cer.radicularVas, cer.mainPain === 'radicular', cer.radicularQuality),
      isMain: cer.mainPain === 'radicular',
      isNic: false,
    });
  }

  // 정렬: NIC → main → 그 외
  items.sort((a, b) => {
    if (a.isNic && !b.isNic) return -1;
    if (!a.isNic && b.isNic) return 1;
    if (a.isMain && !b.isMain) return -1;
    if (!a.isMain && b.isMain) return 1;
    return 0;
  });

  const symptoms = items.length > 0 ? items.map((i) => i.text) : ['통증 없음'];

  // dermatome pain은 별도 노출하던 항목이지만, 이제는 radicular 안에 합쳐졌으므로 빈 문자열
  return { symptoms, dermatomePainSummary: '' };
}

/** "Back pain (VAS 7)" 또는 "Back pain (main, VAS 7)" */
function formatPainItem(label: string, vas: number | null | undefined, isMain: boolean): string {
  const bits: string[] = [];
  if (isMain) bits.push('main');
  if (vas != null) bits.push(`VAS ${vas}`);
  return bits.length > 0 ? `${label} (${bits.join(', ')})` : label;
}

/**
 * Radicular pain — dermatome별 통증/저림 구분
 *   "Lt L4, L5 pain, S1 tingling (main, VAS 7)"
 *   "Rt L4 tingling (VAS 5)"
 *   dermatome 미입력이면 side-level quality로 폴백: "Radicular pain"
 * dermatomeQualities에 키가 없는 dermatome은 통증(pain)으로 간주.
 */
function formatRadicularItem(
  regions: ExamRegions,
  region: 'cervical' | 'lumbar',
  vas: number | null | undefined,
  isMain: boolean,
  quality?: { pain?: boolean; tingling?: boolean },
): string {
  const exam = regions[region];
  const entries = ((exam as { sensoryPain?: unknown[] })?.sensoryPain ?? []) as DermatomePainEntry[];

  // side별 묶음 (Rt 먼저)
  const sidesBits: string[] = [];
  for (const sideKey of ['Rt', 'Lt'] as const) {
    const matching = entries.filter((e) => String(e.side) === sideKey && (e.dermatome || e.note));
    for (const e of matching) {
      const ders = e.dermatome ? e.dermatome.split(',').filter(Boolean) : [];
      if (ders.length === 0) continue;
      const quals = e.dermatomeQualities ?? {};
      const painDers = ders.filter((d) => (quals[d] ?? 'pain') === 'pain');
      const tinglingDers = ders.filter((d) => quals[d] === 'tingling');

      const parts: string[] = [];
      if (painDers.length > 0) parts.push(`${painDers.join(', ')} pain`);
      if (tinglingDers.length > 0) parts.push(`${tinglingDers.join(', ')} tingling`);
      if (parts.length > 0) sidesBits.push(`${sideKey} ${parts.join(', ')}`);
    }
  }

  let head: string;
  if (sidesBits.length > 0) {
    head = sidesBits.join(', ');
  } else {
    // dermatome 미입력 → side-level quality 폴백 (기본 pain)
    const qStr = quality?.tingling && !quality?.pain ? 'tingling' : 'pain';
    head = `Radicular ${qStr}`;
  }

  const bits: string[] = [];
  if (isMain) bits.push('main');
  if (vas != null) bits.push(`VAS ${vas}`);
  return bits.length > 0 ? `${head} (${bits.join(', ')})` : head;
}

/**
 * Physical exam (비정상만). region prefix 없음.
 * 순서: motor weakness → pathologic signs → DTR → sensory → mental
 */
export function buildPhysicalList(regions: ExamRegions): string[] {
  const motorBits: string[] = [];
  const pathBits: string[] = [];
  const dtrBits: string[] = [];
  const sensoryBits: string[] = [];
  const otherBits: string[] = [];

  for (const r of ['brain', 'cervical', 'thoracic', 'lumbar'] as const) {
    const exam = regions[r];
    if (!exam) continue;

    // Motor weakness — 5/5 아닌 항목만
    const motorObj = (exam as { motor?: Record<string, Bilateral<MotorGrade>> }).motor;
    if (motorObj) {
      for (const [k, v] of Object.entries(motorObj)) {
        const grade = formatMotorBilateral(v);
        if (grade) motorBits.push(`${k} ${grade}`);
      }
    }
    // Brain motorUpper/motorLower
    if (r === 'brain') {
      const b = exam as BrainExam;
      const up = formatMotorBilateral(b.motorUpper);
      if (up) motorBits.push(`Upper ${up}`);
      const lo = formatMotorBilateral(b.motorLower);
      if (lo) motorBits.push(`Lower ${lo}`);
    }

    // Pathologic signs
    const ps = (exam as { pathologicSigns?: PathologicSigns }).pathologicSigns;
    if (ps) {
      for (const key of Object.keys(ps) as (keyof PathologicSigns)[]) {
        if (ps[key]) pathBits.push(PATH_LABEL[key]);
      }
    }

    // DTR
    const dtrObj = (exam as { dtr?: unknown }).dtr;
    if (dtrObj) {
      if ('lt' in (dtrObj as object) && 'rt' in (dtrObj as object)) {
        const g = formatDtrBilateral(dtrObj as Bilateral<DtrGrade>);
        if (g) dtrBits.push(`DTR ${g}`);
      } else {
        for (const [k, v] of Object.entries(dtrObj as Record<string, Bilateral<DtrGrade>>)) {
          const g = formatDtrBilateral(v);
          if (g) dtrBits.push(`${k} ${g}`);
        }
      }
    }

    // Sensory — dermatome별 hyper/hypo 표시
    const sensoryObj = (exam as { sensory?: unknown }).sensory;
    if (sensoryObj && typeof sensoryObj === 'object') {
      for (const [derm, v] of Object.entries(
        sensoryObj as Record<string, Bilateral<'hyper' | 'intact' | 'hypo' | null>>,
      )) {
        if (!v) continue;
        const lt = v.lt ?? 'intact';
        const rt = v.rt ?? 'intact';
        if (lt === 'intact' && rt === 'intact') continue;
        const sideBits: string[] = [];
        if (rt && rt !== 'intact') sideBits.push(`Rt ${sensoryLabel(rt)}`);
        if (lt && lt !== 'intact') sideBits.push(`Lt ${sensoryLabel(lt)}`);
        sensoryBits.push(`${derm} ${sideBits.join('/')}`);
      }
    }

    // mental
    const ms = (exam as BrainExam).mentalStatus;
    if (ms && ms !== 'alert') otherBits.push(`Mental: ${ms}`);
    // Brain의 sensory는 전반적이라 위 sensory bilateral과 형태 다름 — 처리
    if (r === 'brain' && typeof sensoryObj === 'string') {
      if (sensoryObj !== 'intact' && sensoryObj !== null) {
        otherBits.push(`Sensory ${sensoryLabel(sensoryObj as 'hyper' | 'hypo')}`);
      }
    }
  }

  const pathDedup = Array.from(new Set(pathBits));
  return [...motorBits, ...pathDedup, ...dtrBits, ...sensoryBits, ...otherBits];
}

function sensoryLabel(s: 'hyper' | 'intact' | 'hypo' | string): string {
  if (s === 'hyper') return 'hyperesthesia';
  if (s === 'hypo') return 'hypoesthesia';
  return String(s);
}
