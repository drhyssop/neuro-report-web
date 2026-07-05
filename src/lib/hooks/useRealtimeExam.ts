'use client';

import { useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { ExamRegions } from '@/types/domain';

interface ExamRow {
  id: string;
  regions: ExamRegions;
  updated_at: string;
}

interface Options {
  examId: string;
  /**
   * 외부 변경이 들어왔을 때 호출.
   * dirty 필드 보호는 PatientExamForm 쪽에서 머지 로직으로 처리.
   */
  onRemoteChange: (remote: ExamRow) => void;
  /**
   * 내가 방금 저장한 row인지 식별하는 ref.
   * Form 쪽에서 자동저장 후 마지막 updated_at을 기록해두고,
   * 동일한 updated_at의 이벤트가 오면 무시 (echo 방지).
   */
  ignoreUpdatedAtRef: React.MutableRefObject<string | null>;
}

/**
 * 특정 examination row의 변경을 실시간 구독.
 * - 본인이 방금 저장한 echo는 무시
 * - 다른 기기 변경은 onRemoteChange로 전달
 */
export function useRealtimeExam({ examId, onRemoteChange, ignoreUpdatedAtRef }: Options) {
  // 콜백을 ref에 담아 의존성에서 빼면 채널 재구독 안 일어남
  const callbackRef = useRef(onRemoteChange);
  callbackRef.current = onRemoteChange;

  useEffect(() => {
    if (!examId) return;
    const supabase = createClient();

    const channel = supabase
      .channel(`exam-${examId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'examinations',
          filter: `id=eq.${examId}`,
        },
        (payload) => {
          const row = payload.new as unknown as ExamRow;
          if (!row) return;
          // echo 무시: 내가 방금 저장한 updated_at과 동일하면 패스
          if (ignoreUpdatedAtRef.current === row.updated_at) return;
          callbackRef.current(row);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [examId, ignoreUpdatedAtRef]);
}
