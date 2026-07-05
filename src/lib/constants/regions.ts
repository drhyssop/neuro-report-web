import type { Region } from '@/types/domain';

/**
 * 부위별 motor 그룹 정의.
 * 키는 ExamRegions의 motor 필드 키와 일치해야 함.
 */
export const MOTOR_GROUPS: Record<
  Exclude<Region, 'brain' | 'thoracic'>,
  { key: string; label: string; myotome?: string }[]
> = {
  cervical: [
    { key: 'shoulder',  label: 'Shoulder abd', myotome: 'C5' },
    { key: 'elbowFlex', label: 'Elbow flex',   myotome: 'C5/C6' },
    { key: 'elbowExt',  label: 'Elbow ext',    myotome: 'C7' },
    { key: 'wristExt',  label: 'Wrist ext',    myotome: 'C6' },
    { key: 'wristFlex', label: 'Wrist flex',   myotome: 'C7' },
    { key: 'grasp',     label: 'Grasp',        myotome: 'C7/C8' },
    { key: 'fingerAbd', label: 'Finger abd',   myotome: 'T1' },
  ],
  lumbar: [
    { key: 'hipFlex',  label: 'Hip flex',  myotome: 'L2' },
    { key: 'kneeExt',  label: 'Knee ext',  myotome: 'L3' },
    { key: 'kneeFlex', label: 'Knee flex', myotome: 'L5/S1' },
    { key: 'ankleDF',  label: 'Ankle DF',  myotome: 'L4' },
    { key: 'ankleEHL', label: 'GT ext',    myotome: 'L5' },
    { key: 'anklePF',  label: 'Ankle PF',  myotome: 'S1' },
  ],
};

export const DTR_GROUPS: Record<Region, { key: string; label: string }[]> = {
  brain: [],
  cervical: [
    { key: 'biceps', label: 'Biceps' },
    { key: 'triceps', label: 'Triceps' },
    { key: 'brachioradialis', label: 'BR' },
  ],
  thoracic: [],
  lumbar: [
    { key: 'knee', label: 'Knee' },
    { key: 'ankle', label: 'Ankle' },
  ],
};

/**
 * Dermatome — sensory 매핑.
 */
export const DERMATOMES: Record<Region, string[]> = {
  brain: [],
  cervical: ['C5', 'C6', 'C7', 'C8', 'T1'],
  thoracic: ['T4', 'T6', 'T10'],
  lumbar: ['L2', 'L3', 'L4', 'L5', 'S1'],
};

export const MOTOR_GRADE_LABELS: Record<number, string> = {
  0: 'No contraction',
  1: 'Trace',
  2: 'Active w/o gravity',
  3: 'Against gravity',
  4: 'Against resistance',
  5: 'Normal',
};

export const DTR_GRADE_LABELS: Record<number, string> = {
  0: 'Absent',
  1: 'Hypoactive',
  2: 'Normal',
  3: 'Hyperactive',
  4: 'Clonus',
};

export const SENSORY_OPTIONS = [
  { value: 'intact', label: 'Intact' },
  { value: 'hyper', label: 'Hyperesthesia' },
  { value: 'hypo', label: 'Hypoesthesia' },
] as const;
