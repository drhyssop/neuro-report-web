select u.email, p.display_name, p.role
from auth.users u
left join profiles p on p.user_id = u.id;