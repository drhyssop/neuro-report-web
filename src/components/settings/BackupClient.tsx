'use client';

import { useState, useRef, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  exportBackup,
  downloadBackupAsFile,
  parseBackupFile,
  importBackup,
} from '@/lib/services/backup';
import type { BackupFile, ImportMode, ImportSummary } from '@/lib/schemas/backup';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function BackupClient({
  userId,
  exportedBy,
}: {
  userId: string;
  exportedBy?: string;
}) {
  const router = useRouter();
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pickedFile, setPickedFile] = useState<File | null>(null);
  const [parsedBackup, setParsedBackup] = useState<BackupFile | null>(null);
  const [importMode, setImportMode] = useState<ImportMode>('merge');
  const [parseError, setParseError] = useState<string | null>(null);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [isImporting, startImport] = useTransition();

  async function handleExport() {
    setExporting(true);
    setExportError(null);
    try {
      const supabase = createClient();
      const backup = await exportBackup(supabase, exportedBy);
      downloadBackupAsFile(backup);
    } catch (e) {
      setExportError(e instanceof Error ? e.message : '내보내기 실패');
    } finally {
      setExporting(false);
    }
  }

  async function handleFilePick(file: File) {
    setParseError(null);
    setParsedBackup(null);
    setImportSummary(null);

    if (file.size > MAX_FILE_SIZE) {
      setParseError(`파일이 너무 큽니다 (최대 ${MAX_FILE_SIZE / 1024 / 1024}MB)`);
      return;
    }

    setPickedFile(file);
    try {
      const text = await file.text();
      const parsed = parseBackupFile(text);
      setParsedBackup(parsed);
    } catch (e) {
      setParseError(e instanceof Error ? e.message : '파일 검증 실패');
    }
  }

  function handleImport() {
    if (!parsedBackup) return;
    setImportError(null);
    setImportSummary(null);

    const confirmMsg =
      importMode === 'replace'
        ? `완전 교체 모드입니다. 현재 보관 중인 모든 환자(${parsedBackup.patients.length}명 백업 데이터로 교체)와 검사를 영구 삭제합니다. 정말 진행할까요?`
        : importMode === 'overwrite'
        ? `${parsedBackup.patients.length}명의 환자와 ${parsedBackup.examinations.length}건의 검사를 불러옵니다. 동일 ID는 백업 데이터로 덮어씁니다.`
        : `${parsedBackup.patients.length}명의 환자와 ${parsedBackup.examinations.length}건의 검사 중 새 항목만 추가합니다.`;

    if (!confirm(confirmMsg)) return;
    if (importMode === 'replace' && !confirm('정말 모든 데이터를 삭제하고 백업으로 교체할까요? 복구할 수 없습니다.')) {
      return;
    }

    startImport(async () => {
      try {
        const supabase = createClient();
        const summary = await importBackup(supabase, userId, parsedBackup, importMode);
        setImportSummary(summary);
        router.refresh();
      } catch (e) {
        setImportError(e instanceof Error ? e.message : '복원 실패');
      }
    });
  }

  function resetImport() {
    setPickedFile(null);
    setParsedBackup(null);
    setParseError(null);
    setImportSummary(null);
    setImportError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  return (
    <div className="space-y-6">
      {/* Export */}
      <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
        <div>
          <h2 className="text-sm font-medium">내보내기</h2>
          <p className="mt-1 text-xs text-slate-500">
            현재 계정의 모든 환자와 검사 데이터를 JSON 파일 한 개로 저장합니다. 파일에는 환자
            별칭, 진단명, 검사 결과가 평문으로 포함되니 안전한 곳에 보관하세요.
          </p>
        </div>
        {exportError && <p className="text-xs text-red-600">{exportError}</p>}
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-xs disabled:opacity-40"
        >
          {exporting ? '내보내는 중…' : 'JSON 다운로드'}
        </button>
      </section>

      {/* Import */}
      <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
        <div>
          <h2 className="text-sm font-medium">복원</h2>
          <p className="mt-1 text-xs text-slate-500">
            이전에 내보낸 JSON 파일을 불러옵니다. 새 폰/계정으로 옮길 때 사용합니다.
          </p>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFilePick(f);
          }}
          className="block w-full text-xs file:mr-2 file:rounded-md file:border file:border-slate-200 file:bg-white file:px-3 file:py-1.5 file:text-xs"
        />

        {parseError && <p className="text-xs text-red-600">{parseError}</p>}

        {parsedBackup && (
          <div className="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-3">
            <div className="space-y-1 text-xs text-slate-600">
              <div>
                파일: <span className="font-medium">{pickedFile?.name}</span>
              </div>
              <div>내보낸 시점: {parsedBackup.exportedAt}</div>
              {parsedBackup.exportedBy && <div>작성자: {parsedBackup.exportedBy}</div>}
              <div>
                환자 {parsedBackup.patients.length}명, 검사 {parsedBackup.examinations.length}건
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-700">복원 방식</label>
              <div className="mt-1 space-y-1">
                <ModeRadio
                  value="merge"
                  current={importMode}
                  onChange={setImportMode}
                  label="머지 (안전)"
                  description="새 환자/검사만 추가하고 기존 데이터는 보존"
                />
                <ModeRadio
                  value="overwrite"
                  current={importMode}
                  onChange={setImportMode}
                  label="덮어쓰기"
                  description="같은 ID는 백업 데이터로 교체, 없던 것은 추가"
                />
                <ModeRadio
                  value="replace"
                  current={importMode}
                  onChange={setImportMode}
                  label="완전 교체 (위험)"
                  description="현재 데이터를 모두 삭제한 후 백업으로 채움"
                />
              </div>
            </div>

            {importError && <p className="text-xs text-red-600">{importError}</p>}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleImport}
                disabled={isImporting}
                className="rounded-md bg-slate-900 px-3 py-1.5 text-xs text-white disabled:opacity-40"
              >
                {isImporting ? '복원 중…' : '복원 실행'}
              </button>
              <button
                type="button"
                onClick={resetImport}
                disabled={isImporting}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-xs disabled:opacity-40"
              >
                취소
              </button>
            </div>
          </div>
        )}

        {importSummary && (
          <div className="space-y-1 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
            <div className="font-medium">복원 완료</div>
            {importSummary.deletedBeforeImport && <div>· 기존 데이터 삭제됨</div>}
            <div>
              · 환자: 추가 {importSummary.patientsInserted} · 갱신 {importSummary.patientsUpdated} ·
              건너뜀 {importSummary.patientsSkipped}
            </div>
            <div>
              · 검사: 추가 {importSummary.examinationsInserted} · 갱신{' '}
              {importSummary.examinationsUpdated} · 건너뜀 {importSummary.examinationsSkipped}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function ModeRadio({
  value,
  current,
  onChange,
  label,
  description,
}: {
  value: ImportMode;
  current: ImportMode;
  onChange: (v: ImportMode) => void;
  label: string;
  description: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2 rounded-md border border-slate-200 bg-white p-2">
      <input
        type="radio"
        checked={current === value}
        onChange={() => onChange(value)}
        className="mt-0.5"
      />
      <span className="text-xs">
        <span className="font-medium">{label}</span>
        <span className="ml-2 text-slate-500">{description}</span>
      </span>
    </label>
  );
}
