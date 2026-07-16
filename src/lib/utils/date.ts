/**
 * 서버(Vercel)는 UTC로 도는데, new Date().toISOString()을 쓰면 한국 새벽 시간대에
 * 날짜가 하루 밀린다 (예: KST 7/1 06:00 = UTC 6/30 21:00 → "6/30"으로 계산됨).
 * 회진이 새벽에 도는 걸 감안하면 치명적이므로, 항상 KST(Asia/Seoul) 기준으로 오늘을 계산한다.
 */

/** KST 기준 오늘 날짜 'YYYY-MM-DD' */
export function todayKST(): string {
  // 'en-CA' 로케일은 YYYY-MM-DD 포맷
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
}

/**
 * KST 오늘 자정을 나타내는 Date.
 * computePod / surgeryStatus 등 asOf 인자로 넘겨 날짜 계산을 KST 기준으로 맞춘다.
 * (서버 로컬=UTC 기준으로 해석되지만, 날짜 문자열로부터 만들므로 '며칠' 계산은 정확)
 */
export function todayDateKST(): Date {
  return new Date(todayKST() + 'T00:00:00');
}

/**
 * Date → 'YYYY-MM-DD' (로컬 필드값 기준, KST 안전).
 * todayDateKST()가 만든 Date는 로컬 자정이므로 getFullYear/Month/Date로 뽑아야
 * toISOString()의 UTC 변환(하루 밀림)을 피한다.
 */
export function dateToStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * 입력칸 기본값용 '오늘' (YYYY-MM-DD).
 * 브라우저 로컬 시간 기준 날짜 파트를 쓴다 (toISOString의 UTC 밀림 방지).
 * 클라이언트 컴포넌트에서 new Date().toISOString().slice(0,10) 대신 사용.
 */
export function localToday(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
