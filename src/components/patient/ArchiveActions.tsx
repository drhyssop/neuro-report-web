'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { patientRepository } from '@/lib/repositories/patientRepository';

export function ArchiveActions({ patientId }: { patientId: string }) {
  const router = useRouter();

  async function handleReadmit() {
    const supabase = createClient();
    await patientRepository.readmit(supabase, patientId);
    router.refresh();
  }

  async function handleDelete() {
    if (!confirm('이 환자의 모든 검사 데이터를 영구 삭제합니다. 복구할 수 없습니다.')) return;
    if (!confirm('정말 삭제할까요? 다시 한 번 확인합니다.')) return;
    const supabase = createClient();
    await patientRepository.remove(supabase, patientId);
    router.refresh();
  }

  return (
    <div className="flex gap-1">
      <button
        type="button"
        onClick={handleReadmit}
        className="rounded border border-slate-200 px-2 py-1 text-[10px] text-slate-700"
      >
        재입원
      </button>
      <button
        type="button"
        onClick={handleDelete}
        className="rounded border border-red-200 px-2 py-1 text-[10px] text-red-700"
      >
        삭제
      </button>
    </div>
  );
}
