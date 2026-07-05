-- v3.7: 자리(seat) / 복용약 / lab
-- bed_seat: 같은 병동(호수) 내 자리 번호 1~6. 회진 순서 6→1. null이면 모름.
alter table patients add column if not exists bed_seat smallint;
-- medications: 복용약 (환자 단위, 지속). { lyrica: number|null, nucynta, pelubi, ultracet: bool, custom: string[], osteo: 'prolia'|'evenity'|null }
alter table patients add column if not exists medications jsonb default '{}'::jsonb;
-- bmd: 골밀도 T-score (환자 단위, 수술 정보 옆 표시)
alter table patients add column if not exists bmd text;
-- labs: 오늘 lab (exam 단위). { wbc, hb, crp, cr }
alter table examinations add column if not exists labs jsonb default '{}'::jsonb;
