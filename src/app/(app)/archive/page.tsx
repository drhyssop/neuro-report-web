import { createClient } from '@/lib/supabase/server';
import { patientRepository } from '@/lib/repositories/patientRepository';
import Link from 'next/link';
import { ArchiveActions } from '@/components/patient/ArchiveActions';

export const dynamic = 'force-dynamic';

export default async function ArchivePage() {
  const supabase = await createClient();
  const patients = await patientRepository.listArchived(supabase, 100);

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-medium">아카이브 ({patients.length})</h1>

      {patients.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
          퇴원한 환자가 없습니다.
        </p>
      ) : (
        <div className="space-y-2">
          {patients.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3"
            >
              <Link href={`/patient/${p.id}`} className="flex-1">
                <div className="text-sm font-medium">{p.alias}</div>
                <div className="text-xs text-slate-500">
                  {p.diagnosis || '-'} · {p.admitted_at} ~ {p.discharged_at}
                </div>
              </Link>
              <ArchiveActions patientId={p.id} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
