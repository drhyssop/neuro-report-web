import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * Service Role 권한 클라이언트.
 * **절대 클라이언트 컴포넌트나 브라우저로 노출되면 안 됨.**
 * Route Handler / Server Action 내부에서만 사용.
 *
 * Auth admin API (createUser, deleteUser 등)를 호출할 때 필요.
 * RLS를 우회하므로 호출 전에 반드시 '현재 사용자가 admin인가'를 검증할 것.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다');
  }
  return createSupabaseClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
