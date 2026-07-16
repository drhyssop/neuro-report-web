-- v5.0: 로컬(오프라인) Supabase용 테이블 권한
-- 클라우드 Supabase는 anon/authenticated 역할에 GRANT를 자동으로 해주지만,
-- 로컬 self-host는 직접 부여해야 한다. (없으면 42501 permission denied)
-- RLS는 그대로 유지되므로 행 수준 보안은 정책이 계속 관리한다.

grant usage on schema public to anon, authenticated, service_role;

grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all functions in schema public to anon, authenticated, service_role;

-- 이후 생성되는 객체에도 자동 적용
alter default privileges in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on functions to anon, authenticated, service_role;
