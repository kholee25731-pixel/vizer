-- ai_feedbacks: 프로젝트 단위로만 연결 (레거시 feedback_id 컬럼 제거)

BEGIN;

ALTER TABLE public.ai_feedbacks
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE public.ai_feedbacks
  ADD COLUMN IF NOT EXISTS image_url text;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ai_feedbacks'
      AND column_name = 'feedback_id'
  ) THEN
    UPDATE public.ai_feedbacks AS af
    SET
      project_id = f.project_id,
      image_url = f.image_url
    FROM public.feedbacks AS f
    WHERE f.id = af.feedback_id;

    DELETE FROM public.ai_feedbacks WHERE project_id IS NULL;
    ALTER TABLE public.ai_feedbacks DROP COLUMN feedback_id;
  END IF;
END $$;

DELETE FROM public.ai_feedbacks WHERE project_id IS NULL;

ALTER TABLE public.ai_feedbacks
  ALTER COLUMN project_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS ai_feedbacks_project_id_idx
  ON public.ai_feedbacks(project_id);

COMMIT;
