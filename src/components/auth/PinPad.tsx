'use client';

import { cn } from '@/lib/utils/cn';

interface Props {
  value: string;
  onChange: (next: string) => void;
  maxLength?: number;
  disabled?: boolean;
}

export function PinPad({ value, onChange, maxLength = 6, disabled = false }: Props) {
  function press(digit: string) {
    if (disabled) return;
    if (value.length >= maxLength) return;
    onChange(value + digit);
  }

  function backspace() {
    if (disabled) return;
    onChange(value.slice(0, -1));
  }

  return (
    <div className="space-y-4">
      {/* 입력된 자릿수 표시 (실제 값은 가림) */}
      <div className="flex justify-center gap-2">
        {Array.from({ length: maxLength }).map((_, i) => (
          <span
            key={i}
            className={cn(
              'h-3 w-3 rounded-full border',
              value.length > i
                ? 'border-slate-900 bg-slate-900 dark:border-slate-100 dark:bg-slate-100'
                : 'border-slate-400 bg-transparent dark:border-slate-500',
            )}
          />
        ))}
      </div>

      {/* 0-9 + backspace */}
      <div className="grid grid-cols-3 gap-2">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => press(d)}
            disabled={disabled}
            className="h-14 rounded-md border border-slate-300 bg-white text-xl font-medium text-slate-900 disabled:opacity-40 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          >
            {d}
          </button>
        ))}
        <div />
        <button
          type="button"
          onClick={() => press('0')}
          disabled={disabled}
          className="h-14 rounded-md border border-slate-300 bg-white text-xl font-medium text-slate-900 disabled:opacity-40 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
        >
          0
        </button>
        <button
          type="button"
          onClick={backspace}
          disabled={disabled}
          className="h-14 rounded-md border border-slate-300 bg-white text-sm text-slate-700 disabled:opacity-40 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
        >
          ←
        </button>
      </div>
    </div>
  );
}
