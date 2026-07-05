'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { patientRepository } from '@/lib/repositories/patientRepository';

interface Props {
  patientId: string;
  patientAlias: string;
}

/**
 * 환자 완전 삭제 버튼 — 퇴원과 달리 데이터를 영구 삭제.
 * 잘못 누르지 않도록 작게 두고, 2단계 확인.
 */
export function DeletePatientButton({ patientId, patientAlias }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function remove() {
    if (!confirm(`${patientAlias} 환자 정보를 완전히 삭제합니다.\n(퇴원과 달리 아카이브에 남지 않고 영구 삭제됩니다)`))
      return;
    if (!confirm('정말 삭제할까요? 이 작업은 되돌릴 수 없습니다.')) return;
    startTransition(async () => {
      const supabase = createClient();
      await patientRepository.remove(supabase, patientId);
      router.push('/board');
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={remove}
      disabled={isPending}
      title="환자 정보 영구 삭제"
      className="rounded-md border border-red-200 px-2 py-1.5 text-[11px] text-red-500 disabled:opacity-50 dark:border-red-900 dark:text-red-400"
    >
      {isPending ? '삭제 중…' : '삭제'}
    </button>
  );
}
