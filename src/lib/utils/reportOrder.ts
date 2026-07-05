'use client';

const KEY = 'report-card-order-v1';

/** 저장된 수동 순서(환자 id 배열)를 읽음 */
export function loadReportOrder(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function saveReportOrder(ids: string[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    // ignore
  }
}

/**
 * reports를 저장된 순서대로 재배열.
 * 저장 순서에 없는 환자(신규 등)는 원래 순서를 유지하며 뒤에 붙는다.
 */
export function applyReportOrder<T extends { id: string }>(reports: T[], order: string[]): T[] {
  if (order.length === 0) return reports;
  const pos = new Map(order.map((id, i) => [id, i]));
  return [...reports].sort((a, b) => {
    const pa = pos.has(a.id) ? pos.get(a.id)! : Number.MAX_SAFE_INTEGER;
    const pb = pos.has(b.id) ? pos.get(b.id)! : Number.MAX_SAFE_INTEGER;
    if (pa !== pb) return pa - pb;
    return 0; // 둘 다 미저장이면 기존 순서 유지 (안정 정렬)
  });
}
