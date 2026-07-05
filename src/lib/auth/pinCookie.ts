/**
 * PIN unlock 상태를 쿠키로 관리.
 * - 로그인은 Supabase 세션이 책임 (수일~수주 유지)
 * - PIN unlock은 별도 쿠키, 30분 idle 후 만료
 * - 백그라운드 갔다 돌아오면 다시 PIN 입력 요구
 */

export const PIN_COOKIE_NAME = 'nr_pin_unlocked';
export const PIN_TTL_SECONDS = 30 * 60; // 30분

export interface PinCookieValue {
  userId: string;
  unlockedAt: number; // epoch ms
}

export function isPinCookieValid(raw: string | undefined, currentUserId: string): boolean {
  if (!raw) return false;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as PinCookieValue;
    if (parsed.userId !== currentUserId) return false;
    const ageMs = Date.now() - parsed.unlockedAt;
    return ageMs < PIN_TTL_SECONDS * 1000;
  } catch {
    return false;
  }
}

export function buildPinCookieValue(userId: string): string {
  const value: PinCookieValue = { userId, unlockedAt: Date.now() };
  return encodeURIComponent(JSON.stringify(value));
}
