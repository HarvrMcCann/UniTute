-- UniTute: token usage for every Claude call a student pays for (tutor, AI marking, interactive
-- fixes), so we can see real costs and whether prompt caching is working.
-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- (Course generation keeps logging to generation_usage.)

create table public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  course_id text references public.courses (id) on delete set null,
  feature text not null check (feature in ('tutor', 'mark', 'fix')),
  model text not null,
  input_tokens int not null default 0,          -- uncached input
  output_tokens int not null default 0,         -- includes thinking
  cache_write_tokens int not null default 0,    -- all cache writes
  cache_write_1h_tokens int not null default 0, -- the part written to the 1-hour cache
  cache_read_tokens int not null default 0,
  api_cost_usd numeric(12, 6) not null default 0,
  charged_usd numeric(12, 6) not null default 0, -- what came off the student's credit
  duration_ms int,
  created_at timestamptz not null default now()
);
create index on public.ai_usage (user_id, created_at desc);
create index on public.ai_usage (created_at desc);

-- Students can see their own usage; only the server (secret key) writes it.
alter table public.ai_usage enable row level security;
create policy "read own ai usage" on public.ai_usage for select to authenticated using (user_id = (select auth.uid()));
grant select on public.ai_usage to authenticated;
