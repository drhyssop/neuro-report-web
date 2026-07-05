'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import {
  PIN_COOKIE_NAME,
  PIN_TTL_SECONDS,
  buildPinCookieValue,
} from '@/lib/auth/pinCookie';

/**
 * PIN 검증. 성공 시 PIN 쿠키 설정 후 next URL로 리다이렉트.
 */
export async function verifyPinAction(formData: FormData) {
  const pin = String(formData.get('pin') ?? '');
  const next = String(formData.get('next') ?? '/board');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  // verify_pin RPC 호출 (server-side, security definer)
  const { data: valid, error } = await supabase.rpc('verify_pin', { input_pin: pin });

  if (error || !valid) {
    return { error: 'PIN이 일치하지 않습니다' };
  }

  const cookieStore = await cookies();
  cookieStore.set(PIN_COOKIE_NAME, buildPinCookieValue(user.id), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: PIN_TTL_SECONDS,
    path: '/',
  });

  redirect(next);
}

/**
 * PIN 신규 설정 또는 변경.
 */
export async function setPinAction(formData: FormData) {
  const pin = String(formData.get('pin') ?? '');
  const confirmPin = String(formData.get('confirm_pin') ?? '');
  const next = String(formData.get('next') ?? '/board');

  if (pin !== confirmPin) {
    return { error: 'PIN이 일치하지 않습니다' };
  }
  if (!/^\d{4,6}$/.test(pin)) {
    return { error: 'PIN은 4-6자리 숫자여야 합니다' };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { error } = await supabase.rpc('set_pin', {
    target_user_id: user.id,
    new_pin: pin,
  });
  if (error) return { error: error.message };

  // 설정 직후 자동 unlock
  const cookieStore = await cookies();
  cookieStore.set(PIN_COOKIE_NAME, buildPinCookieValue(user.id), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: PIN_TTL_SECONDS,
    path: '/',
  });

  redirect(next);
}

/**
 * 잠금 (PIN 쿠키 제거) — 로그아웃 안 하고 PIN만 다시 받기
 */
export async function lockAction() {
  const cookieStore = await cookies();
  cookieStore.delete(PIN_COOKIE_NAME);
  redirect('/pin');
}

/**
 * 완전 로그아웃 (Supabase 세션도 제거)
 */
export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const cookieStore = await cookies();
  cookieStore.delete(PIN_COOKIE_NAME);
  redirect('/login');
}
