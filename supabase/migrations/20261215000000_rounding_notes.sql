-- v4.3: 회진 누적 메모 (매일 기억할 항목들)
-- 예: "금요일 전원 예정", "목요일 cxr f/u"
-- [{ id, text, done, created_at }]
alter table patients add column if not exists rounding_notes jsonb default '[]'::jsonb;
