'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { todayKST } from '@/lib/utils/date';

/**
 * 환자를 m-view에 수동으로 추가 / 제거 토글
 */
export async function toggleMViewAction(formData: FormData): Promise<{ error?: string }> {
  const patientId = formData.get('patient_id') as string;
  const next = formData.get('next') === 'true';

  if (!patientId) return { error: '환자 ID 필요' };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: '로그인 필요' };

  const { error } = await supabase
    .from('patients')
    // 수동 추가(next=true) 시에는 오늘 제외 기록도 해제해 바로 보이게 함
    .update(next ? { is_on_mview: true, mview_excluded_date: null } : { is_on_mview: false })
    .eq('id', patientId)
    .eq('user_id', user.id);

  if (error) return { error: error.message };

  revalidatePath('/board');
  revalidatePath('/mview');
  return {};
}

/**
 * 환자를 "오늘 하루" m-view에서 제외 (자동으로 올라온 환자용).
 * 내일 다시 대상이면 자동으로 다시 올라온다.
 */
export async function excludeFromMviewAction(formData: FormData): Promise<{ error?: string }> {
  const patientId = formData.get('patient_id') as string;
  if (!patientId) return { error: '환자 ID 필요' };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: '로그인 필요' };

  const today = todayKST();
  const { error } = await supabase
    .from('patients')
    .update({ mview_excluded_date: today })
    .eq('id', patientId)
    .eq('user_id', user.id);

  if (error) return { error: error.message };

  revalidatePath('/board');
  revalidatePath('/mview');
  return {};
}
