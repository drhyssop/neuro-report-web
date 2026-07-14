import { todayDateKST } from '@/lib/utils/date';
import { createClient } from '@/lib/supabase/server';
import { patientRepository } from '@/lib/repositories/patientRepository';
import { getSelectedProfessor, filterByProfessor } from '@/lib/services/professor';
import { holidayRepository } from '@/lib/repositories/holidayRepository';
import { examRepository } from '@/lib/repositories/examRepository';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { isAdmissionPending } from '@/types/domainV2';
import { collectReports } from '@/lib/services/reportBuilder';
import { buildMViewSections } from '@/lib/services/mviewBuilder';
import { PrintClient } from '@/components/board/PrintClient';

export const dynamic = 'force-dynamic';

export default async function BoardPrintPage() {
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
  const today = todayDate.toISOString().slice(0, 10);

  // 최근 exam을 한 번의 쿼리로 배치 조회 (N+1 제거). 환자별 최근 7건만 사용.
  const recentByPatient = await examRepository.findRecentForPatients(
    supabase,
    patients.map((p) => p.id),
  );
  const examsByPatient = new Map<string, Record<string, unknown>[]>();
  for (const p of patients) {
    examsByPatient.set(p.id, (recentByPatient.get(p.id) ?? []).slice(0, 7));
  }

  // m-view 섹션 분류 + 환자 변환은 공유 함수로 (m-view 화면과 동일 로직)
  const sections = buildMViewSections(patients, todayDate, holidaySet);

  const admitted = patients.filter((p) => !isAdmissionPending(p.admitted_at, today) && p.surgery_type !== 'local');
  const admittedExamsByPatient = new Map<string, Record<string, unknown>[]>();
  for (const p of admitted) {
    admittedExamsByPatient.set(p.id, examsByPatient.get(p.id) ?? []);
  }
  const reports = collectReports(admitted, admittedExamsByPatient, todayDate);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-lg font-medium dark:text-slate-100">회진문서 출력</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {today} · 출력용 — m-view + 환자일보 통합
          </p>
        </div>
        <Link
          href="/board"
          className="rounded-md border border-slate-300 px-3 py-1.5 text-xs dark:border-slate-700 dark:text-slate-300"
        >
          ← 보드로
        </Link>
      </div>

      <PrintClient sections={sections} reports={reports} date={today} />
    </div>
  );
}
