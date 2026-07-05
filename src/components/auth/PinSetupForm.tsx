'use client';

import { useState, useTransition } from 'react';
import { PinPad } from './PinPad';
import { setPinAction } from '@/lib/auth/actions';

export function PinSetupForm({ next }: { next: string }) {
  const [step, setStep] = useState<'first' | 'confirm'>('first');
  const [first, setFirst] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function next1() {
    if (first.length < 4 || first.length > 6) {
      setError('4-6자리 숫자로 입력해주세요');
      return;
    }
    setError(null);
    setStep('confirm');
  }

  function submit() {
    if (first !== confirm) {
      setError('두 입력이 일치하지 않습니다');
      setConfirm('');
      setStep('first');
      setFirst('');
      return;
    }
    const fd = new FormData();
    fd.set('pin', first);
    fd.set('confirm_pin', confirm);
    fd.set('next', next);
    startTransition(async () => {
      const result = await setPinAction(fd);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-center text-xs text-slate-600 dark:text-slate-400">
        {step === 'first'
          ? 'PIN 4-6자리를 정해주세요'
          : '동일한 PIN을 한 번 더 입력해주세요'}
      </p>

      {step === 'first' ? (
        <PinPad value={first} onChange={setFirst} disabled={isPending} />
      ) : (
        <PinPad value={confirm} onChange={setConfirm} disabled={isPending} />
      )}

      {error && <p className="text-center text-xs text-red-600 dark:text-red-400">{error}</p>}

      <button
        type="button"
        onClick={step === 'first' ? next1 : submit}
        disabled={isPending || (step === 'first' ? first.length < 4 : confirm.length < 4)}
        className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40 dark:bg-slate-100 dark:text-slate-900"
      >
        {step === 'first' ? '다음' : '설정 완료'}
      </button>
    </div>
  );
}
