import { todayKST } from '@/lib/utils/date';
import { createClient } from '@/lib/supabase/server';
import { patientRepository } from '@/lib/repositories/patientRepository';
import { getSelectedProfessor, filterByProfessor } from '@/lib/services/professor';
import { examRepository } from '@/lib/repositories/examRepository';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { collectReports } from '@/lib/services/reportBuilder';
import { isAdmissionPending } from '@/types/domainV2';
import { BoardReportClient } from '@/components/board/BoardReportClient';

export const dynamic = 'force-dynamic';

export default async function BoardReportPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const allPatients = await patientRepository.listActive(supabase);
  const selectedProfessor = await getSelectedProfessor();
  const patients = filterByProfessor(allPatients as { professor?: string | null }[], selectedProfessor) as typeof allPatients;
  const today = todayKST();

  // 입원 안 한 수술 예정자(입원일 미래) 제외 — 환자일보는 입원 중인 환자만
  const admitted = patients.filter((p) => !isAdmissionPending(p.admitted_at, today) && p.surgery_type !== 'local');

  // 최근 exam을 한 번의 쿼리로 배치 조회 (N+1 제거) 후 환자별 최근 7건만 사용
  const recentByPatient = await examRepository.findRecentForPatients(
    supabase,
    admitted.map((p) => p.id),
  );
  const examsByPatient = new Map<string, Record<string, unknown>[]>();
  for (const p of admitted) {
    examsByPatient.set(p.id, (recentByPatient.get(p.id) ?? []).slice(0, 7));
  }

  const reports = collectReports(admitted, examsByPatient, new Date(today));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-medium dark:text-slate-100">환자일보</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {today} · 회진 순서 · {reports.length}명
          </p>
        </div>
        <Link
          href="/board"
          className="rounded-md border border-slate-300 px-3 py-1.5 text-xs dark:border-slate-700 dark:text-slate-300"
        >
          ← 보드로
        </Link>
      </div>

      <BoardReportClient reports={reports} date={today} />
    </div>
  );
}
