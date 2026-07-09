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
  const dominance = (exam as { radicularDominance?: 'R>L' | 'L>R' })?.radicularDominance;

  // dermatome × quality(pain/tingling) 별로 어느 side가 있는지 수집
  //   key = `${dermatome}|${quality}` → { rt, lt }
  const map = new Map<string, { derm: string; qual: 'pain' | 'tingling'; rt: boolean; lt: boolean }>();
  const noteBits: string[] = [];
  for (const e of entries) {
    const side = String(e.side);
    if (e.note?.trim()) noteBits.push(e.note.trim());
    const ders = e.dermatome ? e.dermatome.split(',').filter(Boolean) : [];
    const quals = e.dermatomeQualities ?? {};
    for (const d of ders) {
      const q: 'pain' | 'tingling' = quals[d] === 'tingling' ? 'tingling' : 'pain';
      const key = `${d}|${q}`;
      const cur = map.get(key) ?? { derm: d, qual: q, rt: false, lt: false };
      if (side === 'Rt') cur.rt = true;
      else if (side === 'Lt') cur.lt = true;
      map.set(key, cur);
    }
  }

  // dermatome 정렬 (C3..T1, L1..S3) — 문자열 정렬로 충분 (C/L/S/T 접두 + 숫자)
  const levelOrder = (d: string) => {
    const m = d.match(/^([A-Za-z]+)(\d+)$/);
    if (!m) return 999;
    const prefix = { C: 0, T: 100, L: 200, S: 300 }[m[1].toUpperCase()[0]] ?? 900;
    return prefix + parseInt(m[2], 10);
  };

  const sideLabel = (rt: boolean, lt: boolean): string => {
    if (rt && lt) return 'both';
    return rt ? 'Rt' : 'Lt';
  };

  // quality별로 묶어서 "Lt L4, both L5 (R>L) pain" 형태 생성
  const byQual: Record<'pain' | 'tingling', string[]> = { pain: [], tingling: [] };
  const items = [...map.values()].sort((a, b) => levelOrder(a.derm) - levelOrder(b.derm));
  for (const it of items) {
    const both = it.rt && it.lt;
    const dom = both && dominance ? ` (${dominance})` : '';
    byQual[it.qual].push(`${sideLabel(it.rt, it.lt)} ${it.derm}${dom}`);
  }

  const parts: string[] = [];
  if (byQual.pain.length > 0) parts.push(`${byQual.pain.join(', ')} pain`);
  if (byQual.tingling.length > 0) parts.push(`${byQual.tingling.join(', ')} tingling`);

  let head: string;
  if (parts.length > 0) {
    head = parts.join(', ');
  } else if (noteBits.length > 0) {
    head = `Radicular pain (${noteBits.join(', ')})`;
  } else {
    // dermatome·note 미입력 → side-level quality 폴백
    const qStr = quality?.tingling && !quality?.pain ? 'tingling' : 'pain';
    head = `Radicular ${qStr}`;
  }

  const bits: string[] = [];
  if (isMain) bits.push('main');
  if (vas != null) bits.push(`VAS ${vas}`);
  return bits.length > 0 ? `${head} (${bits.join(', ')})` : head;
}

/**
 * Physical exam을 카테고리별로 묶어서 반환 (#3 가독성 개선).
 *   - (가) Motor / Sensory / DTR / Path / 기타 분리
 *   - (나) 양측 동일값은 "both"로 압축 (sensory)
 *   - 비정상만 포함 (정상은 애초에 빠짐)
 */
export interface PhysicalGroup {
  label: string;
  items: string[];
  /** motor 등 약화 정도가 심한지(≤3) — 강조용 */
  severe?: boolean;
}

export function buildPhysicalGrouped(regions: ExamRegions): PhysicalGroup[] {
  const flat = buildPhysicalListInternal(regions);
  const groups: PhysicalGroup[] = [];
  if (flat.motor.length) groups.push({ label: 'Motor', items: flat.motor, severe: flat.motorSevere });
  if (flat.path.length) groups.push({ label: 'Path', items: flat.path });
  if (flat.dtr.length) groups.push({ label: 'DTR', items: flat.dtr });
  if (flat.sensory.length) groups.push({ label: 'Sensory', items: flat.sensory });
  if (flat.other.length) groups.push({ label: '기타', items: flat.other });
  return groups;
}

