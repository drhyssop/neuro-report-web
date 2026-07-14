-- v5.0: 담당 교수 (오프라인 버전 — 교수님별 보드 분리)
-- 이니셜: D S O T Y R M (추가 가능)
-- null이면 미지정 (전체 보드에서만 보임)
alter table patients add column if not exists professor text;

create index if not exists idx_patients_professor on patients(professor, active);
