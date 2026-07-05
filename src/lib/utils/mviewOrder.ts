'use client';

/**
 * m-view 섹션별 환자 수동 순서 (localStorage).
 * m-view 화면과 회진문서 출력이 동일한 순서를 공유하도록 여기 한 곳에 둔다.
 */

const ORDER_STORAGE_KEY = 'mview-section-orders-v1';

export interface SectionOrders {
  [sectionTitle: string]: string[]; // patientId 배열
}

export function loadMViewOrders(): SectionOrders {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(ORDER_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SectionOrders) : {};
  } catch {
    return {};
  }
}

export function saveMViewOrders(orders: SectionOrders) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(orders));
  } catch {
    // ignore
  }
}

/**
 * 저장된 순서대로 정렬. 저장 안 된 (새) 항목은 원래 순서를 유지하며 끝에 추가.
 * patientId를 뽑는 방법(getId)만 주면 어떤 타입에도 쓸 수 있다.
 */
export function applyMViewOrder<T>(
  items: T[],
  savedIds: string[] | undefined,
  getId: (item: T) => string,
): T[] {
  if (!savedIds || savedIds.length === 0) return items;
  const idToItem = new Map(items.map((p) => [getId(p), p]));
  const result: T[] = [];
  for (const id of savedIds) {
    const p = idToItem.get(id);
    if (p) {
      result.push(p);
      idToItem.delete(id);
    }
  }
  for (const p of idToItem.values()) result.push(p);
  return result;
}
