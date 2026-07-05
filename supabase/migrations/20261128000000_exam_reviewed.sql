-- v3.6: 회진 확인(reviewed) 표시
-- examination에 "오늘 회진에서 확인했다"는 타임스탬프를 남긴다.
-- null  = 미확인 (열어보지 않았거나, 열었지만 아무 행동 없이 나감)
-- 값 있음 = 확인됨 (변화를 입력했거나 "변화 없음" 버튼을 눌렀음)
-- 이 컬럼이 있어야 환자일보에서 "확인-변화없음" vs "미확인"을 구분할 수 있다.
alter table examinations add column if not exists reviewed_at timestamptz;
