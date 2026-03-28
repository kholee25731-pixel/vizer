-- Supabase SQL Editor에서 실행 가능
alter table public.projects
  add column if not exists deleted boolean not null default false;

alter table public.projects
  add column if not exists deleted_at timestamptz null;

comment on column public.projects.deleted is '휴지통 이동 여부';
comment on column public.projects.deleted_at is '휴지통 이동 시각';
