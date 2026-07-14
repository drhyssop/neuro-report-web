-- v5.0: 교수님 목록 (추가/삭제 가능)
create table if not exists professors (
  initial text primary key,          -- 'D', 'S', 'O', 'T', 'Y', 'R', 'M'
  name text,                         -- 선택: 성함
  sort_order int default 0,
  created_at timestamptz default now()
);

-- 기본 교수님 7명
insert into professors (initial, sort_order) values
  ('D', 1), ('S', 2), ('O', 3), ('T', 4), ('Y', 5), ('R', 6), ('M', 7)
on conflict (initial) do nothing;

alter table professors enable row level security;

-- 로그인한 사용자는 모두 조회/관리 가능 (내부망 회진용)
create policy "professors_authenticated_all" on professors
  for all to authenticated
  using (true) with check (true);
