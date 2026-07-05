-- ============================================
-- Neuro Report — initial schema
-- ============================================

create extension if not exists "uuid-ossp";

-- patients: 입원 환자 (퇴원 시 active=false로 유지, 삭제하지 않음)
create table patients (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references auth.users on delete cascade,
  alias        text not null,                       -- 본인 별칭 ("201호-A" 등)
  diagnosis    text,
  region_main  text check (region_main in ('brain', 'cervical', 'thoracic', 'lumbar')),
  admitted_at  date not null default current_date,
  discharged_at date,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index idx_patients_user_active on patients(user_id, active, admitted_at desc);
create index idx_patients_user_archived on patients(user_id, discharged_at desc) where active = false;

-- examinations: 환자별 검사 결과 (하루 한 건, JSONB로 부위별 데이터 유연 저장)
create table examinations (
  id              uuid primary key default uuid_generate_v4(),
  patient_id      uuid not null references patients on delete cascade,
  user_id         uuid not null references auth.users on delete cascade,
  exam_date       date not null default current_date,
  hospital_day    int,                              -- 입원 N일째 (POD)
  regions         jsonb not null default '{}'::jsonb,  -- {brain:{...}, lumbar:{...}}
  generated_note  text,                             -- SOAP 노트 캐시
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique(patient_id, exam_date)
);

create index idx_exams_patient_date on examinations(patient_id, exam_date desc);
create index idx_exams_user_date on examinations(user_id, exam_date desc);

-- updated_at 자동 갱신 트리거
create or replace function tg_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_patients_updated_at
  before update on patients
  for each row execute function tg_set_updated_at();

create trigger trg_exams_updated_at
  before update on examinations
  for each row execute function tg_set_updated_at();
