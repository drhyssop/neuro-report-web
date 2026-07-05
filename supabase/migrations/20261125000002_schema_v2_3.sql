-- ============================================
-- Neuro Report v2.3 — 수술력, 입원예정 환자, m-view 수동 추가
-- ============================================

-- 환자 정보에 수술력(과거 수술 이력) 추가
alter table patients add column if not exists past_op_history text;

-- 입원예정 플래그 — 아직 입원 안 했지만 예정자 (m-view 후보)
alter table patients add column if not exists is_admission_pending boolean not null default false;

-- m-view 수동 메모 — 환자 단위로 "오늘 m-view에 띄우라" 표시
-- 자동 추출 외에 의사 수동 지정용
alter table patients add column if not exists mview_manual_note text;

-- 인덱스
create index if not exists idx_patients_admission_pending on patients(user_id, is_admission_pending) where is_admission_pending = true;
