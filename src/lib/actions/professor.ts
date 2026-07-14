'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { PROFESSOR_COOKIE } from '@/lib/services/professor';

/** 교수님 선택 (또는 'ALL' = 전체 보드) */
export async function selectProfessorAction(value: string) {
  const store = await cookies();
  store.set(PROFESSOR_COOKIE, value, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365, // 1년 — 매번 고르지 않게
    sameSite: 'lax',
  });
  revalidatePath('/', 'layout');
}
