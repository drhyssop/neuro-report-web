import { todayDateKST, dateToStr } from '@/lib/utils/date';
import { createClient } from '@/lib/supabase/server';
import { patientRepository } from '@/lib/repositories/patientRepository';
import { getSelectedProfessor, filterByProfessor } from '@/lib/services/professor';
import { holidayRepository } from '@/lib/repositories/holidayRepository';
import { redirect } from 'next/navigation';
import { roundingSortKey, MVIEW_SUMMARY } from '@/types/domainV2';
import { MViewClient } from '@/components/mview/MViewClient';
import { buildMViewSections } from '@/lib/services/mviewBuilder';
export type { MViewPatient, MViewSection } from '@/lib/services/mviewBuilder';

export const dynamic = 'force-dynamic';

export default async function MViewPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const allPatients = await patientRepository.listActive(supabase);
  const selectedProfessor = await getSelectedProfessor();
  const patients = filterByProfessor(allPatients as { professor?: string | null }[], selectedProfessor) as typeof allPatients;
  const holidaySet = await holidayRepository.loadSet(supabase);
  const todayDate = todayDateKST();
  const today = dateToStr(todayDate);
  const isFriday = todayDate.getDay() === 5;

  const sortByWard = <T extends { ward: string | null; bed_seat?: number | null }>(arr: T[]) =>
    [...arr].sort(
      (a, b) =>
        roundingSortKey(a.ward, a.bed_seat ?? null) - roundingSortKey(b.ward, b.bed_seat ?? null),
    );

  // 섹션 분류 + 환자 변환은 공유 함수로 (회진문서 출력과 동일 로직)
  const sections = buildMViewSections(patients, todayDate, holidaySet);

  const allInSections = new Set<string>();
  sections.forEach((s) => s.patients.forEach((p) => allInSections.add(p.patientId)));
  const pickerPatients = sortByWard(patients.filter((p) => !allInSections.has(p.id))).map(
    (p) => ({
      id: p.id,
      alias: p.alias,
      ward: p.ward,
      diagnosis: p.diagnosis,
      isConsult: !!p.is_consult,
      consultDept: p.consult_dept,
    }),
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-medium dark:text-slate-100">m-view 리스트</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {today} {isFriday && '· 금요일이라 월요일 수술도 포함'} · 회진 전 전산 확인
        </p>
        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
          {MVIEW_SUMMARY}
        </p>
      </div>

      <MViewClient sections={sections} pickerPatients={pickerPatients} />
    </div>
  );
}
