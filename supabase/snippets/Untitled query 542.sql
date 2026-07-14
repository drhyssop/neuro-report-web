select tablename, policyname, roles, cmd
from pg_policies
where schemaname = 'public' and tablename in ('professors', 'holidays');