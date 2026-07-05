import type { ExamRegions, FieldChange, ChangeKind, MotorGrade } from '@/types/domain';

/**
 * 어제 검사와 오늘 검사를 비교하여 변화한 필드 목록을 반환.
 * UI에서 변경된 항목 하이라이트 / 노트 자동 생성 / 추이 그래프에 활용.
 */
export function detectChanges(yesterday: ExamRegions, today: ExamRegions): FieldChange[] {
  const changes: FieldChange[] = [];
  walk('', yesterday, today, changes);
  return changes;
}

/**
 * 변화감지에서 제외할 leaf 필드.
 * - 서술형 텍스트(hx/notes/memo)는 '오늘 변화'에 노출하면 지저분하고 별도로 표시됨
 * - dermatome 관련 복합 데이터는 radicularPain/VAS 등 스칼라로 이미 변화가 포착됨
 */
const CHANGE_EXCLUDED_FIELDS = new Set([
  'hx',
  'notes',
  'note',
  'memo',
  'mainPain',
  'sensoryPain',
  'dermatomeQualities',
  'radicularQuality',
  'qualities',
]);

function walk(
  path: string,
  prev: unknown,
  next: unknown,
  out: FieldChange[],
): void {
  const leaf = path.split('.').pop() ?? '';
  if (CHANGE_EXCLUDED_FIELDS.has(leaf)) return;

  // 배열(dermatome 목록 등)은 변화감지에서 제외 — 스칼라 필드로 이미 포착됨
  if (Array.isArray(prev) || Array.isArray(next)) return;

  // 한쪽이라도 객체면 양쪽을 객체로 보고 재귀 (없는 쪽은 빈 객체로 취급)
  if (isPlainObject(prev) || isPlainObject(next)) {
    const p = isPlainObject(prev) ? prev : {};
    const n = isPlainObject(next) ? next : {};
    const keys = new Set([...Object.keys(p), ...Object.keys(n)]);
    for (const k of keys) {
      walk(path ? `${path}.${k}` : k, p[k], n[k], out);
    }
    return;
  }

  // 원시값 비교
  if (prev === next) return;
  if (prev == null && next == null) return;

  out.push({
    path,
    yesterday: prev,
    today: next,
    kind: classify(path, prev, next),
  });
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * 변화의 방향성을 분류.
 * Motor grade: 숫자가 크면 호전 / 작으면 악화
 * VAS: 숫자가 크면 악화 / 작으면 호전
 * 그 외: 'changed'
 */
function classify(path: string, prev: unknown, next: unknown): ChangeKind {
  if (prev == null && next != null) return 'new';
  if (prev != null && next == null) return 'changed';

  // motor 관련 필드 (숫자가 클수록 좋음)
  if (path.includes('motor') && typeof prev === 'number' && typeof next === 'number') {
    if (next > prev) return 'improved';
    if (next < prev) return 'worsened';
  }
  // vas (낮을수록 좋음)
  if (path.endsWith('vas') && typeof prev === 'number' && typeof next === 'number') {
    if (next < prev) return 'improved';
    if (next > prev) return 'worsened';
  }
  // sensory: intact가 가장 좋음
  if (path.includes('sensory') && typeof prev === 'string' && typeof next === 'string') {
    if (next === 'intact' && prev !== 'intact') return 'improved';
    if (prev === 'intact' && next !== 'intact') return 'worsened';
  }
  return 'changed';
}

/**
 * 변화 중 의학적으로 주목할 만한 것만 필터 (악화 + 새 이상).
 * 환자일보 상단의 alert에 사용.
 */
export function significantChanges(changes: FieldChange[]): FieldChange[] {
  return changes.filter((c) => c.kind === 'worsened');
}

/**
 * Motor grade 변화량 (음수면 악화)
 */
export function motorDelta(prev: MotorGrade, next: MotorGrade): number | null {
  if (prev == null || next == null) return null;
  return next - prev;
}

/**
 * path를 사람이 읽을 수 있는 라벨로 변환.
 * 예: "lumbar.motor.kneeExt.rt" → "L Knee ext (Rt)"
 */
const REGION_ABBR: Record<string, string> = {
  brain: 'Brain',
  cervical: 'C',
  thoracic: 'T',
  lumbar: 'L',
};

const FIELD_LABELS: Record<string, string> = {
  backPain: 'Back pain',
  nuchalPain: 'Nuchal pain',
  radicularPain: 'Radicular pain',
  backVas: 'Back VAS',
  nuchalVas: 'Nuchal VAS',
  radicularVas: 'Radicular VAS',
  nic: 'NIC',
  fever: '발열',
  hipFlex: 'Hip flex',
  kneeExt: 'Knee ext',
  kneeFlex: 'Knee flex',
  ankleDF: 'Ankle DF',
  ankleEHL: 'EHL',
  anklePF: 'Ankle PF',
  shoulder: 'Shoulder',
  elbowFlex: 'Elbow flex',
  elbowExt: 'Elbow ext',
  wristExt: 'Wrist ext',
  wristFlex: 'Wrist flex',
  grasp: 'Grasp',
  fingerAbd: 'Finger abd',
  knee: 'Knee',
  ankle: 'Ankle',
  biceps: 'Biceps',
  triceps: 'Triceps',
  brachioradialis: 'BR',
};

function humanizePath(path: string): string {
  const parts = path.split('.');
  const region = REGION_ABBR[parts[0]] ?? parts[0];
  const bits: string[] = [];
  for (let i = 1; i < parts.length; i++) {
    const p = parts[i];
    if (p === 'motor' || p === 'dtr' || p === 'sensory') continue;
    if (p === 'lt') { bits.push('(Lt)'); continue; }
    if (p === 'rt') { bits.push('(Rt)'); continue; }
    bits.push(FIELD_LABELS[p] ?? p);
  }
  return `${region} ${bits.join(' ')}`.trim();
}

/**
 * 변화 목록을 사람이 읽는 짧은 문장 배열로.
 * 배너 표시용. worsened/improved/new만 표시 (unchanged 제외).
 */
/**
 * 'new'(이전 값 없음 → 새 값) 변화 중, 새 값이 "정상"이면 변화로 치지 않는다.
 * baseline에 motor/dtr를 기록 안 했다가 오늘 정상으로 채워진 경우 등 — 임상적 변화가 아님.
 */
function isNormalNewValue(path: string, val: unknown): boolean {
  if (val === false || val == null) return true;
  const leaf = (path.split('.').pop() ?? '').toLowerCase();
  if (path.includes('.motor.') && val === 5) return true; // motor 5/5 = 정상
  if (path.includes('.dtr.') && val === 2) return true; // DTR 2 = 정상
  if (path.includes('sensory') && val === 'intact') return true;
  if (leaf.endsWith('vas') && val === 0) return true;
  return false;
}

export function describeChanges(changes: FieldChange[]): {
  worsened: string[];
  improved: string[];
  other: string[];
} {
  const worsened: string[] = [];
  const improved: string[] = [];
  const other: string[] = [];

  for (const c of changes) {
    if (c.kind === 'unchanged') continue;
    // 새로 기록됐지만 정상값이면(=이상 아님) 변화로 표시하지 않음
    if (c.kind === 'new' && isNormalNewValue(c.path, c.today)) continue;

    const label = humanizePath(c.path);
    const arrow =
      typeof c.yesterday !== 'undefined' && c.yesterday !== null
        ? `${formatVal(c.yesterday)}→${formatVal(c.today)}`
        : `${formatVal(c.today)}`;
    const text = `${label} ${arrow}`.trim();

    if (c.kind === 'worsened') worsened.push(text);
    else if (c.kind === 'improved') improved.push(text);
    else other.push(text);
  }

  return { worsened, improved, other };
}

function formatVal(v: unknown): string {
  if (v === true) return '(+)';
  if (v === false || v == null) return '(−)';
  if (typeof v === 'object') return ''; // 객체/배열은 표시하지 않음 (안전장치)
  return String(v);
}
