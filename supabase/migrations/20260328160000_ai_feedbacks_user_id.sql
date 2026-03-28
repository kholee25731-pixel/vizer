-- ai_feedbacks: 소유 사용자 연결 (RLS/감사용)

BEGIN;

ALTER TABLE public.ai_feedbacks
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

UPDATE public.ai_feedbacks AS af
SET user_id = p.user_id
FROM public.projects AS p
WHERE p.id = af.project_id
  AND af.user_id IS NULL;

DELETE FROM public.ai_feedbacks WHERE user_id IS NULL;

ALTER TABLE public.ai_feedbacks
  ALTER COLUMN user_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS ai_feedbacks_user_id_idx
  ON public.ai_feedbacks(user_id);

COMMIT;
