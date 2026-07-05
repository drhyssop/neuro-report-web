import { todayKST } from '@/lib/utils/date';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { patientRepository } from '@/lib/repositories/patientRepository';
import { examRepository } from '@/lib/repositories/examRepository';
import { BoardRealtime } from '@/components/patient/BoardRealtime';
import {
  roundingSortKey,
  computePod,
  surgeryStatus,
  formatSurgeryDateNatural,
  antibioticShort,
  antibioticDays,
  isAdmissionPending,
} from '@/types/domainV2';
import type { AntibioticEntry } from '@/types/domainV2';

export const dynamic = 'force-dynamic';

interface PatientRow {
  id: string;
  alias: string;
  diagnosis: string | null;
  region_main: string | null;
  admitted_at: string;
  expected_discharge: string | null;
  ward: string | null;
  age: number | null;
  sex: string | null;
  surgery_date: string | null;
  surgery_name: string | null;
  surgery_type: string | null;
  bed_seat: number | null;
  is_consult: boolean | null;
  consult_dept: string | null;
  is_admission_pending: boolean | null;
  antibiotics_log: unknown;
  drains_log: unknown;
}

export default async function BoardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const patients = await patientRepository.listActive(supabase);
  const today = todayKST();

  // 최근 exam을 한 번의 쿼리로 배치 조회 (N+1 제거)
  const examsByPatient = await examRepository.findRecentForPatients(
    supabase,
    patients.map((p) => p.id),
  );
  const lastExamByPatient = new Map<string, Record<string, unknown>>();
  for (const p of patients) {
    const exams = examsByPatient.get(p.id);
    if (exams && exams.length > 0) lastExamByPatient.set(p.id, exams[0]);
  }

  // 4-카테고리 분류 (우선순위: 로컬수술 > 협진 > 입원예정 > 입원환자)
  const pend = (p: { admitted_at: string }) => isAdmissionPending(p.admitted_at, today);
  const isLocal = (p: { surgery_type?: string | null }) => p.surgery_type === 'local';
  const local = patients.filter((p) => isLocal(p));
  const consult = patients.filter((p) => !isLocal(p) && p.is_consult);
  const pending = patients.filter((p) => !isLocal(p) && !p.is_consult && pend(p));
  const admitted = patients.filter((p) => !isLocal(p) && !p.is_consult && !pend(p));

  // 각 카테고리 회진 순서 정렬
  const sortByWard = <T extends { ward: string | null; bed_seat?: number | null }>(arr: T[]) =>
    [...arr].sort(
      (a, b) =>
        roundingSortKey(a.ward, a.bed_seat ?? null) - roundingSortKey(b.ward, b.bed_seat ?? null),
    );

  const admittedByAdmission = [...admitted].sort((a, b) =>
    a.admitted_at.localeCompare(b.admitted_at),
  ); // 입원 오래된 순
  const localSorted = sortByWard(local);
  const consultSorted = sortByWard(consult);
  const pendingSorted = sortByWard(pending);

  const isUpdatedToday = (p: PatientRow) => {
    const exam = lastExamByPatient.get(p.id);
    return !!exam && (exam.exam_date as string) === today;
  };
  const admittedUpdatedCount = admittedByAdmission.filter(isUpdatedToday).length;

  return (
    <div className="space-y-4">
      {user && <BoardRealtime userId={user.id} />}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-medium dark:text-slate-100">
            입원 환자 ({patients.length})
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            오늘 회진 {admittedUpdatedCount} / {admitted.length}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/board/print"
            className="rounded-md bg-slate-900 px-3 py-1.5 text-xs text-white dark:bg-slate-100 dark:text-slate-900"
          >
            회진문서 출력
          </Link>
          <Link
            href="/board/report"
            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs dark:border-slate-700 dark:text-slate-300"
          >
            전체 환자일보
          </Link>
          <Link
            href="/settings/holidays"
            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs dark:border-slate-700 dark:text-slate-300"
          >
            공휴일
          </Link>
          <Link
            href="/patient/new"
            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs dark:border-slate-700 dark:text-slate-300"
          >
            + 환자
          </Link>
        </div>
      </div>

      {patients.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          입원 환자가 없습니다. 환자를 추가해주세요.
        </p>
      ) : (
        <div className="space-y-6">
          {/* 입원 환자 — 입원 오래된 순, 회진여부는 카드 우상단 점으로 */}
          <CategoryBlock title="입원 환자" count={admitted.length} accent="blue" emptyText="입원 환자 없음">
            <CardCols>
              {admittedByAdmission.map((p) => (
                <CardCell key={p.id}>
                  <PatientCard
                    patient={p}
                    lastExam={lastExamByPatient.get(p.id)}
                    today={today}
                    needsUpdate={!isUpdatedToday(p)}
                  />
                </CardCell>
              ))}
            </CardCols>
          </CategoryBlock>

          {/* 로컬 수술 */}
          <CategoryBlock title="로컬 수술" count={local.length} accent="rose" emptyText="로컬 수술 환자 없음">
            <CardCols>
              {localSorted.map((p) => (
                <CardCell key={p.id}>
                  <PatientCard patient={p} lastExam={lastExamByPatient.get(p.id)} today={today} needsUpdate={false} />
                </CardCell>
              ))}
            </CardCols>
          </CategoryBlock>

          {/* 협진 환자 */}
          <CategoryBlock title="협진 환자" count={consult.length} accent="amber" emptyText="협진 환자 없음">
            <CardCols>
              {consultSorted.map((p) => (
                <CardCell key={p.id}>
                  <PatientCard
                    patient={p}
                    lastExam={lastExamByPatient.get(p.id)}
                    today={today}
                    needsUpdate={
                      !lastExamByPatient.get(p.id) ||
                      (lastExamByPatient.get(p.id)!.exam_date as string) !== today
                    }
                  />
                </CardCell>
              ))}
            </CardCols>
          </CategoryBlock>

          {/* 입원예정 환자 */}
          <CategoryBlock title="입원예정 환자" count={pending.length} accent="slate" emptyText="입원예정 환자 없음">
            <CardCols>
              {pendingSorted.map((p) => (
                <CardCell key={p.id}>
                  <PatientCard patient={p} lastExam={undefined} today={today} needsUpdate={false} isPending />
                </CardCell>
              ))}
            </CardCols>
          </CategoryBlock>
        </div>
      )}
    </div>
  );
}

