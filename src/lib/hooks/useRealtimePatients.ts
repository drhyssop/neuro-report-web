'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

/**
 * patients 테이블 변경(INSERT/UPDATE/DELETE)을 구독.
 * 다른 기기에서 환자 추가/퇴원하면 router.refresh()로 서버 컴포넌트 재렌더.
 *
 * 보드 페이지가 RSC(서버 컴포넌트)라 클라이언트 상태가 없어서
 * 단순 refresh로도 깔끔하게 갱신됨.
 */
export function useRealtimePatients(userId: string) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`patients-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'patients',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          router.refresh();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, router]);
}
