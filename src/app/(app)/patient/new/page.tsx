'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { patientRepository } from '@/lib/repositories/patientRepository';
import { patientCreateSchema, type PatientCreate } from '@/lib/schemas/patient';
import { PatientFormFields } from '@/components/patient/PatientFormFields';

export default function NewPatientPage() {
  const router = useRouter();
  const [draft, setDraft] = useState<Partial<PatientCreate>>({
    admitted_at: new Date().toISOString().slice(0, 10),
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    // undefined/빈 문자열 정리
    const cleaned: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(draft)) {
      if (v === undefined || v === '') continue;
      cleaned[k] = v;
    }

    const parsed = patientCreateSchema.safeParse(cleaned);
    if (!parsed.success) {
      const first = parsed.error.errors[0];
      setError(`${first.path.join('.')}: ${first.message}`);
      setSubmitting(false);
      return;
    }

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError('로그인이 필요합니다');
      setSubmitting(false);
      return;
    }

    try {
      const created = await patientRepository.create(supabase, parsed.data, user.id);
      router.push(`/patient/${created.id}`);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : typeof err === 'object' && err !== null && 'message' in err
            ? String((err as { message: unknown }).message)
            : '저장 실패';
      setError(`DB 에러: ${msg}`);
      console.error('Patient create error:', err);
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h1 className="text-lg font-medium dark:text-slate-100">환자 추가</h1>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        ⚠️ 실명, 주민번호, 실제 차트번호는 입력하지 마세요. 본인이 알아볼 수 있는 별칭을 사용하세요.
      </p>

      <PatientFormFields value={draft} onChange={setDraft} />

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
      >
        {submitting ? '저장 중…' : '환자 등록'}
      </button>
    </form>
  );
}
