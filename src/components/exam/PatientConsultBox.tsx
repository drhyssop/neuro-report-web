'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { ConsultReferral } from '@/types/domainV2';

interface Props {
  patientId: string;
  consultsLog: ConsultReferral[];
}

const inputCls =
  'rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100';

function genId() {
  return `c_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function PatientConsultBox({ patientId, consultsLog }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [newDept, setNewDept] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newDate, setNewDate] = useState(new Date().toISOString().slice(0, 10));

  async function save(next: ConsultReferral[]) {
    const supabase = createClient();
    startTransition(async () => {
      await supabase.from('patients').update({ consults_log: next }).eq('id', patientId);
      router.refresh();
    });
  }

  function add() {
    const dept = newDept.trim();
    const content = newContent.trim();
    if (!dept || !content) return;
    save([
      ...consultsLog,
      { id: genId(), date: newDate, dept, content, answer: null, answered_at: null },
    ]);
    setNewDept('');
    setNewContent('');
    setAdding(false);
  }

  function answer(id: string, answerText: string, answeredAt: string) {
    save(
      consultsLog.map((c) =>
        c.id === id ? { ...c, answer: answerText, answered_at: answeredAt } : c,
      ),
    );
  }

  function clearAnswer(id: string) {
    save(
      consultsLog.map((c) => (c.id === id ? { ...c, answer: null, answered_at: null } : c)),
    );
  }

  function remove(id: string) {
    if (!confirm('이 협진 의뢰 기록을 삭제합니까?')) return;
    save(consultsLog.filter((c) => c.id !== id));
  }

  const pending = consultsLog.filter((c) => !c.answer).length;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-medium text-slate-700 dark:text-slate-200">
          타과 협진 의뢰{pending > 0 && <span className="ml-1 text-amber-600 dark:text-amber-400">· 대기 {pending}</span>}
        </div>
        <button
          type="button"
          onClick={() => setAdding(!adding)}
          className="rounded border border-slate-300 px-2 py-0.5 text-[10px] dark:border-slate-600 dark:text-slate-300"
        >
          {adding ? '취소' : '+ 의뢰'}
        </button>
      </div>

      {adding && (
        <div className="mb-2 space-y-1 rounded-md border border-dashed border-slate-300 p-2 dark:border-slate-700">
          <div className="grid grid-cols-[1fr_auto] gap-1">
            <input
              value={newDept}
              onChange={(e) => setNewDept(e.target.value)}
              placeholder="과 (예: CM, CV, GS)"
              className={inputCls}
            />
            <input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className={inputCls}
            />
          </div>
          <textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="의뢰 사유 / 내용 (예: 폐기능 저하, peri-op 관리 의뢰)"
            rows={2}
            className={`${inputCls} w-full`}
          />
          <button
            type="button"
            onClick={add}
            disabled={isPending || !newDept.trim() || !newContent.trim()}
            className="w-full rounded-md bg-slate-900 px-3 py-1 text-xs text-white disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
          >
            의뢰 추가
          </button>
        </div>
      )}

      <div className="space-y-1.5">
        {consultsLog.length === 0 ? (
          <p className="text-[10px] text-slate-400 dark:text-slate-500">기록 없음</p>
        ) : (
          [...consultsLog]
            .sort((a, b) => (a.date < b.date ? 1 : -1))
            .map((c) => (
              <ConsultRow
                key={c.id}
                entry={c}
                isPending={isPending}
                onAnswer={(txt, at) => answer(c.id, txt, at)}
                onClearAnswer={() => clearAnswer(c.id)}
                onRemove={() => remove(c.id)}
              />
            ))
        )}
      </div>
    </div>
  );
}

function ConsultRow({
  entry,
  isPending,
  onAnswer,
  onClearAnswer,
  onRemove,
}: {
  entry: ConsultReferral;
  isPending: boolean;
  onAnswer: (answer: string, answeredAt: string) => void;
  onClearAnswer: () => void;
  onRemove: () => void;
}) {
  const [showAnswer, setShowAnswer] = useState(false);
  const [answerText, setAnswerText] = useState('');
  const [answeredAt, setAnsweredAt] = useState(new Date().toISOString().slice(0, 10));
  const answered = !!entry.answer;

  return (
    <div className="rounded-md border border-slate-200 p-1.5 text-xs dark:border-slate-700">
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <span className="font-medium dark:text-slate-100">{entry.dept}</span>
            <span className="text-[10px] text-slate-400">{entry.date.slice(5)} 의뢰</span>
            {answered ? (
              <span className="rounded bg-emerald-50 px-1 py-0.5 text-[9px] text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                회신
              </span>
            ) : (
              <span className="rounded bg-amber-50 px-1 py-0.5 text-[9px] text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                대기중
              </span>
            )}
          </div>
          <div className="mt-0.5 whitespace-pre-wrap text-slate-600 dark:text-slate-300">{entry.content}</div>
          {answered && (
            <div className="mt-1 rounded bg-slate-50 p-1 text-[11px] text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              <span className="text-slate-400">↳ {entry.answered_at?.slice(5)} 회신: </span>
              <span className="whitespace-pre-wrap">{entry.answer}</span>
            </div>
          )}
        </div>
        <div className="flex shrink-0 flex-col gap-1">
          {!answered && !showAnswer && (
            <button
              type="button"
              onClick={() => setShowAnswer(true)}
              disabled={isPending}
              className="rounded border border-slate-300 px-1 py-0.5 text-[9px] dark:border-slate-600 dark:text-slate-300"
            >
              회신 입력
            </button>
          )}
          {answered && (
            <button
              type="button"
              onClick={onClearAnswer}
              disabled={isPending}
              className="rounded border border-slate-300 px-1 py-0.5 text-[9px] text-slate-500 dark:border-slate-600 dark:text-slate-400"
            >
              회신 취소
            </button>
          )}
          <button
            type="button"
            onClick={onRemove}
            disabled={isPending}
            className="rounded border border-red-200 px-1 py-0.5 text-[9px] text-red-600 dark:border-red-900 dark:text-red-400"
          >
            삭제
          </button>
        </div>
      </div>

      {showAnswer && (
        <div className="mt-1 space-y-1">
          <textarea
            value={answerText}
            onChange={(e) => setAnswerText(e.target.value)}
            placeholder="회신 내용"
            rows={2}
            className={`${inputCls} w-full`}
          />
          <div className="flex gap-1">
            <input
              type="date"
              value={answeredAt}
              onChange={(e) => setAnsweredAt(e.target.value)}
              className={inputCls}
            />
            <button
              type="button"
              onClick={() => {
                if (!answerText.trim()) return;
                onAnswer(answerText.trim(), answeredAt);
                setShowAnswer(false);
              }}
              disabled={isPending || !answerText.trim()}
              className="rounded-md bg-slate-900 px-2 py-0.5 text-[9px] text-white disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
            >
              확정
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
