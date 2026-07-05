import type { SupabaseClient } from '@supabase/supabase-js';
import {
  BACKUP_VERSION,
  backupFileSchema,
  type BackupFile,
  type ImportMode,
  type ImportSummary,
} from '@/lib/schemas/backup';

/**
 * 현재 사용자의 모든 환자/검사를 JSON으로 export.
 * RLS 덕분에 본인 데이터만 자동으로 가져옴.
 */
export async function exportBackup(
  supabase: SupabaseClient,
  exportedBy?: string,
): Promise<BackupFile> {
  const { data: patients, error: pe } = await supabase
    .from('patients')
    .select('id, alias, diagnosis, region_main, admitted_at, discharged_at, active, created_at, updated_at')
    .order('created_at', { ascending: true });
  if (pe) throw pe;

  const { data: exams, error: ee } = await supabase
    .from('examinations')
    .select('id, patient_id, exam_date, hospital_day, regions, generated_note, created_at, updated_at')
    .order('created_at', { ascending: true });
  if (ee) throw ee;

  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    exportedBy,
    patients: patients ?? [],
    examinations: exams ?? [],
  };
}

/**
 * 백업 파일 파싱 + 검증.
 * 잘못된 형식이면 throw.
 */
export function parseBackupFile(rawText: string): BackupFile {
  let raw: unknown;
  try {
    raw = JSON.parse(rawText);
  } catch {
    throw new Error('JSON 파싱 실패: 파일이 손상되었거나 형식이 잘못됨');
  }
  const parsed = backupFileSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error('백업 파일 구조가 올바르지 않습니다');
  }
  if (parsed.data.version > BACKUP_VERSION) {
    throw new Error(
      `최신 백업 형식 (v${parsed.data.version})입니다. 앱을 업데이트해주세요`,
    );
  }
  return parsed.data;
}

/**
 * 백업 파일을 DB로 import.
 *
 * 보안: user_id는 항상 현재 로그인 사용자로 강제 교체.
 *       백업 파일에 다른 user_id가 있어도 무시 (조작 방지).
 *       파일에 user_id 필드 자체가 없어도 서버가 채워줌 (스키마에서 제외).
 *
 * mode:
 *  - merge: 기존 id와 충돌하면 건너뜀
 *  - overwrite: 기존 id와 충돌하면 update (upsert)
 *  - replace: 사용자의 모든 데이터 삭제 후 새로 insert
 */
export async function importBackup(
  supabase: SupabaseClient,
  userId: string,
  backup: BackupFile,
  mode: ImportMode,
): Promise<ImportSummary> {
  const summary: ImportSummary = {
    patientsInserted: 0,
    patientsUpdated: 0,
    patientsSkipped: 0,
    examinationsInserted: 0,
    examinationsUpdated: 0,
    examinationsSkipped: 0,
    deletedBeforeImport: false,
  };

  // user_id를 현재 사용자로 강제 부여
  const patientRows = backup.patients.map((p) => ({
    ...p,
    user_id: userId,
  }));
  const examRows = backup.examinations.map((e) => ({
    ...e,
    user_id: userId,
  }));

  if (mode === 'replace') {
    // RLS로 본인 데이터만 삭제됨. cascade로 exams도 함께
    const { error: de } = await supabase.from('patients').delete().eq('user_id', userId);
    if (de) throw de;
    summary.deletedBeforeImport = true;
  }

  // patients 처리
  if (mode === 'merge') {
    // 기존 id 조회 → 없는 것만 insert
    const ids = patientRows.map((p) => p.id);
    const { data: existing } = await supabase
      .from('patients')
      .select('id')
      .in('id', ids);
    const existingIds = new Set((existing ?? []).map((r) => r.id));
    const toInsert = patientRows.filter((p) => !existingIds.has(p.id));
    summary.patientsSkipped = patientRows.length - toInsert.length;
    if (toInsert.length > 0) {
      const { error } = await supabase.from('patients').insert(toInsert);
      if (error) throw error;
      summary.patientsInserted = toInsert.length;
    }
  } else {
    // overwrite, replace → upsert (id 기준)
    if (patientRows.length > 0) {
      const { error } = await supabase.from('patients').upsert(patientRows, { onConflict: 'id' });
      if (error) throw error;
      // upsert는 inserted/updated 구분이 어려워 전체 카운트만
      if (mode === 'replace') summary.patientsInserted = patientRows.length;
      else summary.patientsUpdated = patientRows.length;
    }
  }

  // examinations 처리 (patient_id가 유효한 것만)
  // FK 위반 방지 위해 patient_id 목록 검증
  const validPatientIds = new Set(patientRows.map((p) => p.id));
  const validExams = examRows.filter((e) => validPatientIds.has(e.patient_id));
  const orphanCount = examRows.length - validExams.length;
  if (orphanCount > 0) {
    summary.examinationsSkipped += orphanCount;
  }

  if (mode === 'merge') {
    const ids = validExams.map((e) => e.id);
    const { data: existing } = await supabase
      .from('examinations')
      .select('id')
      .in('id', ids);
    const existingIds = new Set((existing ?? []).map((r) => r.id));
    const toInsert = validExams.filter((e) => !existingIds.has(e.id));
    summary.examinationsSkipped += validExams.length - toInsert.length;
    if (toInsert.length > 0) {
      const { error } = await supabase.from('examinations').insert(toInsert);
      if (error) throw error;
      summary.examinationsInserted = toInsert.length;
    }
  } else {
    if (validExams.length > 0) {
      const { error } = await supabase.from('examinations').upsert(validExams, { onConflict: 'id' });
      if (error) throw error;
      if (mode === 'replace') summary.examinationsInserted = validExams.length;
      else summary.examinationsUpdated = validExams.length;
    }
  }

  return summary;
}

/**
 * Blob 다운로드 유틸 — export 결과를 파일로 저장
 */
export function downloadBackupAsFile(backup: BackupFile, filename?: string) {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const date = backup.exportedAt.slice(0, 10);
  a.href = url;
  a.download = filename ?? `neuro-report-backup-${date}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
