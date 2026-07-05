-- v3.6: m-view '오늘 제외' + f/u 검사 m-view 토글
-- mview_excluded_date: 자동으로 올라온 환자를 "오늘 하루" m-view에서 제외할 때 그 날짜 기록.
--   값이 오늘과 같으면 m-view에서 숨김. 내일이 되면 다시 대상이면 자동으로 올라옴.
alter table patients add column if not exists mview_excluded_date date;
