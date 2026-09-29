-- UniTute: how each lesson relates to the course's objectives, and which objectives it serves.
-- (Section-level labels live on heading blocks inside lessons.blocks, so need no column.)
-- Run once in the Supabase dashboard (UniTute project): SQL Editor -> New query -> paste -> Run.

alter table public.lessons
  add column relevance text check (relevance in ('core', 'supporting', 'extension')),
  add column objectives jsonb not null default '[]';
