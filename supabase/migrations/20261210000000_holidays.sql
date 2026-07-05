-- v4.0: 수동 등록 공휴일 (음력·임시공휴일·병원 자체 휴진일)
-- 양력 고정 공휴일(신정/삼일절/어린이날/현충일/광복절/개천절/한글날/성탄절)은 코드에서 처리.
create table if not exists holidays (
  date date primary key,
  label text,
  created_at timestamptz default now()
);
