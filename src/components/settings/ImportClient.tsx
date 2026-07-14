'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

/**
 * 온라인에서 내보낸 JSON을 오프라인 서버로 가져온다.
 * 가져올 때 담당 교수를 지정할 수 있다 (기존 데이터 → Y).
 */
export function ImportClient() {
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [professor, setProfessor] = useState('Y');

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setStatus('읽는 중…');

    try {
      const text = await file.text();
      const payload = JSON.parse(text) as {
        patients?: Record<string, unknown>[];
        examinations?: Record<string, unknown>[];
        holidays?: Record<string, unknown>[];
      };

      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('로그인이 필요합니다');

      const patients = payload.patients ?? [];
      const exams = payload.examinations ?? [];
      const holidays = payload.holidays ?? [];

      // 환자 — user_id를 현재 계정으로, professor 지정
      setStatus(`환자 ${patients.length}명 가져오는 중…`);
      if (patients.length > 0) {
        const rows = patients.map((p) => ({
          ...p,
          user_id: user.id,
          professor: professor || null,
        }));
        const { error } = await supabase.from('patients').upsert(rows);
        if (error) throw error;
      }

      // 검사 기록
      setStatus(`검사 ${exams.length}건 가져오는 중…`);
      if (exams.length > 0) {
        const rows = exams.map((e) => ({ ...e, user_id: user.id }));
        const { error } = await supabase.from('examinations').upsert(rows);
        if (error) throw error;
      }

      // 공휴일
      if (holidays.length > 0) {
        await supabase.from('holidays').upsert(holidays);
      }

      setStatus(
        `완료 — 환자 ${patients.length}명, 검사 ${exams.length}건, 공휴일 ${holidays.length}건 (담당 교수: ${professor || '미지정'})`,
      );
    } catch (err) {
      setStatus(`오류: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <label className="text-xs text-slate-600 dark:text-slate-300">담당 교수로 지정:</label>
        <input
          value={professor}
          onChange={(ev) => setProfessor(ev.target.value.toUpperCase())}
          maxLength={4}
          placeholder="Y"
          className="w-16 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
        />
      </div>
      <input
        type="file"
        accept="application/json"
        onChange={handleFile}
        disabled={busy}
        className="block w-full text-xs text-slate-600 file:mr-2 file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:text-xs file:text-white dark:text-slate-300 dark:file:bg-slate-100 dark:file:text-slate-900"
      />
      {status && <p className="text-xs text-slate-600 dark:text-slate-300">{status}</p>}
      <p className="text-[11px] text-slate-400 dark:text-slate-500">
        온라인에서 내보낸 JSON 파일을 선택하세요. 가져온 환자는 위에 입력한 교수님 보드에 들어갑니다.
      </p>
    </div>
  );
}
