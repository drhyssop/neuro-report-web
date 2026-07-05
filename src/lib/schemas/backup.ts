import { z } from 'zod';

export const BACKUP_VERSION = 1;

// 환자 데이터 (export 시점의 컬럼)
const patientBackupSchema = z.object({
  id: z.string().uuid(),
  alias: z.string(),
  diagnosis: z.string().nullable().optional(),
  region_main: z.enum(['brain', 'cervical', 'thoracic', 'lumbar']).nullable().optional(),
  admitted_at: z.string(),
  discharged_at: z.string().nullable().optional(),
  active: z.boolean(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

// 검사 데이터
const examBackupSchema = z.object({
  id: z.string().uuid(),
  patient_id: z.string().uuid(),
  exam_date: z.string(),
  hospital_day: z.number().nullable().optional(),
  regions: z.record(z.unknown()),
  generated_note: z.string().nullable().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export const backupFileSchema = z.object({
  version: z.number(),
  exportedAt: z.string(),
  exportedBy: z.string().optional(),
  patients: z.array(patientBackupSchema),
  examinations: z.array(examBackupSchema),
});

export type BackupFile = z.infer<typeof backupFileSchema>;
export type PatientBackup = z.infer<typeof patientBackupSchema>;
export type ExamBackup = z.infer<typeof examBackupSchema>;

export const IMPORT_MODES = ['merge', 'overwrite', 'replace'] as const;
export type ImportMode = (typeof IMPORT_MODES)[number];

export interface ImportSummary {
  patientsInserted: number;
  patientsUpdated: number;
  patientsSkipped: number;
  examinationsInserted: number;
  examinationsUpdated: number;
  examinationsSkipped: number;
  deletedBeforeImport: boolean;
}
