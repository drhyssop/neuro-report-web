-- ============================================
-- profiles: 사용자 역할 + PIN 해시
-- auth.users에 1:1로 연결됨
-- ============================================

create table profiles (
  user_id      uuid primary key references auth.users on delete cascade,
  display_name text not null,
  role         text not null default 'user' check (role in ('user', 'admin')),
  pin_hash     text,                                 -- bcrypt 해시 (null이면 PIN 미설정 → 로그인 직후 강제 설정)
  pin_set_at   timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index idx_profiles_role on profiles(role);

create trigger trg_profiles_updated_at
  before update on profiles
  for each row execute function tg_set_updated_at();

-- 새 user 가입 시 profile 자동 생성
create or replace function tg_create_profile_on_signup()
returns trigger as $$
declare
  is_first_user boolean;
begin
  -- 첫 번째 사용자면 admin, 아니면 user
  select count(*) = 0 into is_first_user from profiles;

  insert into profiles (user_id, display_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    case when is_first_user then 'admin' else 'user' end
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger trg_auth_user_created
  after insert on auth.users
  for each row execute function tg_create_profile_on_signup();

-- ============================================
-- RLS
-- ============================================

alter table profiles enable row level security;

-- 본인 프로필 조회 가능
create policy "select_own_profile" on profiles
  for select using (auth.uid() = user_id);

-- 관리자는 모든 프로필 조회 가능 (계정 관리 화면용)
create policy "admin_select_all_profiles" on profiles
  for select using (
    exists (select 1 from profiles p where p.user_id = auth.uid() and p.role = 'admin')
  );

-- 본인 프로필 수정 (PIN 변경 등) — role은 못 바꿈
create policy "update_own_profile" on profiles
  for update using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and role = (select p.role from profiles p where p.user_id = auth.uid())
  );

-- 관리자만 모든 프로필 update 가능 (PIN 리셋, 역할 변경)
create policy "admin_update_all_profiles" on profiles
  for update using (
    exists (select 1 from profiles p where p.user_id = auth.uid() and p.role = 'admin')
  );

-- 관리자만 다른 프로필 delete 가능 (자기 자신 제외)
create policy "admin_delete_others" on profiles
  for delete using (
    auth.uid() != user_id
    and exists (select 1 from profiles p where p.user_id = auth.uid() and p.role = 'admin')
  );

-- ============================================
-- RPC: PIN 검증 — 클라이언트가 PIN을 평문 전송하지 않고 hash 비교는 서버에서
-- bcrypt extension 필요
-- ============================================

create extension if not exists pgcrypto;

-- PIN 설정 (본인 또는 관리자에 의한 리셋)
create or replace function set_pin(target_user_id uuid, new_pin text)
returns void as $$
declare
  is_admin boolean;
begin
  -- 본인이거나 admin이어야 함
  select exists (select 1 from profiles where user_id = auth.uid() and role = 'admin') into is_admin;
  if auth.uid() != target_user_id and not is_admin then
    raise exception 'permission denied';
  end if;

  -- 4-6자리 숫자 검증
  if new_pin !~ '^\d{4,6}$' then
    raise exception 'pin must be 4-6 digits';
  end if;

  update profiles
  set pin_hash = crypt(new_pin, gen_salt('bf', 8)),
      pin_set_at = now()
  where user_id = target_user_id;
end;
$$ language plpgsql security definer;

-- PIN 검증 (본인 확인용)
create or replace function verify_pin(input_pin text)
returns boolean as $$
declare
  stored_hash text;
begin
  select pin_hash into stored_hash from profiles where user_id = auth.uid();
  if stored_hash is null then return false; end if;
  return stored_hash = crypt(input_pin, stored_hash);
end;
$$ language plpgsql security definer;

-- PIN 초기화 (관리자가 사용자의 PIN 제거 → 다음 로그인 시 재설정 강제)
create or replace function clear_pin(target_user_id uuid)
returns void as $$
declare
  is_admin boolean;
begin
  select exists (select 1 from profiles where user_id = auth.uid() and role = 'admin') into is_admin;
  if not is_admin then raise exception 'admin only'; end if;

  update profiles set pin_hash = null, pin_set_at = null where user_id = target_user_id;
end;
$$ language plpgsql security definer;
