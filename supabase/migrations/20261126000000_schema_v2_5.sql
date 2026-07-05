-- ============================================
-- Neuro Report v2.5 — Drain 누적 모델
-- ============================================

-- 환자별 drain tube 목록 (시작일/제거일 추적)
alter table patients add column if not exists drains_log jsonb default '[]'::jsonb;

-- 매일 examination에 drain별 배액량 (cc) — key는 drain_id
alter table examinations add column if not exists drain_outputs jsonb default '{}'::jsonb;
