select tablename,
       (select count(*) from pg_policies p where p.schemaname='public' and p.tablename = t.tablename) as policy_count,
       rowsecurity as rls_on
from pg_tables t
where schemaname = 'public'
order by tablename;