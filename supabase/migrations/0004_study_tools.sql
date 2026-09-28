-- UniTute: per-lesson flashcards and formulas (gathered into each unit's deck and formula sheet).
-- Plots, diagrams and interactive widgets live inside lessons.blocks, so they need no change here.
-- Run once in the Supabase dashboard (UniTute project): SQL Editor -> New query -> paste -> Run.

alter table public.lessons
  add column flashcards jsonb not null default '[]',
  add column formulas jsonb not null default '[]';