interface PhysicalInternal {
  motor: string[];
  motorSevere: boolean;
  path: string[];
  dtr: string[];
  sensory: string[];
  other: string[];
}

function buildPhysicalListInternal(regions: ExamRegions): PhysicalInternal {
  const motorBits: string[] = [];
  let motorSevere = false;
  const pathBits: string[] = [];
  const dtrBits: string[] = [];
  const sensoryBits: string[] = [];
  const otherBits: string[] = [];

  for (const r of ['brain', 'cervical', 'thoracic', 'lumbar'] as const) {
    const exam = regions[r];
    if (!exam) continue;

    const motorObj = (exam as { motor?: Record<string, Bilateral<MotorGrade>> }).motor;
    if (motorObj) {
      for (const [k, v] of Object.entries(motorObj)) {
        const grade = formatMotorBilateral(v);
        if (grade) {
          motorBits.push(`${k} ${grade}`);
          // 3 이하 포함 시 severe
          if (/[0-3]/.test(grade)) motorSevere = true;
        }
      }
    }
    if (r === 'brain') {
      const b = exam as BrainExam;
      const up = formatMotorBilateral(b.motorUpper);
      if (up) motorBits.push(`Upper ${up}`);
      const lo = formatMotorBilateral(b.motorLower);
      if (lo) motorBits.push(`Lower ${lo}`);
    }

    const ps = (exam as { pathologicSigns?: PathologicSigns }).pathologicSigns;
    if (ps) {
      for (const key of Object.keys(ps) as (keyof PathologicSigns)[]) {
        if (ps[key]) pathBits.push(PATH_LABEL[key]);
      }
    }

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

    // Sensory — 양측 동일하면 "both"로 압축 (나)
    const sensoryObj = (exam as { sensory?: unknown }).sensory;
    if (sensoryObj && typeof sensoryObj === 'object') {
      for (const [derm, v] of Object.entries(
        sensoryObj as Record<string, Bilateral<'hyper' | 'intact' | 'hypo' | null>>,
      )) {
        if (!v) continue;
        const lt = v.lt ?? 'intact';
        const rt = v.rt ?? 'intact';
        if (lt === 'intact' && rt === 'intact') continue;
        if (rt !== 'intact' && lt !== 'intact' && rt === lt) {
          // 양측 동일 → both
          sensoryBits.push(`${derm} both ${sensoryLabel(rt)}`);
        } else {
          const sideBits: string[] = [];
          if (rt && rt !== 'intact') sideBits.push(`Rt ${sensoryLabel(rt)}`);
          if (lt && lt !== 'intact') sideBits.push(`Lt ${sensoryLabel(lt)}`);
          sensoryBits.push(`${derm} ${sideBits.join('/')}`);
        }
      }
    }

    const ms = (exam as BrainExam).mentalStatus;
    if (ms && ms !== 'alert') otherBits.push(`Mental: ${ms}`);
    if (r === 'brain' && typeof sensoryObj === 'string') {
      if (sensoryObj !== 'intact' && sensoryObj !== null) {
        otherBits.push(`Sensory ${sensoryLabel(sensoryObj as 'hyper' | 'hypo')}`);
      }
    }
  }

  return {
    motor: motorBits,
    motorSevere,
    path: Array.from(new Set(pathBits)),
    dtr: dtrBits,
    sensory: sensoryBits,
    other: otherBits,
  };
}

/**
 * Physical exam (비정상만). region prefix 없음. (flat — 기존 호환)
 * 순서: motor weakness → pathologic signs → DTR → sensory → mental
 */
export function buildPhysicalList(regions: ExamRegions): string[] {
  const g = buildPhysicalListInternal(regions);
  return [...g.motor, ...g.path, ...g.dtr, ...g.sensory, ...g.other];
}


function sensoryLabel(s: 'hyper' | 'intact' | 'hypo' | string): string {
  if (s === 'hyper') return 'hyperesthesia';
  if (s === 'hypo') return 'hypoesthesia';
  return String(s);
}
