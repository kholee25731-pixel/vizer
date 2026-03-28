-- feedbacks에 앱이 사용하는 컬럼 추가 (Supabase에 테이블은 있으나 project_id 없을 때)

BEGIN;

ALTER TABLE public.feedbacks
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE public.feedbacks
  ADD COLUMN IF NOT EXISTS content text;

ALTER TABLE public.feedbacks
  ADD COLUMN IF NOT EXISTS image_url text;

ALTER TABLE public.feedbacks
  ADD COLUMN IF NOT EXISTS deleted boolean DEFAULT false;

ALTER TABLE public.feedbacks
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

ALTER TABLE public.feedbacks
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

UPDATE public.feedbacks
SET
  content = COALESCE(content, ''),
  image_url = COALESCE(image_url, ''),
  deleted = COALESCE(deleted, false);

CREATE INDEX IF NOT EXISTS feedbacks_project_id_idx ON public.feedbacks(project_id);

COMMIT;
