-- ============================================
-- Neuro Report — v2 schema extensions
-- 환자 정보, 수술 정보, 일일 기록 항목 확장
-- ============================================

-- patients 테이블 확장
alter table patients add column if not exists age int;
alter table patients add column if not exists sex text check (sex in ('M', 'F'));
alter table patients add column if not exists ward text;             -- 병동/호수 (예: '1013', '926')
alter table patients add column if not exists expected_discharge date;
alter table patients add column if not exists surgery_name text;
alter table patients add column if not exists surgery_planned_date date;
alter table patients add column if not exists surgery_done_date date;
alter table patients add column if not exists is_consult boolean not null default false;
alter table patients add column if not exists consult_dept text;     -- 협진 원과 (이니셜)
alter table patients add column if not exists consult_history text;
alter table patients add column if not exists patient_memo text;
alter table patients add column if not exists preop_imaging jsonb default '[]'::jsonb;  -- 수술전 영상 [{modality, date, findings}]

create index if not exists idx_patients_ward on patients(user_id, ward) where active = true;
create index if not exists idx_patients_surgery on patients(user_id, surgery_planned_date) where active = true;
create index if not exists idx_patients_consult on patients(user_id, is_consult) where active = true;

-- examinations에 일일 기록 필드 (regions 외 별도 컬럼으로 빠른 조회 가능)
alter table examinations add column if not exists fever boolean not null default false;
alter table examinations add column if not exists fever_temp numeric(3,1);  -- 최고 체온
alter table examinations add column if not exists antibiotics jsonb default '[]'::jsonb;  -- ['refosporen', ...]
alter table examinations add column if not exists drains jsonb default '[]'::jsonb;       -- [{type, side, label, output}]
alter table examinations add column if not exists followup_imaging jsonb default '[]'::jsonb;  -- [{modality, findings}]
alter table examinations add column if not exists pod int;  -- post-op day, surgery_done_date 기반 자동 계산

-- m-view 리스트: 협진 환자/drain 제거자 빠르게 조회용 인덱스
create index if not exists idx_exams_fever on examinations(user_id, exam_date) where fever = true;
