-- UniTute phase 5: course generation progress and token logging.
-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.

-- Progress while generating ({"stage": "outline" | "lessons" | "saving", "done": n, "total": n})
-- and the reason if it failed.
alter table public.courses
  add column generation_progress jsonb,
  add column generation_error text;

-- One row per Claude call made while building a course (PLAN.md: log tokens per course).
create table public.generation_usage (
  id uuid primary key default gen_random_uuid(),
  course_id text not null references public.courses (id) on delete cascade,
  step text not null,                 -- "outline", "lesson l-...", ...
  model text not null,
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  cache_creation_input_tokens int not null default 0,
  cache_read_input_tokens int not null default 0,
  duration_ms int,
  created_at timestamptz not null default now()
);

create index on public.generation_usage (course_id, created_at);

-- Owners can see their own course's usage; only the server (secret key) writes it.
alter table public.generation_usage enable row level security;
create policy "read own course usage" on public.generation_usage for select to authenticated
  using (exists (select 1 from public.courses c where c.id = course_id and c.owner_id = (select auth.uid())));
grant select on public.generation_usage to authenticated;
