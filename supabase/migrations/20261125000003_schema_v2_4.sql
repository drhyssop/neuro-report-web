-- ============================================
-- Neuro Report v2.4 — m-view 수동 선택 플래그
-- ============================================

-- 보드에서 직접 골라서 m-view에 올린 환자 표시
alter table patients add column if not exists is_on_mview boolean not null default false;

-- mview_manual_note는 더이상 사용 안 함 (UI에서 빠짐, DB는 호환을 위해 유지)
-- 기존 데이터를 is_on_mview로 마이그레이션
update patients
set is_on_mview = true
where mview_manual_note is not null and mview_manual_note != '' and is_on_mview = false;

create index if not exists idx_patients_on_mview on patients(user_id, is_on_mview) where is_on_mview = true;
