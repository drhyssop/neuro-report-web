import { createClient } from '@/lib/supabase/server';
import { patientRepository } from '@/lib/repositories/patientRepository';
import { CalendarView } from '@/components/calendar/CalendarView';
import { surgeryStatus } from '@/types/domainV2';

export const dynamic = 'force-dynamic';

export default async function CalendarPage() {
  const supabase = await createClient();
  const patients = await patientRepository.listActive(supabase);

  const events: Array<{
    date: string;
    patientId: string;
    patientAlias: string;
    ward: string | null;
    type: 'surgery_planned' | 'surgery_done' | 'expected_discharge' | 'admitted';
    label: string;
  }> = [];

  const today = new Date();
  for (const p of patients) {
    if (p.surgery_date) {
      const status = surgeryStatus(p.surgery_date, today);
      events.push({
        date: p.surgery_date,
        patientId: p.id,
        patientAlias: p.alias,
        ward: p.ward,
        type: status === 'planned' ? 'surgery_planned' : 'surgery_done',
        label: `${status === 'planned' ? '수술예정' : '수술'}: ${p.surgery_name || ''}`,
      });
    }
    if (p.expected_discharge) {
      events.push({
        date: p.expected_discharge,
        patientId: p.id,
        patientAlias: p.alias,
        ward: p.ward,
        type: 'expected_discharge',
        label: '퇴원예정',
      });
    }
    events.push({
      date: p.admitted_at,
      patientId: p.id,
      patientAlias: p.alias,
      ward: p.ward,
      type: 'admitted',
      label: '입원',
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-medium dark:text-slate-100">캘린더</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          입원/수술/퇴원 일정 한눈에 보기
        </p>
      </div>
      <CalendarView events={events} />
    </div>
  );
}
