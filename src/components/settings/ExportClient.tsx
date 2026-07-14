'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

/**
 * 현재 보드(입원 중) 환자 + 검사 기록을 JSON 파일로 내보낸다.
 * 오프라인 서버로 옮길 때 사용 (USB).
 */
export function ExportClient() {
  const [status, setStatus] = useState<string>('');
  const [busy, setBusy] = useState(false);

  async function exportData() {
    setBusy(true);
    setStatus('내보내는 중…');
    try {
      const supabase = createClient();

      // 현재 보드에 있는 환자 (active)
      const { data: patients, error: pe } = await supabase
        .from('patients')
        .select('*')
        .eq('active', true);
      if (pe) throw pe;

      const ids = (patients ?? []).map((p) => p.id as string);

      // 해당 환자들의 검사 기록 전부
      let exams: unknown[] = [];
      if (ids.length > 0) {
        const { data: ex, error: ee } = await supabase
          .from('examinations')
          .select('*')
          .in('patient_id', ids);
        if (ee) throw ee;
        exams = ex ?? [];
      }

      // 공휴일도 같이
      const { data: holidays } = await supabase.from('holidays').select('*');

      const payload = {
        exported_at: new Date().toISOString(),
        version: 'v5.0',
        patients: patients ?? [],
        examinations: exams,
        holidays: holidays ?? [],
      };

      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `neuro-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);

      setStatus(
        `완료 — 환자 ${(patients ?? []).length}명, 검사 ${exams.length}건, 공휴일 ${(holidays ?? []).length}건`,
      );
    } catch (e) {
      setStatus(`오류: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={exportData}
        disabled={busy}
        className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
      >
        {busy ? '내보내는 중…' : '현재 보드 환자 내보내기 (JSON)'}
      </button>
      {status && <p className="text-xs text-slate-600 dark:text-slate-300">{status}</p>}
      <p className="text-[11px] text-slate-400 dark:text-slate-500">
        다운로드된 JSON 파일을 USB로 오프라인 서버에 옮긴 뒤, 오프라인 앱의 &ldquo;가져오기&rdquo;에서 불러오세요.
      </p>
    </div>
  );
}
