-- v3.6: 오늘 소견(자유 메모)
-- 오늘자 회진 소견을 서술형으로 적는 칸. (예: "저린감은 좋아졌는데 통증은 아직 있다")
-- 환자 기본정보의 patient_memo(고정 메모)와 별개로, exam(날짜)별로 기록된다.
-- 회진문서/환자일보에 "오늘 소견"으로 노출.
alter table examinations add column if not exists daily_note text;
