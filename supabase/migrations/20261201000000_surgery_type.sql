-- v3.10: 수술 종류 (general / local)
-- general(G): 일반 수술 (입원). local(L): 데이서저리/국소시술 (입원 안 함).
-- 기본값 general — 기존 환자는 모두 G로 간주.
alter table patients add column if not exists surgery_type text default 'general';
