'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { patientRepository } from '@/lib/repositories/patientRepository';
import { patientUpdateSchema, type PatientCreate } from '@/lib/schemas/patient';
import { PatientFormFields } from './PatientFormFields';

interface Props {
  patientId: string;
  initial: Record<string, unknown>;
}

export function PatientEditForm({ patientId, initial }: Props) {
  const router = useRouter();
  const [draft, setDraft] = useState<Partial<PatientCreate>>({
    alias: initial.alias as string,
    diagnosis: (initial.diagnosis as string) || undefined,
    region_main: (initial.region_main as PatientCreate['region_main']) || undefined,
    admitted_at: initial.admitted_at as string,
    age: (initial.age as number) ?? undefined,
    sex: (initial.sex as 'M' | 'F') || undefined,
    ward: (initial.ward as string) || undefined,
    bed_seat: (initial.bed_seat as number | null) ?? null,
    expected_discharge: (initial.expected_discharge as string) || undefined,
    surgery_name: (initial.surgery_name as string) || undefined,
    surgery_date: (initial.surgery_date as string) || undefined,
    surgery_type: (initial.surgery_type as 'general' | 'local') || undefined,
    bmd: (initial.bmd as string) || undefined,
    is_consult: (initial.is_consult as boolean) ?? false,
    consult_dept: (initial.consult_dept as string) || undefined,
    consult_history: (initial.consult_history as string) || undefined,
    patient_memo: (initial.patient_memo as string) || undefined,
    past_op_history: (initial.past_op_history as string) || undefined,
    is_on_mview: (initial.is_on_mview as boolean) ?? false,
    medications: (initial.medications as PatientCreate['medications']) || undefined,
    antibiotics_log: (initial.antibiotics_log as PatientCreate['antibiotics_log']) || undefined,
    imaging_log: (initial.imaging_log as PatientCreate['imaging_log']) || undefined,
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    // undefined / 빈 문자열 정리
    const cleaned: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(draft)) {
      if (v === undefined || v === '') continue;
      cleaned[k] = v;
    }

    const parsed = patientUpdateSchema.safeParse(cleaned);
    if (!parsed.success) {
      const first = parsed.error.errors[0];
      setError(`${first.path.join('.')}: ${first.message}`);
      setSubmitting(false);
      return;
    }

    const supabase = createClient();
    try {
      await patientRepository.update(supabase, patientId, parsed.data);
      router.push(`/patient/${patientId}`);
      router.refresh();
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : typeof err === 'object' && err !== null && 'message' in err
            ? String((err as { message: unknown }).message)
            : '저장 실패';
      setError(`DB 에러: ${msg}`);
      console.error('Patient update error:', err);
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PatientFormFields value={draft} onChange={setDraft} />

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
        >
          {submitting ? '저장 중…' : '저장'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm dark:border-slate-700 dark:text-slate-300"
        >
          취소
        </button>
      </div>
    </form>
  );
}
