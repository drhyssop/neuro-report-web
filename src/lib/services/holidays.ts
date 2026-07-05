/**
 * 공휴일 / 회진일 로직 (하이브리드).
 *  - 양력 고정 공휴일: 코드에 하드코딩 (매년 동일)
 *  - 음력·임시공휴일·병원 휴진일: DB(holidays 테이블)에 수동 등록 → holidaySet으로 전달
 *
 * "회진일" = 평일(월~금) 이면서 공휴일이 아닌 날. (토요일은 회진 없음)
 *
 * 이 로직으로 drain 제거 / f/u 검사 / 수술예정 표시 창을 통일한다.
 */

// 양력 고정 공휴일 (MM-DD)
const FIXED_SOLAR_HOLIDAYS = new Set<string>([
  '01-01', // 신정
  '03-01', // 삼일절
  '05-05', // 어린이날
  '06-06', // 현충일
  '08-15', // 광복절
  '10-03', // 개천절
  '10-09', // 한글날
  '12-25', // 성탄절
]);

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** 해당 날짜가 공휴일인지 (고정 양력 or 수동 등록) */
export function isHoliday(dateStr: string, holidaySet: Set<string>): boolean {
  const mmdd = dateStr.slice(5); // MM-DD
  return FIXED_SOLAR_HOLIDAYS.has(mmdd) || holidaySet.has(dateStr);
}

/** 회진 도는 날인지 = 평일(월~금) & 공휴일 아님. 토·일 제외. */
export function isRoundingDay(date: Date, holidaySet: Set<string>): boolean {
  const day = date.getDay(); // 0(일)~6(토)
  if (day === 0 || day === 6) return false; // 토·일 회진 없음
  return !isHoliday(ymd(date), holidaySet);
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

/**
 * 뒤돌아보기 창 (drain 제거 / f/u 검사) — 오늘 회진에서 확인해야 할 날짜들.
 *  = 오늘 + 어제 + (어제부터 이어지는 비회진일들, 직전 회진일 직전까지)
 *
 * 예)
 *  - 평일(화): {화, 월}
 *  - 월요일(주말 뒤): {월, 일, 토}   (금요일은 제외)
 *  - 연휴 화수목 뒤 금요일: {금, 목, 수, 화}   (월요일 제외)
 */
export function lookbackWindow(todayDate: Date, holidaySet: Set<string>): Set<string> {
  const win = new Set<string>([ymd(todayDate)]);
  let d = addDays(todayDate, -1);
  win.add(ymd(d)); // 어제는 항상 포함 (전날 오후 제거분 등)
  // 어제가 비회진일이면 그 앞 비회진일들도 계속 포함 (직전 회진일은 제외)
  while (!isRoundingDay(d, holidaySet)) {
    const prev = addDays(d, -1);
    if (isRoundingDay(prev, holidaySet)) break;
    win.add(ymd(prev));
    d = prev;
  }
  return win;
}

/**
 * 앞내다보기 창 (수술예정) — 다음 회진 전까지 미리 챙겨야 할 예정일들.
 *  = 오늘 다음날 ~ 다음 회진일(포함).
 *
 * 예)
 *  - 평일(월): {화}
 *  - 화요일 휴일 → 월요일: {화, 수}
 *  - 금요일: {토, 일, 월}
 *  - 연휴 화수목 → 월요일: {화, 수, 목, 금}
 */
export function lookaheadWindow(todayDate: Date, holidaySet: Set<string>): Set<string> {
  const win = new Set<string>();
  let d = addDays(todayDate, 1);
  // 다음 회진일을 포함할 때까지 하루씩 전진
  // (그 사이의 비회진일들도 모두 포함)
  // 안전장치: 최대 14일
  for (let i = 0; i < 14; i++) {
    win.add(ymd(d));
    if (isRoundingDay(d, holidaySet)) break;
    d = addDays(d, 1);
  }
  return win;
}
