-- ============================================
-- Realtime: 클라이언트가 postgres_changes 이벤트를 받을 수 있도록 publication에 추가
-- RLS는 그대로 적용되어 본인 데이터의 변경만 받음
-- ============================================

-- 기본 publication에 추가 (Supabase 프로젝트에는 'supabase_realtime' publication이 미리 생성되어 있음)
alter publication supabase_realtime add table patients;
alter publication supabase_realtime add table examinations;

-- replica identity는 update 이벤트 payload에 full row를 넣기 위해 필요
alter table patients replica identity full;
alter table examinations replica identity full;
