import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { BackupClient } from '@/components/settings/BackupClient';

export const dynamic = 'force-dynamic';

export default async function BackupPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('user_id', user.id)
    .single();

  // 백업/복원 미리보기: 현재 데이터 수
  const [{ count: patientCount }, { count: examCount }] = await Promise.all([
    supabase.from('patients').select('id', { count: 'exact', head: true }),
    supabase.from('examinations').select('id', { count: 'exact', head: true }),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-medium">백업 / 복원</h1>
      <p className="text-xs text-slate-500">
        현재 보관 중: 환자 {patientCount ?? 0}명, 검사 기록 {examCount ?? 0}건
      </p>
      <BackupClient
        userId={user.id}
        exportedBy={profile?.display_name ?? user.email ?? undefined}
      />
    </div>
  );
}