/** 세로로 쌓이는 카테고리 블록 — 카드는 내부에서 3단(PC) 배치 */
function CategoryBlock({
  title,
  count,
  accent,
  emptyText,
  children,
}: {
  title: string;
  count: number;
  accent: 'blue' | 'amber' | 'slate' | 'rose';
  emptyText: string;
  children: React.ReactNode;
}) {
  const colorMap = {
    blue: 'border-blue-400 text-blue-700 dark:border-blue-700 dark:text-blue-300',
    amber: 'border-amber-400 text-amber-700 dark:border-amber-700 dark:text-amber-300',
    rose: 'border-rose-400 text-rose-700 dark:border-rose-700 dark:text-rose-300',
    slate: 'border-slate-400 text-slate-700 dark:border-slate-600 dark:text-slate-400',
  };
  return (
    <section className="space-y-3">
      <div className={`border-l-4 pl-2 text-sm font-semibold ${colorMap[accent]}`}>
        {title} ({count})
      </div>
      {count === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-xs text-slate-400 dark:border-slate-700 dark:text-slate-500">
          {emptyText}
        </p>
      ) : (
        <div className="space-y-4">{children}</div>
      )}
    </section>
  );
}

/** 카드를 3단(PC) / 1단(모바일)으로 흘려 배치 */
function CardCols({ children }: { children: React.ReactNode }) {
  return <div className="columns-1 gap-3 md:columns-2 lg:columns-3">{children}</div>;
}

/** CSS 컬럼에서 카드가 단 경계에서 잘리지 않게 */
function CardCell({ children }: { children: React.ReactNode }) {
  return <div className="mb-3 break-inside-avoid">{children}</div>;
}

