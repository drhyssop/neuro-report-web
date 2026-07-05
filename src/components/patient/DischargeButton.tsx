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
 * 환자 상세 상단(정보 편집 옆)에 두는 퇴원 버튼.
 * 퇴원 시 아카이브 보존 후 보드로 이동.
 */
export function DischargeButton({ patientId, patientAlias }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function discharge() {
    if (!confirm(`${patientAlias} 환자를 퇴원 처리합니다. 데이터는 아카이브에 보존됩니다.`)) return;
    startTransition(async () => {
      const supabase = createClient();
      const today = new Date().toISOString().slice(0, 10);
      await patientRepository.discharge(supabase, patientId, today);
      router.push('/board');
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={discharge}
      disabled={isPending}
      className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-700 disabled:opacity-50 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
    >
      {isPending ? '처리 중…' : '퇴원'}
    </button>
  );
}
