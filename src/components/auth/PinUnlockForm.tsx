'use client';

import { useState, useTransition, useEffect } from 'react';
import { PinPad } from './PinPad';
import { verifyPinAction, signOutAction } from '@/lib/auth/actions';

export function PinUnlockForm({ next }: { next: string }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // 6자리 입력 시 자동 제출
  useEffect(() => {
    if (pin.length >= 4 && pin.length === 6) {
      submit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin]);

  function submit() {
    const fd = new FormData();
    fd.set('pin', pin);
    fd.set('next', next);
    setError(null);
    startTransition(async () => {
      const result = await verifyPinAction(fd);
      if (result?.error) {
        setError(result.error);
        setPin('');
      }
    });
  }

  return (
    <div className="space-y-4">
      <PinPad value={pin} onChange={setPin} disabled={isPending} />

      {error && <p className="text-center text-xs text-red-600 dark:text-red-400">{error}</p>}

      <div className="flex justify-between text-[10px]">
        <button
          type="button"
          onClick={() => submit()}
          disabled={pin.length < 4 || isPending}
          className="text-slate-600 disabled:opacity-30 dark:text-slate-300"
        >
          확인 (4자리도 OK)
        </button>
        <form action={signOutAction}>
          <button type="submit" className="text-slate-400 dark:text-slate-500">
            다른 계정으로 로그인
          </button>
        </form>
      </div>
    </div>
  );
}
