// 검사 부위
export type Region = 'brain' | 'cervical' | 'thoracic' | 'lumbar';

// 좌우 페어
export interface Bilateral<T> {
  lt: T;
  rt: T;
}

// MRC motor power scale 0-5
export type MotorGrade = 0 | 1 | 2 | 3 | 4 | 5 | null;

// DTR scale 0-4 (0=absent, 1=hypo, 2=normal, 3=hyper, 4=clonus)
export type DtrGrade = 0 | 1 | 2 | 3 | 4 | null;

// Sensory 평가 — 'hyper' (↑) / 'intact' (-) / 'hypo' (↓)
// 디폴트는 'intact'로 간주 (null도 intact)
export type SensoryStatus = 'hyper' | 'intact' | 'hypo' | null;

// 부위별 검사 데이터 (JSONB로 저장)
export interface BrainExam {
  hx?: string;
  medication?: string;
  onset?: string;
  mentalStatus?: 'alert' | 'drowsy' | 'stupor' | 'semicoma' | 'coma' | null;
  // GCS — 각 항목 점수, 합산은 자동
  gcsE?: 1 | 2 | 3 | 4 | null;          // Eye opening 1-4
  gcsV?: 1 | 2 | 3 | 4 | 5 | null;      // Verbal 1-5
  gcsM?: 1 | 2 | 3 | 4 | 5 | 6 | null;  // Motor 1-6
  pupil?: Bilateral<{ size?: number; reactivity?: 'prompt' | 'sluggish' | 'fixed' | null }>;
  eom?: Bilateral<'full' | 'limited' | 'fixed' | null>;
  facial?: 'symmetric' | 'central-palsy' | 'peripheral-palsy' | null;
  aphasia?: 'none' | 'motor' | 'sensory' | 'global' | null;
  dysarthria?: 'none' | 'mild' | 'severe' | null;
  motorUpper?: Bilateral<MotorGrade>;
  motorLower?: Bilateral<MotorGrade>;
  sensory?: SensoryStatus;
  pathologicSigns?: PathologicSigns;
  notes?: string;
}

// 공통 pathologic signs — 체크 안 하면 표시 안 함, 체크하면 환자일보에 표기
export interface PathologicSigns {
  hoffman?: boolean;
  babinski?: boolean;
  analToneDecreased?: boolean;
  voidingProblem?: boolean;
  gaitDisturbance?: boolean;
}

export interface CervicalExam {
  hx?: string;
  // Pain 구조 v3
  nuchalPain?: boolean;              // Nuchal pain 활성 여부
  nuchalVas?: number | null;         // 1~9, null이면 미선택
  radicularPain?: boolean;           // Radicular pain 활성 여부
  radicularVas?: number | null;      // 1~9
  radicularQuality?: { pain?: boolean; tingling?: boolean };
  radicularDominance?: 'R>L' | 'L>R'; // 양측 시 우세측
  mainPain?: 'nuchal' | 'radicular' | null;
  vas?: number;                      // legacy — 호환
  motor?: {
    shoulder?: Bilateral<MotorGrade>;
    elbowFlex?: Bilateral<MotorGrade>;
    elbowExt?: Bilateral<MotorGrade>;
    wristFlex?: Bilateral<MotorGrade>;
    wristExt?: Bilateral<MotorGrade>;
    grasp?: Bilateral<MotorGrade>;
    fingerAbd?: Bilateral<MotorGrade>;
  };
  dtr?: {
    biceps?: Bilateral<DtrGrade>;
    triceps?: Bilateral<DtrGrade>;
    brachioradialis?: Bilateral<DtrGrade>;
  };
  sensory?: Record<string, Bilateral<SensoryStatus>>;
  sensoryPain?: unknown[];
  gait?: 'normal' | 'antalgic' | 'ataxic' | 'unable' | null;
  pathologicSigns?: PathologicSigns;
  notes?: string;
}

export interface ThoracicExam {
  hx?: string;
  dtr?: Bilateral<DtrGrade>;
  sensory?: Record<string, Bilateral<SensoryStatus>>;
  sensoryPain?: unknown[];
  pathologicSigns?: PathologicSigns;
  notes?: string;
}

export interface LumbarExam {
  hx?: string;
  // Pain 구조 v3
  backPain?: boolean;
  backVas?: number | null;
  radicularPain?: boolean;
  radicularVas?: number | null;
  radicularQuality?: { pain?: boolean; tingling?: boolean };
  radicularDominance?: 'R>L' | 'L>R'; // 양측 시 우세측
  nic?: boolean;
  mainPain?: 'back' | 'radicular' | null;
  vas?: number;  // legacy
  motor?: {
    hipFlex?: Bilateral<MotorGrade>;
    kneeExt?: Bilateral<MotorGrade>;
    kneeFlex?: Bilateral<MotorGrade>;
    ankleDF?: Bilateral<MotorGrade>;
    ankleEHL?: Bilateral<MotorGrade>;
    anklePF?: Bilateral<MotorGrade>;
  };
  dtr?: {
    knee?: Bilateral<DtrGrade>;
    ankle?: Bilateral<DtrGrade>;
  };
  sensory?: Record<string, Bilateral<SensoryStatus>>;
  sensoryPain?: unknown[];
  pathologic?: {
    babinski?: Bilateral<'flexor' | 'extensor' | null>;
    clonus?: Bilateral<boolean>;
  };
  pathologicSigns?: PathologicSigns;
  bladder?: 'normal' | 'incontinence' | 'retention' | null;
  notes?: string;
}

export interface ExamRegions {
  brain?: BrainExam;
  cervical?: CervicalExam;
  thoracic?: ThoracicExam;
  lumbar?: LumbarExam;
}

// 변화 감지 결과 (어제 vs 오늘)
export type ChangeKind = 'improved' | 'worsened' | 'changed' | 'unchanged' | 'new';

export interface FieldChange {
  path: string;       // "lumbar.motor.hipFlex.lt"
  yesterday: unknown;
  today: unknown;
  kind: ChangeKind;
}
