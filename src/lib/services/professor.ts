import { cookies } from 'next/headers';

export const PROFESSOR_COOKIE = 'nr_professor';

/**
 * 현재 선택된 교수님 (서버 컴포넌트용).
 *   - 'ALL'  : 전체 보드 (모든 교수님)
 *   - 'D'..  : 해당 교수님만
 *   - null   : 아직 선택 안 함 → 선택 화면으로
 */
export async function getSelectedProfessor(): Promise<string | null> {
  const store = await cookies();
  const v = store.get(PROFESSOR_COOKIE)?.value;
  return v || null;
}

/** 환자 목록을 선택된 교수님으로 필터 */
export function filterByProfessor<T extends { professor?: string | null }>(
  patients: T[],
  professor: string | null,
): T[] {
  if (!professor || professor === 'ALL') return patients;
  return patients.filter((p) => (p.professor ?? null) === professor);
}
