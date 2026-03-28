-- feedbacks: AI 분석 결과 저장용 텍스트 컬럼

BEGIN;

ALTER TABLE public.feedbacks
  ADD COLUMN IF NOT EXISTS ai_background text,
  ADD COLUMN IF NOT EXISTS ai_typography text,
  ADD COLUMN IF NOT EXISTS ai_copywriting text,
  ADD COLUMN IF NOT EXISTS ai_layout text,
  ADD COLUMN IF NOT EXISTS ai_key_visual text,
  ADD COLUMN IF NOT EXISTS ai_summary text;

COMMIT;
