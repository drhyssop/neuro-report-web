'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30분

/**
 * 사용자 입력이 30분간 없으면 /pin으로 강제 이동.
 * 백그라운드로 갔다가 돌아왔을 때도 시간 누적이 30분 넘으면 잠금.
 * (실제 PIN 쿠키 만료는 middleware에서도 검증되지만, 즉시 반영을 위한 클라이언트 보조)
 */
export function IdleLock() {
  const router = useRouter();
  const lastActivityRef = useRef<number>(Date.now());

  useEffect(() => {
    function bump() {
      lastActivityRef.current = Date.now();
    }
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach((e) => window.addEventListener(e, bump, { passive: true }));

    function check() {
      if (Date.now() - lastActivityRef.current > IDLE_TIMEOUT_MS) {
        router.push('/pin');
      }
    }
    const interval = setInterval(check, 60 * 1000); // 1분마다

    // 탭 visibility — 백그라운드 갔다 돌아오면 시간 누적 확인
    function onVisible() {
      if (!document.hidden) check();
    }
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      events.forEach((e) => window.removeEventListener(e, bump));
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [router]);

  return null;
}
