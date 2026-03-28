-- Run in Supabase SQL Editor if migrations folder is not wired.
alter table public.projects
  add column if not exists description text default '';

comment on column public.projects.description is '프로젝트 설명 (앱과 동기화)';
