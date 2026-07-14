import { createClient } from '@/lib/supabase/server';
import { patientRepository } from '@/lib/repositories/patientRepository';
import { examRepository } from '@/lib/repositories/examRepository';
import { TrendChart } from '@/components/trend/TrendChart';
import { MOTOR_GROUPS } from '@/lib/constants/regions';
import { redirect } from 'next/navigation';
import type { ExamRegions, Region } from '@/types/domain';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function TrendPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const patient = await patientRepository.findById(supabase, id);
  const exams = await examRepository.findByPatient(supabase, id, 30);
  const sorted = [...exams].reverse(); // 오래된 것부터

  // VAS 추이 — 실제 필드(backVas/radicularVas/nuchalVas) 사용
  const vasData = sorted.map((e) => {
    const r = e.regions as ExamRegions;
    const lum = r.lumbar as { backVas?: number; radicularVas?: number } | undefined;
    const cer = r.cervical as { nuchalVas?: number; radicularVas?: number } | undefined;
    return {
      date: e.exam_date.slice(5),
      back: lum?.backVas ?? null,
      lumbar_radic: lum?.radicularVas ?? null,
      nuchal: cer?.nuchalVas ?? null,
      cervical_radic: cer?.radicularVas ?? null,
    };
  });
  // 값이 한 번이라도 있는 VAS 계열만 표시
  const allVasSeries = [
    { key: 'back', label: 'Back', color: '#0F6E56' },
    { key: 'lumbar_radic', label: 'L-radicular', color: '#185FA5' },
    { key: 'nuchal', label: 'Nuchal', color: '#993C1D' },
    { key: 'cervical_radic', label: 'C-radicular', color: '#6B4FA0' },
  ];
  const vasSeries = allVasSeries.filter((s) =>
    vasData.some((p) => typeof (p as Record<string, unknown>)[s.key] === 'number'),
  );

  // 환자 주요 부위 기준 motor 그래프 결정
  const mainRegion = (patient.region_main ?? 'lumbar') as Region;

  // Brain motor 추이 (upper/lower)
  const brainMotorData: Array<{ date: string; [key: string]: string | number | null }> = sorted.map((e) => {
    const r = e.regions as ExamRegions;
    return {
      date: e.exam_date.slice(5),
      upper_lt: (r.brain?.motorUpper?.lt as number | undefined) ?? null,
      upper_rt: (r.brain?.motorUpper?.rt as number | undefined) ?? null,
      lower_lt: (r.brain?.motorLower?.lt as number | undefined) ?? null,
      lower_rt: (r.brain?.motorLower?.rt as number | undefined) ?? null,
    };
  });

  // Cervical/Lumbar motor — 각 그룹별 Lt/Rt
  function spineMotorData(region: 'cervical' | 'lumbar') {
    return sorted.map((e) => {
      const r = e.regions as ExamRegions;
      const m = (region === 'cervical' ? r.cervical?.motor : r.lumbar?.motor) ?? {};
      const point: { date: string; [key: string]: string | number | null } = {
        date: e.exam_date.slice(5),
      };
      for (const g of MOTOR_GROUPS[region]) {
        const v = (m as Record<string, { lt?: number; rt?: number } | undefined>)[g.key];
        point[`${g.key}_lt`] = v?.lt ?? null;
        point[`${g.key}_rt`] = v?.rt ?? null;
      }
      return point;
    });
  }

  // Drain 추이 — drains_log에 정의된 각 drain의 일자별 배출량(cc)
  const drainsLog = (patient.drains_log as
    | Array<{ id: string; type: string; side: string; index?: number; started_at: string; ended_at?: string | null }>
    | null) ?? [];
  const drainPalette = ['#0F6E56', '#185FA5', '#993C1D', '#6B4FA0', '#A5851B', '#0E7490'];
  const drainSeries = drainsLog.map((d, i) => ({
    key: d.id,
    label: `${d.type} ${d.side}${d.index && d.index > 1 ? d.index : ''}`,
    color: drainPalette[i % drainPalette.length],
  }));
  const drainData = sorted.map((e) => {
    const out = (e.drain_outputs as Record<string, number> | undefined) ?? {};
    const point: { date: string; [key: string]: string | number | null } = {
      date: e.exam_date.slice(5),
    };
    for (const d of drainsLog) {
      point[d.id] = out[d.id] ?? null;
    }
    return point;
  });
  // 배출량 기록이 한 번이라도 있는 drain만 (전부 빈 라인은 숨김)
  const drainHasData = drainSeries.some((s) =>
    drainData.some((p) => typeof p[s.key] === 'number'),
  );
  // drain cc는 수십~수백까지 가므로 최댓값 기준으로 y축 스케일 (여유 20%)
  const drainMaxVal = drainData.reduce((mx, p) => {
    for (const s of drainSeries) {
      const v = p[s.key];
      if (typeof v === 'number' && v > mx) mx = v;
    }
    return mx;
  }, 0);
  const drainYMax = Math.max(10, Math.ceil((drainMaxVal * 1.2) / 10) * 10);

  // Lab 추이 — 스케일이 제각각이라 표로 표시
  const labRows = sorted
    .map((e) => ({
      date: e.exam_date.slice(5),
      labs: (e.labs as { wbc?: number; hb?: number; crp?: number; cr?: number; na?: number; k?: number } | undefined) ?? {},
    }))
    .filter(
      (r) =>
        r.labs.wbc != null ||
        r.labs.hb != null ||
        r.labs.crp != null ||
        r.labs.cr != null ||
        r.labs.na != null ||
        r.labs.k != null,
    );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-medium">추이</h1>
          <p className="text-xs text-slate-500">
            {patient.alias} · 최근 {exams.length}건 · 주요 부위 {mainRegion}
          </p>
        </div>
        <Link
          href={`/patient/${id}`}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-xs"
        >
          ← 환자
        </Link>
      </div>

      <TrendChart
        title="VAS (통증)"
        data={vasData}
        yMax={10}
        series={vasSeries.length > 0 ? vasSeries : allVasSeries}
      />

      {drainHasData && (
        <TrendChart
          title="Drain 배출량 (cc)"
          data={drainData}
          yMax={drainYMax}
          series={drainSeries}
        />
      )}

      {labRows.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <h3 className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-200">Lab 추이</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-500 dark:text-slate-400">
                  <th className="px-2 py-1 text-left">날짜</th>
                  <th className="px-2 py-1 text-right">WBC</th>
                  <th className="px-2 py-1 text-right">Hb</th>
                  <th className="px-2 py-1 text-right">CRP</th>
                  <th className="px-2 py-1 text-right">Cr</th>
                  <th className="px-2 py-1 text-right">Na</th>
                  <th className="px-2 py-1 text-right">K</th>
                </tr>
              </thead>
              <tbody>
                {labRows.map((r) => (
                  <tr key={r.date} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="px-2 py-1 font-medium dark:text-slate-300">{r.date}</td>
                    <td className="px-2 py-1 text-right dark:text-slate-300">{r.labs.wbc ?? '-'}</td>
                    <td className="px-2 py-1 text-right dark:text-slate-300">{r.labs.hb ?? '-'}</td>
                    <td className="px-2 py-1 text-right dark:text-slate-300">{r.labs.crp ?? '-'}</td>
                    <td className="px-2 py-1 text-right dark:text-slate-300">{r.labs.cr ?? '-'}</td>
                    <td className="px-2 py-1 text-right dark:text-slate-300">{r.labs.na ?? '-'}</td>
                    <td className="px-2 py-1 text-right dark:text-slate-300">{r.labs.k ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {(mainRegion === 'brain' || patient.region_main == null) && (
        <>
          <TrendChart
            title="Brain — Upper extremity motor"
            data={brainMotorData}
            series={[
              { key: 'upper_lt', label: 'Lt', color: '#993C1D' },
              { key: 'upper_rt', label: 'Rt', color: '#185FA5' },
            ]}
          />
          <TrendChart
            title="Brain — Lower extremity motor"
            data={brainMotorData}
            series={[
              { key: 'lower_lt', label: 'Lt', color: '#993C1D' },
              { key: 'lower_rt', label: 'Rt', color: '#185FA5' },
            ]}
          />
        </>
      )}

      {mainRegion === 'cervical' &&
        MOTOR_GROUPS.cervical.map((g) => (
          <TrendChart
            key={g.key}
            title={`Cervical — ${g.label}`}
            data={spineMotorData('cervical')}
            series={[
              { key: `${g.key}_lt`, label: 'Lt', color: '#993C1D' },
              { key: `${g.key}_rt`, label: 'Rt', color: '#185FA5' },
            ]}
          />
        ))}

      {mainRegion === 'lumbar' &&
        MOTOR_GROUPS.lumbar.map((g) => (
          <TrendChart
            key={g.key}
            title={`Lumbar — ${g.label}`}
            data={spineMotorData('lumbar')}
            series={[
              { key: `${g.key}_lt`, label: 'Lt', color: '#993C1D' },
              { key: `${g.key}_rt`, label: 'Rt', color: '#185FA5' },
            ]}
          />
        ))}
    </div>
  );
}
