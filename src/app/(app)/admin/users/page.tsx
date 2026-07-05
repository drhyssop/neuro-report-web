import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { AdminUsersClient } from '@/components/admin/AdminUsersClient';

export const dynamic = 'force-dynamic';

export default async function AdminUsersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // 본인이 admin인지 확인
  const { data: me } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .single();

  if (me?.role !== 'admin') {
    return (
      <div className="space-y-2">
        <h1 className="text-lg font-medium">접근 권한 없음</h1>
        <p className="text-sm text-slate-500">관리자만 이용할 수 있는 페이지입니다.</p>
      </div>
    );
  }

  const { data: profiles } = await supabase
    .from('profiles')
    .select('user_id, display_name, role, pin_set_at, created_at')
    .order('created_at', { ascending: true });

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-medium">계정 관리</h1>
      <AdminUsersClient
        profiles={profiles ?? []}
        currentUserId={user.id}
      />
    </div>
  );
}