function PatientCard({
  patient: p,
  lastExam,
  today,
  needsUpdate,
  isPending,
}: {
  patient: PatientRow;
  lastExam?: Record<string, unknown>;
  today: string;
  needsUpdate: boolean;
  isPending?: boolean;
}) {
  const days =
    Math.floor(
      (new Date(today).getTime() - new Date(p.admitted_at).getTime()) / (1000 * 60 * 60 * 24),
    ) + 1;
  const pod = computePod(p.surgery_date, new Date(today));
  const status = surgeryStatus(p.surgery_date, new Date(today));

  // 활성 drain count (drains_log에서 ended_at이 없는 것)
  const drainsLog = (p.drains_log as { ended_at?: string | null }[] | null) ?? [];
  const activeDrains = drainsLog.filter((d) => !d.ended_at);
  const fever = !!lastExam?.fever;
  const feverTemp = lastExam?.fever_temp as number | undefined;

  const antibioticsLog = (p.antibiotics_log as AntibioticEntry[] | null) ?? [];
  const ongoingAbx = antibioticsLog
    .filter((e) => !e.ended_at)
    .map((e) => ({
      short: antibioticShort(e.name),
      days: antibioticDays(e, new Date(today)),
    }));

  let dischargeSoon = false;
  if (p.expected_discharge) {
    const exp = new Date(p.expected_discharge);
    const t = new Date(today);
    const diffDays = Math.floor((exp.getTime() - t.getTime()) / (1000 * 60 * 60 * 24));
    dischargeSoon = diffDays >= 0 && diffDays <= 3;
  }

  const isLocalP = p.surgery_type === 'local';
  const surgeryNatural = formatSurgeryDateNatural(p.surgery_date, new Date(today));

  // 1줄: 진단명 · HD#? / 입원예정일 / 로컬수술일
  const line1Parts: string[] = [];
  line1Parts.push(p.diagnosis || '진단명 미입력');
  if (isLocalP) {
    if (p.surgery_date) line1Parts.push(`로컬 · ${surgeryNatural}${status === 'planned' ? ' 예정' : ''}`);
    else line1Parts.push('로컬 수술');
  } else if (isPending) {
    line1Parts.push(`입원예정 ${p.admitted_at}`);
  } else {
    line1Parts.push(`HD#${days}`);
  }

  // 2줄: 수술명 · POD#? / 예정일. 로컬은 POD 없이 수술명만 (날짜는 1줄에 표시).
  let line2: string | null = null;
  if (p.surgery_name || p.surgery_date) {
    const pieces: string[] = [];
    if (p.surgery_name) pieces.push(`수술: ${p.surgery_name}`);
    if (!isLocalP) {
      if (status === 'done' && pod !== null) {
        pieces.push(`POD #${pod}`);
      } else if (status === 'planned') {
        pieces.push(`${surgeryNatural} 예정`);
      }
    }
    line2 = pieces.join(' · ');
  }

  return (
    <Link
      href={`/patient/${p.id}`}
      className="block rounded-lg border border-slate-200 bg-white p-3 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-500"
    >
      {/* 헤더 */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {p.ward && (
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium dark:bg-slate-800 dark:text-slate-300">
                {p.ward}
              </span>
            )}
            <div className="truncate text-sm font-medium dark:text-slate-100">{p.alias}</div>
            {p.age != null && (
              <span className="text-[10px] text-slate-400 dark:text-slate-500">
                {p.age}{p.sex || ''}
              </span>
            )}
          </div>
        </div>
        {!isPending && (
          <span
            className={`mt-1 inline-block h-2 w-2 flex-shrink-0 rounded-full ${
              needsUpdate ? 'bg-amber-500' : 'bg-emerald-500'
            }`}
          />
        )}
      </div>

      {/* 1줄 */}
      <div className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
        {line1Parts.join(' · ')}
      </div>

      {/* 2줄 */}
      {line2 && (
        <div className="mt-0.5 truncate text-xs text-slate-700 dark:text-slate-200">
          {line2}
        </div>
      )}

      {/* 배지 */}
      {!isPending && (
        <div className="mt-2 flex flex-wrap gap-1 text-[10px]">
          {activeDrains.length > 0 && <Badge color="cyan">drain {activeDrains.length}</Badge>}
          {fever && <Badge color="red">{feverTemp ? `${feverTemp}°C` : 'fever'}</Badge>}
          {ongoingAbx.map((a, i) => (
            <Badge key={i} color="slate">
              {a.short} {a.days}d
            </Badge>
          ))}
          {p.is_consult && <Badge color="amber">{p.consult_dept || 'consult'}</Badge>}
          {dischargeSoon && <Badge color="green">퇴원임박</Badge>}
        </div>
      )}
    </Link>
  );
}

function Badge({
  color,
  children,
}: {
  color: 'red' | 'amber' | 'purple' | 'blue' | 'cyan' | 'slate' | 'green';
  children: React.ReactNode;
}) {
  const map = {
    red: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
    amber: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
    purple: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300',
    blue: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
    cyan: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300',
    slate: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    green: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  };
  return <span className={`rounded px-1.5 py-0.5 ${map[color]}`}>{children}</span>;
}
