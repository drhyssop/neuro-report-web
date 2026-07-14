'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

/** 교수님 이니셜 목록 (DB에서 로드, 실패 시 기본값) */
export function useProfessors(): string[] {
  const [list, setList] = useState<string[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from('professors')
          .select('initial')
          .order('sort_order');
        if (alive && data) setList(data.map((d) => d.initial as string));
      } catch {
        // professors 테이블이 아직 없으면 무시 (온라인 버전 호환)
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return list;
}
