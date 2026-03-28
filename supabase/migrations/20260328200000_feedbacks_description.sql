-- feedbacks: API에서 받은 시안 설명(평문)

BEGIN;

ALTER TABLE public.feedbacks
  ADD COLUMN IF NOT EXISTS description text;

COMMIT;
