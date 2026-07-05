import type {
  ExamRegions,
  LumbarExam,
  CervicalExam,
  BrainExam,
  ThoracicExam,
  Bilateral,
  MotorGrade,
  FieldChange,
} from '@/types/domain';

interface NoteContext {
  patientAlias: string;
  diagnosis?: string;
  examDate: string;       // YYYY-MM-DD
  hospitalDay?: number;
  regions: ExamRegions;
  changes: FieldChange[]; // 어제 대비 변화
}

/**
 * SOAP 형식의 환자일보 자동 생성.
 * 원본 앱은 결과를 단일 텍스트로 저장했지만, 우리는 구조화 데이터에서 매번 텍스트를 생성.
 * → 양식 바꾸기 쉬움, 변화 자동 강조 가능.
 */
export function generateSoapNote(ctx: NoteContext): string {
  const { patientAlias, diagnosis, examDate, hospitalDay, regions, changes } = ctx;

  const lines: string[] = [];

  // Header
  const podStr = hospitalDay != null ? ` (HD#${hospitalDay})` : '';
  lines.push(`${patientAlias} · ${examDate}${podStr}`);
  if (diagnosis) lines.push(`Dx) ${diagnosis}`);
  lines.push('');

  // S - Subjective
  const subjective = collectSubjective(regions);
  lines.push(`S> ${subjective || '특이 호소 없음'}`);

  // O - Objective
  lines.push('O>');
  for (const region of ['brain', 'cervical', 'thoracic', 'lumbar'] as const) {
    const data = regions[region];
    if (!data) continue;
    const objLines = renderObjective(region, data, changes);
    lines.push(...objLines.map((l) => `  ${l}`));
  }

  // A - Assessment (변화 요약)
  const worsened = changes.filter((c) => c.kind === 'worsened');
  const improved = changes.filter((c) => c.kind === 'improved');
  const assessmentParts: string[] = [];
  if (diagnosis) assessmentParts.push(diagnosis);
  if (worsened.length > 0) assessmentParts.push(`${worsened.length}개 항목 악화 관찰`);
  if (improved.length > 0) assessmentParts.push(`${improved.length}개 항목 호전`);
  if (worsened.length === 0 && improved.length === 0 && changes.length === 0)
    assessmentParts.push('어제와 동일');
  lines.push(`A> ${assessmentParts.join(', ')}`);

  // P - Plan (기본 템플릿, 사용자가 수정)
  lines.push(`P> 현 치료 유지, 변화 추이 관찰`);

  return lines.join('\n');
}

function collectSubjective(regions: ExamRegions): string {
  const parts: string[] = [];
  if (regions.lumbar?.hx) parts.push(regions.lumbar.hx);
  if (regions.cervical?.hx) parts.push(regions.cervical.hx);
  if (regions.brain?.hx) parts.push(regions.brain.hx);
  if (regions.thoracic?.hx) parts.push(regions.thoracic.hx);
  return parts.join('; ');
}

function renderObjective(
  region: keyof ExamRegions,
  data: BrainExam | CervicalExam | ThoracicExam | LumbarExam,
  changes: FieldChange[],
): string[] {
  const lines: string[] = [];
  const label = region.charAt(0).toUpperCase() + region.slice(1);
  lines.push(`[${label}]`);

  if (region === 'lumbar' || region === 'cervical') {
    const d = data as LumbarExam | CervicalExam;
    if (d.vas != null) {
      const tag = changeTag(changes, `${region}.vas`);
      lines.push(`- VAS: ${d.vas}/10${tag}`);
    }
    if (d.motor) {
      const motorLines = renderMotorGroup(d.motor, region, changes);
      lines.push(...motorLines);
    }
  }

  if (region === 'brain') {
    const d = data as BrainExam;
    if (d.mentalStatus) lines.push(`- Mental: ${d.mentalStatus}`);
    if (d.motorUpper) {
      const t = changeTag(changes, 'brain.motorUpper.lt') + changeTag(changes, 'brain.motorUpper.rt');
      lines.push(`- Upper motor: Lt ${grade(d.motorUpper.lt)}, Rt ${grade(d.motorUpper.rt)}${t}`);
    }
    if (d.motorLower) {
      const t = changeTag(changes, 'brain.motorLower.lt') + changeTag(changes, 'brain.motorLower.rt');
      lines.push(`- Lower motor: Lt ${grade(d.motorLower.lt)}, Rt ${grade(d.motorLower.rt)}${t}`);
    }
    if (d.aphasia && d.aphasia !== 'none') lines.push(`- Aphasia: ${d.aphasia}`);
  }

  if (data.notes) lines.push(`- Note: ${data.notes}`);
  return lines;
}

function renderMotorGroup(
  motor: Record<string, Bilateral<MotorGrade> | undefined>,
  region: string,
  changes: FieldChange[],
): string[] {
  const lines: string[] = [];
  for (const [key, val] of Object.entries(motor)) {
    if (!val) continue;
    const ltTag = changeTag(changes, `${region}.motor.${key}.lt`);
    const rtTag = changeTag(changes, `${region}.motor.${key}.rt`);
    lines.push(`- ${key}: Lt ${grade(val.lt)}${ltTag}, Rt ${grade(val.rt)}${rtTag}`);
  }
  return lines;
}

function grade(g: MotorGrade): string {
  return g == null ? '?' : `${g}/5`;
}

function changeTag(changes: FieldChange[], path: string): string {
  const c = changes.find((c) => c.path === path);
  if (!c) return '';
  if (c.kind === 'worsened') return ' ▼';
  if (c.kind === 'improved') return ' ▲';
  return '';
}
