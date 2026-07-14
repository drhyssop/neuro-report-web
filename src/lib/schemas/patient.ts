import { z } from 'zod';

export const regionEnum = z.enum(['brain', 'cervical', 'thoracic', 'lumbar']);
export const sexEnum = z.enum(['M', 'F']);

export const antibioticEntrySchema = z.object({
  name: z.string().min(1).max(50),
  started_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  ended_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  note: z.string().max(200).optional(),
});

export const drainTubeSchema = z.object({
  id: z.string(),
  type: z.enum(['JP', 'HV', 'Other']),
  side: z.enum(['Lt', 'Rt', 'Mid']),
  index: z.number().int().min(1),
  started_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  ended_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  note: z.string().max(200).optional(),
});

export const imagingLogEntrySchema = z.object({
  modality: z.enum(['X-ray', 'CT', 'MRI', 'US', 'Bone scan', 'EMG/NCS', 'Other']),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  findings: z.string().max(2000).optional(),
  kind: z.enum(['preop', 'followup']),
});

export const medicationsSchema = z.object({
  lyrica: z.number().nullable().optional(),
  lyricaOn: z.boolean().optional(),
  nucynta: z.boolean().optional(),
  pelubi: z.boolean().optional(),
  ultracet: z.boolean().optional(),
  custom: z.array(z.string().max(50)).optional(),
  osteo: z.enum(['prolia', 'evenity']).nullable().optional(),
});

export const patientCreateSchema = z.object({
  alias: z.string().min(1, '환자 별칭은 필수입니다').max(50),
  diagnosis: z.string().max(200).optional(),
  region_main: regionEnum.optional(),
  admitted_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '날짜 형식: YYYY-MM-DD'),
  age: z.number().int().min(0).max(120).optional(),
  sex: sexEnum.optional(),
  ward: z.string().max(20).optional(),
  bed_seat: z.number().int().min(1).max(6).nullable().optional(),
  expected_discharge: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  surgery_name: z.string().max(200).optional(),
  surgery_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  surgery_type: z.enum(['general', 'local']).optional(),
  professor: z.string().max(4).optional(),
  bmd: z.string().max(20).optional(),
  is_consult: z.boolean().optional(),
  consult_dept: z.string().max(10).optional(),
  consult_history: z.string().max(2000).optional(),
  patient_memo: z.string().max(2000).optional(),
  past_op_history: z.string().max(2000).optional(),
  is_admission_pending: z.boolean().optional(),
  is_on_mview: z.boolean().optional(),
  medications: medicationsSchema.optional(),
  antibiotics_log: z.array(antibioticEntrySchema).optional(),
  imaging_log: z.array(imagingLogEntrySchema).optional(),
  drains_log: z.array(drainTubeSchema).optional(),
});

export const patientUpdateSchema = patientCreateSchema.partial();

export const dischargeSchema = z.object({
  discharged_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export type PatientCreate = z.infer<typeof patientCreateSchema>;
export type PatientUpdate = z.infer<typeof patientUpdateSchema>;
