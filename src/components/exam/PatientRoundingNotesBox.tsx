'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { RoundingNote } from '@/types/domainV2';
import { todayKST } from '@/lib/utils/date';

interface Props {
  patientId: string;
  notes: RoundingNote[];
}

/**
 * 회진 누적 메모 — 매일 계속 기억할 항목 (예: "금요일 전원 예정", "목요일 cxr f/u").
 * 환자일보/회진문서에 미완료 항목이 계속 누적 표시된다.
 * 완료 체크 → 일보에서는 숨김(기록은 유지) / 삭제 → 완전 제거.
 */
export function PatientRoundingNotesBox({ patientId, notes }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [input, setInput] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  function save(next: RoundingNote[]) {
    const supabase = createClient();
    startTransition(async () => {
      await supabase.from('patients').update({ rounding_notes: next }).eq('id', patientId);
      router.refresh();
    });
  }

  function add() {
    const t = input.trim();
    if (!t) return;
    save([
      ...notes,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        text: t,
        done: false,
        created_at: todayKST(),
      },
    ]);
    setInput('');
  }

  function toggleDone(id: string) {
    save(notes.map((n) => (n.id === id ? { ...n, done: !n.done } : n)));
  }

  function remove(id: string) {
    if (!confirm('이 메모를 삭제합니까?')) return;
    save(notes.filter((n) => n.id !== id));
  }

  function startEdit(n: RoundingNote) {
    setEditingId(n.id);
    setEditText(n.text);
  }

  function commitEdit() {
    if (!editingId) return;
    const t = editText.trim();
    if (t) {
      save(notes.map((n) => (n.id === editingId ? { ...n, text: t } : n)));
    }
    setEditingId(null);
    setEditText('');
  }

  const active = notes.filter((n) => !n.done);
  const done = notes.filter((n) => n.done);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
          회진 메모 (누적)
          {isPending && <span className="ml-1 text-[10px] text-slate-400">저장 중…</span>}
        </span>
        <span className="text-[10px] text-slate-400 dark:text-slate-500">일보에 계속 표시</span>
      </div>

      {/* 추가 */}
      <div className="mb-2 flex gap-1.5">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
          placeholder="예: 금요일 전원 예정"
          className="flex-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
        />
        <button
          type="button"
          onClick={add}
          disabled={isPending || !input.trim()}
          className="rounded-md border border-slate-300 px-2 py-1 text-[11px] text-slate-600 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300"
        >
          추가
        </button>
      </div>

      {notes.length === 0 ? (
        <p className="text-[11px] text-slate-400 dark:text-slate-500">기록 없음</p>
      ) : (
        <ul className="space-y-1">
          {[...active, ...done].map((n) => (
            <li key={n.id} className="flex items-start gap-1.5 text-xs">
              <input
                type="checkbox"
                checked={!!n.done}
                onChange={() => toggleDone(n.id)}
                disabled={isPending}
                className="mt-0.5"
                title="완료 체크 (일보에서 숨김)"
              />
              {editingId === n.id ? (
                <>
                  <input
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        commitEdit();
                      }
                    }}
                    autoFocus
                    className="flex-1 rounded border border-slate-300 bg-white px-1.5 py-0.5 text-xs dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  />
                  <button
                    type="button"
                    onClick={commitEdit}
                    className="text-[10px] text-slate-600 dark:text-slate-300"
                  >
                    저장
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="text-[10px] text-slate-400"
                  >
                    취소
                  </button>
                </>
              ) : (
                <>
                  <span
                    className={`flex-1 ${
                      n.done
                        ? 'text-slate-400 line-through dark:text-slate-600'
                        : 'text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    {n.text}
                    <span className="ml-1 text-[10px] text-slate-400 dark:text-slate-500">
                      ({n.created_at.slice(5)})
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => startEdit(n)}
                    disabled={isPending}
                    className="text-[10px] text-slate-400 hover:text-slate-600"
                  >
                    수정
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(n.id)}
                    disabled={isPending}
                    className="text-[10px] text-slate-400 hover:text-red-500"
                  >
                    삭제
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
