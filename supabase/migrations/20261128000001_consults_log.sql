-- v3.6: 타과 협진 의뢰 로그
-- 우리 입원환자가 다른 과(CM 호흡기내과 등)에 협진을 의뢰한 기록을 누적 저장.
-- drain/antibiotics_log와 동일한 JSONB 누적 패턴.
-- 각 항목: { id, date, dept, content, answer, answered_at }
-- m-view의 is_consult(타과→우리 협진)와는 무관한 독립 데이터.
alter table patients add column if not exists consults_log jsonb default '[]'::jsonb;
