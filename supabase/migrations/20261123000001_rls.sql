-- ============================================
-- RLS: 본인이 만든 데이터만 조회/수정/삭제 가능
-- ============================================

alter table patients enable row level security;
alter table examinations enable row level security;

-- patients
create policy "select_own_patients" on patients
  for select using (auth.uid() = user_id);

create policy "insert_own_patients" on patients
  for insert with check (auth.uid() = user_id);

create policy "update_own_patients" on patients
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "delete_own_patients" on patients
  for delete using (auth.uid() = user_id);

-- examinations
create policy "select_own_exams" on examinations
  for select using (auth.uid() = user_id);

create policy "insert_own_exams" on examinations
  for insert with check (auth.uid() = user_id);

create policy "update_own_exams" on examinations
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "delete_own_exams" on examinations
  for delete using (auth.uid() = user_id);
