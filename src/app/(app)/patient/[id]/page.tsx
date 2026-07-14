import { todayKST } from '@/lib/utils/date';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { patientRepository } from '@/lib/repositories/patientRepository';
import { examRepository } from '@/lib/repositories/examRepository';
import { PatientExamForm } from '@/components/exam/PatientExamForm';
import { BaselineSection } from '@/components/exam/BaselineSection';
import { PatientAntibioticsBox } from '@/components/exam/PatientAntibioticsBox';
import { PatientImagingBox } from '@/components/exam/PatientImagingBox';
import { PatientConsultBox } from '@/components/exam/PatientConsultBox';
import { PatientRoundingNotesBox } from '@/components/exam/PatientRoundingNotesBox';
import { PatientMedicationsBox } from '@/components/exam/PatientMedicationsBox';
import { DischargeButton } from '@/components/patient/DischargeButton';
import { DeletePatientButton } from '@/components/patient/DeletePatientButton';
import { redirect } from 'next/navigation';
import { computePod, surgeryStatus } from '@/types/domainV2';
import type { DrainTube, DrainOutputs, AntibioticEntry, ImagingLogEntry, ConsultReferral } from '@/types/domainV2';
import type { ExamRegions, Region } from '@/types/domain';

export const dynamic = 'force-dynamic';

export default async function PatientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const patient = await patientRepository.findById(supabase, id);
  const today = todayKST();

  const todayExam = await examRepository.getOrCreateForToday(supabase, id, user.id, today);
  const allExams = await examRepository.findByPatient(supabase, id, 10);
  const yesterdayExam = allExams.find((e) => e.id !== todayExam.id);

  const surgeryDate = patient.surgery_date as string | null;
  const status = surgeryStatus(surgeryDate, new Date(today));
  const pod = computePod(surgeryDate, new Date(today));

  const baselineRegions = (patient.baseline_regions ?? {}) as ExamRegions;

  const drainsLog = (patient.drains_log as DrainTube[] | null) ?? [];
  const yesterdayDrainOutputs = (yesterdayExam?.drain_outputs as DrainOutputs | undefined) ?? {};
  const todayDrainOutputs = (todayExam.drain_outputs as DrainOutputs | undefined) ?? {};

  // 환자 추이용 — 최근 10개 examination의 drain_outputs만 추출
  const examHistory = allExams.map((e) => ({
    exam_date: e.exam_date as string,
    drain_outputs: (e.drain_outputs as DrainOutputs | undefined) ?? {},
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            {patient.ward && (
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium dark:bg-slate-800 dark:text-slate-300">
                {patient.ward}
              </span>
            )}
            <h1 className="text-lg font-medium dark:text-slate-100">{patient.alias}</h1>
            {patient.age != null && (
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {patient.age}{patient.sex || ''}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {patient.diagnosis || '진단명 미입력'} · 입원 {patient.admitted_at}
            {todayExam.hospital_day != null && ` · HD#${todayExam.hospital_day}`}
            {status === 'done' && pod != null && ` · POD #${pod}`}
            {status === 'planned' && ` · 수술예정 ${surgeryDate}`}
          </p>
          {(patient.surgery_name || patient.bmd) && (
            <p className="text-xs text-slate-600 dark:text-slate-300">
              {patient.surgery_name && <>수술: {patient.surgery_name}</>}
              {patient.bmd ? (
                <span className={patient.surgery_name ? 'ml-2' : ''}>BMD: {patient.bmd as string}</span>
              ) : null}
            </p>
          )}
          {patient.is_consult && (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              협진 환자 · {patient.consult_dept || '원과 미입력'}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/patient/${id}/edit`}
            className="rounded-md border border-slate-300 px-3 py-1 text-xs dark:border-slate-700 dark:text-slate-300"
          >
            정보 편집
          </Link>
          <DischargeButton patientId={id} patientAlias={patient.alias} />
          <DeletePatientButton patientId={id} patientAlias={patient.alias} />
        </div>
      </div>

      {/* Drain/항생제/영상은 환자 단위로, 매일 보는 환자 상세에 위치 */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <PatientAntibioticsBox
          patientId={id}
          antibioticsLog={(patient.antibiotics_log as AntibioticEntry[] | null) ?? []}
        />
        <div className="space-y-4">
          <PatientImagingBox
            patientId={id}
            imagingLog={(patient.imaging_log as ImagingLogEntry[] | null) ?? []}
          />
          <PatientMedicationsBox
            patientId={id}
            medications={(patient.medications as import('@/types/domainV2').Medications | null) ?? {}}
          />
        </div>
        <PatientConsultBox
          patientId={id}
          consultsLog={(patient.consults_log as ConsultReferral[] | null) ?? []}
        />
      </div>

      {/* 회진 누적 메모 — 협진 아래, 기존 증상 위 */}
      <PatientRoundingNotesBox
        patientId={id}
        notes={(patient.rounding_notes as import('@/types/domainV2').RoundingNote[] | null) ?? []}
      />

      {/* 기존 증상 (입원 시 baseline) — 항상 보임, 편집 가능 */}
      <BaselineSection
        patientId={id}
        initialBaseline={baselineRegions}
        initialActiveRegion={(patient.region_main ?? 'lumbar') as Region}
      />

      <PatientExamForm
        patientId={id}
        patientAlias={patient.alias}
        diagnosis={patient.diagnosis}
        examId={todayExam.id}
        examDate={todayExam.exam_date}
        hospitalDay={todayExam.hospital_day}
        initialRegions={(todayExam.regions ?? {}) as ExamRegions}
        yesterdayRegions={(yesterdayExam?.regions ?? null) as ExamRegions | null}
        baselineRegions={baselineRegions}
        initialActiveRegion={(patient.region_main ?? 'lumbar') as Region}
        initialReviewedAt={(todayExam.reviewed_at as string | null) ?? null}
        initialDailyNote={(todayExam.daily_note as string | null) ?? null}
        initialExtras={{
          fever: todayExam.fever ?? false,
          fever_temp: todayExam.fever_temp ?? null,
          drainOutputs: todayDrainOutputs,
          labs: (todayExam.labs as import('@/types/domainV2').Labs | undefined) ?? {},
        }}
        drainsLog={drainsLog}
        yesterdayDrainOutputs={yesterdayDrainOutputs}
        examHistory={examHistory}
      />
    </div>
  );
}
