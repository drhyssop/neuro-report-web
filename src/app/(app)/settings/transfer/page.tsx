import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ExportClient } from '@/components/settings/ExportClient';
import { ImportClient } from '@/components/settings/ImportClient';

export const dynamic = 'force-dynamic';

export default async function TransferPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-medium dark:text-slate-100">데이터 이전</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            온라인 → 오프라인 서버로 환자 데이터를 옮깁니다 (USB).
          </p>
        </div>
        <Link
          href="/board"
          className="rounded-md border border-slate-300 px-3 py-1.5 text-xs dark:border-slate-700 dark:text-slate-300"
        >
          ← 보드로
        </Link>
      </div>

      <section className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
        <h2 className="mb-3 text-sm font-medium dark:text-slate-200">1. 내보내기 (온라인에서)</h2>
        <ExportClient />
      </section>

      <section className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
        <h2 className="mb-3 text-sm font-medium dark:text-slate-200">2. 가져오기 (오프라인 서버에서)</h2>
        <ImportClient />
      </section>
    </div>
  );
}
