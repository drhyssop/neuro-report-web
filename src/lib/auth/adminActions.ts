'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * 현재 사용자가 admin인지 검증.
 * 모든 admin action 진입 시 반드시 호출.
 */
async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('로그인이 필요합니다');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .single();

  if (profile?.role !== 'admin') throw new Error('관리자 권한이 필요합니다');
  return { supabase, user };
}

/**
 * 새 사용자 등록.
 * - email/password로 auth.users 생성
 * - profiles 트리거가 자동으로 profile 생성 (첫 사용자가 admin이지만 이미 존재하므로 신규는 user)
 * - 역할이 admin이면 추가로 update
 */
export async function createUserAction(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const displayName = String(formData.get('display_name') ?? '').trim();
  const role = String(formData.get('role') ?? 'user') as 'user' | 'admin';

  if (!email || !password) return { error: '이메일/비밀번호 필수' };
  if (password.length < 6) return { error: '비밀번호는 6자 이상' };
  if (!displayName) return { error: '표시 이름 필수' };

  try {
    await requireAdmin();
  } catch (e) {
    return { error: e instanceof Error ? e.message : '권한 오류' };
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: displayName },
  });
  if (error || !data.user) return { error: error?.message ?? '생성 실패' };

  // 역할 업데이트 (profile은 트리거로 이미 생성됨)
  if (role === 'admin') {
    await admin.from('profiles').update({ role: 'admin' }).eq('user_id', data.user.id);
  }
  // display_name 보정
  await admin.from('profiles').update({ display_name: displayName }).eq('user_id', data.user.id);

  revalidatePath('/admin/users');
  return { ok: true };
}

/**
 * 사용자 삭제. 본인은 삭제 불가.
 * cascade로 patients, examinations, profile 모두 제거.
 */
export async function deleteUserAction(formData: FormData) {
  const targetUserId = String(formData.get('user_id') ?? '');
  if (!targetUserId) return { error: 'user_id 필수' };

  let me;
  try {
    me = await requireAdmin();
  } catch (e) {
    return { error: e instanceof Error ? e.message : '권한 오류' };
  }
  if (me.user.id === targetUserId) return { error: '본인 계정은 삭제할 수 없습니다' };

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(targetUserId);
  if (error) return { error: error.message };

  revalidatePath('/admin/users');
  return { ok: true };
}

/**
 * PIN 리셋. 대상 사용자의 PIN을 제거 → 그 사람이 다음 로그인 시 새 PIN 설정.
 */
export async function resetPinAction(formData: FormData) {
  const targetUserId = String(formData.get('user_id') ?? '');
  if (!targetUserId) return { error: 'user_id 필수' };

  try {
    await requireAdmin();
  } catch (e) {
    return { error: e instanceof Error ? e.message : '권한 오류' };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('clear_pin', { target_user_id: targetUserId });
  if (error) return { error: error.message };

  revalidatePath('/admin/users');
  return { ok: true };
}

/**
 * 역할 변경 (user ↔ admin).
 * 본인은 자기 역할을 user로 강등할 수 없음 (관리자 최소 1명 유지).
 */
export async function changeRoleAction(formData: FormData) {
  const targetUserId = String(formData.get('user_id') ?? '');
  const newRole = String(formData.get('role') ?? '') as 'user' | 'admin';
  if (!targetUserId || !['user', 'admin'].includes(newRole)) return { error: '입력 오류' };

  let me;
  try {
    me = await requireAdmin();
  } catch (e) {
    return { error: e instanceof Error ? e.message : '권한 오류' };
  }
  if (me.user.id === targetUserId && newRole !== 'admin') {
    return { error: '본인 권한은 강등할 수 없습니다' };
  }

  const admin = createAdminClient();
  const { error } = await admin.from('profiles').update({ role: newRole }).eq('user_id', targetUserId);
  if (error) return { error: error.message };

  revalidatePath('/admin/users');
  return { ok: true };
}
