-- ============================================
-- Neuro Report — 오프라인 SQLite 스키마
-- Supabase(Postgres) 스키마를 SQLite로 이식.
-- - uuid → text (앱에서 crypto.randomUUID로 생성)
-- - jsonb → text (JSON.stringify로 저장, 읽을 때 parse)
-- - timestamptz/date → text (ISO 문자열)
-- - boolean → integer (0/1)
-- - RLS/auth 없음 (오프라인 단일 사용자, 교수 필터는 앱에서)
-- ============================================

PRAGMA journal_mode = WAL;      -- 동시 읽기 성능
PRAGMA foreign_keys = ON;

create table if not exists patients (
  id            text primary key,
  user_id       text,                       -- 오프라인에선 항상 'local' (호환용)
  alias         text not null,
  diagnosis     text,
  region_main   text,
  admitted_at   text not null,              -- date (YYYY-MM-DD)
  discharged_at text,
  active        integer not null default 1,
  age           integer,
  sex           text,
  ward          text,
  bed_seat      integer,
  bmd           text,
  professor     text,
  patient_memo  text,
  past_op_history text,
  consult_dept  text,
  consult_history text,
  is_consult    integer not null default 0,
  is_admission_pending integer not null default 0,
  is_on_mview   integer not null default 0,
  mview_excluded_date text,
  mview_manual_note text,
  expected_discharge text,
  surgery_name  text,
  surgery_date  text,
  surgery_planned_date text,
  surgery_done_date text,
  surgery_type  text default 'general',
  baseline_regions text default '{}',
  medications   text default '{}',
  consults_log  text default '[]',
  drains_log    text default '[]',
  imaging_log   text default '[]',
  antibiotics_log text default '[]',
  preop_imaging text default '[]',
  rounding_notes text default '[]',
  created_at    text not null,
  updated_at    text not null
);

create index if not exists idx_patients_active on patients(active, admitted_at desc);
create index if not exists idx_patients_professor on patients(professor, active);

create table if not exists examinations (
  id             text primary key,
  patient_id     text not null references patients on delete cascade,
  user_id        text,
  exam_date      text not null,             -- date
  hospital_day   integer,
  regions        text not null default '{}',
  generated_note text,
  fever          integer not null default 0,
  fever_temp     real,
  antibiotics    text default '[]',
  drains         text default '[]',
  drain_outputs  text default '{}',
  followup_imaging text default '[]',
  labs           text default '{}',
  pod            integer,
  daily_note     text,
  reviewed_at    text,
  created_at     text not null,
  updated_at     text not null,
  unique(patient_id, exam_date)
);

create index if not exists idx_exams_patient_date on examinations(patient_id, exam_date desc);

create table if not exists holidays (
  date       text primary key,
  label      text,
  created_at text
);

create table if not exists professors (
  initial    text primary key,
  name       text,
  sort_order integer default 0,
  created_at text
);

insert or ignore into professors (initial, sort_order) values
  ('D',1),('S',2),('O',3),('T',4),('Y',5),('R',6),('M',7);
