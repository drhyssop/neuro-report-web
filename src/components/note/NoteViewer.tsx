'use client';

import { useState } from 'react';
import { buildNotePdf } from '@/lib/services/notePdf';
import { shareNote } from '@/lib/services/share';

interface Props {
  note: string;
  patientAlias: string;
  examDate: string;
  diagnosis?: string | null;
  hospitalDay?: number | null;
  authorName?: string;
  worsenedCount: number;
}

export function NoteViewer({
  note,
  patientAlias,
  examDate,
  diagnosis,
  hospitalDay,
  authorName,
  worsenedCount,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState<null | 'pdf' | 'share'>(null);
  const [shareResult, setShareResult] = useState<string | null>(null);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(note);
    } catch {
      // 구형 폴백
      const ta = document.createElement('textarea');
      ta.value = note;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handlePdf() {
    setBusy('pdf');
    try {
      const blob = await buildNotePdf({
        note,
        patientAlias,
        examDate,
        diagnosis,
        hospitalDay,
        authorName,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${patientAlias}_${examDate}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('PDF 생성 실패: ' + (e instanceof Error ? e.message : 'unknown'));
    } finally {
      setBusy(null);
    }
  }

  async function handleShare() {
    setBusy('share');
    setShareResult(null);
    try {
      const result = await shareNote({
        title: `${patientAlias} ${examDate}`,
        text: note,
      });
      if (result === 'clipboard') setShareResult('클립보드에 복사됨 (공유 미지원 브라우저)');
      else if (result === 'kakao') setShareResult('카톡으로 공유 창 열림');
      else setShareResult('공유 창 열림');
      setTimeout(() => setShareResult(null), 3000);
    } catch (e) {
      alert('공유 실패: ' + (e instanceof Error ? e.message : 'unknown'));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleCopy}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-xs dark:border-slate-700 dark:text-slate-300"
        >
          {copied ? '복사됨 ✓' : 'EMR 복사'}
        </button>
        <button
          type="button"
          onClick={handlePdf}
          disabled={busy === 'pdf'}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-xs disabled:opacity-40 dark:border-slate-700 dark:text-slate-300"
        >
          {busy === 'pdf' ? 'PDF 생성 중…' : 'PDF 다운로드'}
        </button>
        <button
          type="button"
          onClick={handleShare}
          disabled={busy === 'share'}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-xs disabled:opacity-40 dark:border-slate-700 dark:text-slate-300"
        >
          {busy === 'share' ? '준비 중…' : '공유'}
        </button>
        {shareResult && <span className="self-center text-[10px] text-slate-500 dark:text-slate-400">{shareResult}</span>}
      </div>

      {worsenedCount > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
          어제 대비 <strong>{worsenedCount}개 항목 악화</strong> 감지됨. neurologic deterioration 가능성 확인 권장.
        </div>
      )}

      <pre className="overflow-auto rounded-md border border-slate-200 bg-white p-4 font-mono text-xs leading-relaxed text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
        {note}
      </pre>
    </div>
  );
}
