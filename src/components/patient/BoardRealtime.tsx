'use client';

import { useRealtimePatients } from '@/lib/hooks/useRealtimePatients';

/**
 * 보드 페이지에 마운트되어 patients 변경을 구독.
 * router.refresh()로 RSC 재실행하면 서버에서 최신 데이터로 다시 렌더.
 */
export function BoardRealtime({ userId }: { userId: string }) {
  useRealtimePatients(userId);
  return null;
}
