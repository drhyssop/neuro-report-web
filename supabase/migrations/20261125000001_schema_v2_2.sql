-- ============================================
-- Neuro Report v2.2 — 항생제 누적 기록, 영상 검사 통합
-- ============================================

-- 1) patients 테이블에 누적 데이터 컬럼 추가
--    antibiotics_log: [{name, started_at, ended_at?}]
--    imaging_log: [{modality, date, findings, kind: 'preop'|'followup'}]
alter table patients add column if not exists antibiotics_log jsonb default '[]'::jsonb;
alter table patients add column if not exists imaging_log jsonb default '[]'::jsonb;

-- 2) surgery_planned_date를 surgery_date로 통합
--    하나의 surgery_date로 합치고, 오늘과 비교해 자동으로 예정/실시 판단
alter table patients add column if not exists surgery_date date;

-- 기존 데이터 마이그레이션 (있다면)
-- surgery_done_date가 있으면 그걸 우선, 없으면 surgery_planned_date 사용
update patients
set surgery_date = coalesce(surgery_done_date, surgery_planned_date)
where surgery_date is null
  and (surgery_done_date is not null or surgery_planned_date is not null);

-- 기존 preop_imaging의 데이터를 imaging_log로 이동 (있다면)
update patients
set imaging_log = (
  select jsonb_agg(
    jsonb_build_object(
      'modality', elem->>'modality',
      'date', elem->>'date',
      'findings', elem->>'findings',
      'kind', 'preop'
    )
  )
  from jsonb_array_elements(preop_imaging) elem
)
where preop_imaging is not null
  and jsonb_array_length(preop_imaging) > 0
  and (imaging_log is null or jsonb_array_length(imaging_log) = 0);
