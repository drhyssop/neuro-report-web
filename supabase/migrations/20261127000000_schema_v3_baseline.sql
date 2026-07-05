-- v3: 입원 시 "기존 증상" (baseline) 을 환자 단위로 별도 저장.
-- examinations.regions 와 동일한 ExamRegions 구조의 JSONB.
-- 입원 시 한 번 입력하고, 이후 추가 정보가 생기면 편집 가능.
-- "오늘 증상"(examinations.regions)과 명확히 구분되며, 회진문서/배너의 변화 비교 기준이 된다.

alter table patients add column if not exists baseline_regions jsonb default '{}'::jsonb;

comment on column patients.baseline_regions is
  '입원 시 기존 증상/motor/sensory 등 baseline 상태 (ExamRegions 구조). 오늘 증상과 비교 기준.';
