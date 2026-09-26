-- UniTute phase 3: all MVP tables, row level security, and the new-user profile trigger.
-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Safe to re-run only on an empty project (it creates, it doesn't alter).

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  theme text not null default 'dark' check (theme in ('dark', 'light')),
  created_at timestamptz not null default now()
);

-- A profile row appears automatically for every new account.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(new.email, '@', 1)
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Course content
-- Course-JSON ids (u-..., l-..., c-..., q-...) live in `key`, unique per course.
-- ---------------------------------------------------------------------------

create table public.courses (
  id text primary key default gen_random_uuid()::text,
  owner_id uuid references auth.users (id) on delete cascade,
  is_sample boolean not null default false,
  title text not null,
  summary text not null default '',
  university text,
  course_code text,
  year int,
  length_mode text not null default 'recommended' check (length_mode in ('cram', 'recommended', 'deep')),
  status text not null default 'draft' check (status in ('draft', 'extracting', 'generating', 'ready', 'failed')),
  share_token text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.source_files (
  id uuid primary key default gen_random_uuid(),
  course_id text not null references public.courses (id) on delete cascade,
  box text not null check (box in ('content', 'objectives')),
  week int,
  filename text not null,
  page_count int,
  storage_path text,
  extracted_text text,
  created_at timestamptz not null default now()
);

create table public.units (
  id uuid primary key default gen_random_uuid(),
  course_id text not null references public.courses (id) on delete cascade,
  key text not null,
  position int not null,
  title text not null,
  summary text not null default '',
  week int,
  unique (course_id, key)
);

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  course_id text not null references public.courses (id) on delete cascade,
  unit_id uuid not null references public.units (id) on delete cascade,
  key text not null,
  position int not null,
  title text not null,
  summary text not null default '',
  est_minutes int not null,
  blocks jsonb not null default '[]',
  unique (course_id, key)
);

create table public.concepts (
  id uuid primary key default gen_random_uuid(),
  course_id text not null references public.courses (id) on delete cascade,
  key text not null,
  name text not null,
  description text not null default '',
  unique (course_id, key)
);

create table public.lesson_concepts (
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  concept_id uuid not null references public.concepts (id) on delete cascade,
  position int not null default 0,
  primary key (lesson_id, concept_id)
);

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  course_id text not null references public.courses (id) on delete cascade,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  concept_id uuid not null references public.concepts (id) on delete cascade,
  key text not null,
  position int not null default 0,
  type text not null check (type in ('multipleChoice', 'shortAnswer', 'ordering')),
  prompt text not null,
  options jsonb,          -- multipleChoice: option strings; ordering: items in the correct order
  answer jsonb,           -- multipleChoice: {"index": n}; shortAnswer: {"modelAnswer", "markingGuide"}
  explanation text not null,
  unique (course_id, key)
);

-- ---------------------------------------------------------------------------
-- Per-user learning data
-- ---------------------------------------------------------------------------

create table public.attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  question_id uuid not null references public.questions (id) on delete cascade,
  correct boolean not null,
  answered_at timestamptz not null default now()
);

create table public.mastery (
  user_id uuid not null references auth.users (id) on delete cascade,
  concept_id uuid not null references public.concepts (id) on delete cascade,
  score real not null default 0 check (score between 0 and 1),
  attempts int not null default 0,
  user_override real check (user_override between 0 and 1),
  updated_at timestamptz not null default now(),
  primary key (user_id, concept_id)
);

create table public.lesson_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  course_id text not null references public.courses (id) on delete cascade,
  last_block_id text,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

create table public.tutor_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  course_id text not null references public.courses (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  anchor_block_id text,
  created_at timestamptz not null default now()
);

create table public.bug_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  course_id text references public.courses (id) on delete set null,
  block_id text,
  note text not null,
  created_at timestamptz not null default now()
);

create index on public.units (course_id, position);
create index on public.lessons (unit_id, position);
create index on public.questions (lesson_id);
create index on public.attempts (user_id, question_id);
create index on public.lesson_progress (user_id, course_id, updated_at desc);
create index on public.tutor_messages (user_id, course_id, created_at);

-- ---------------------------------------------------------------------------
-- Row level security
-- Content is written by the server with the secret key (which bypasses RLS);
-- browsers can only read what they're allowed to and write their own rows.
-- ---------------------------------------------------------------------------

create function public.can_read_course(target_course_id text)
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select exists (
    select 1 from public.courses c
    where c.id = target_course_id
      and (c.is_sample or c.owner_id = (select auth.uid()))
  );
$$;

alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.source_files enable row level security;
alter table public.units enable row level security;
alter table public.lessons enable row level security;
alter table public.concepts enable row level security;
alter table public.lesson_concepts enable row level security;
alter table public.questions enable row level security;
alter table public.attempts enable row level security;
alter table public.mastery enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.tutor_messages enable row level security;
alter table public.bug_reports enable row level security;

-- profiles: your own row only
create policy "read own profile" on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy "update own profile" on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- courses: samples are public; everything else belongs to its owner
create policy "read sample or own courses" on public.courses for select to anon, authenticated
  using (is_sample or owner_id = (select auth.uid()));
create policy "create own courses" on public.courses for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "update own courses" on public.courses for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "delete own courses" on public.courses for delete to authenticated using (owner_id = (select auth.uid()));

-- course content: readable when the course is
create policy "read units" on public.units for select to anon, authenticated using (public.can_read_course(course_id));
create policy "read lessons" on public.lessons for select to anon, authenticated using (public.can_read_course(course_id));
create policy "read concepts" on public.concepts for select to anon, authenticated using (public.can_read_course(course_id));
create policy "read questions" on public.questions for select to anon, authenticated using (public.can_read_course(course_id));
create policy "read lesson concepts" on public.lesson_concepts for select to anon, authenticated
  using (exists (select 1 from public.lessons l where l.id = lesson_id and public.can_read_course(l.course_id)));

-- source files: owner of the course only
create policy "manage own source files" on public.source_files for all to authenticated
  using (exists (select 1 from public.courses c where c.id = course_id and c.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.courses c where c.id = course_id and c.owner_id = (select auth.uid())));

-- per-user rows: your own only, and only for courses you can read
create policy "read own attempts" on public.attempts for select to authenticated using (user_id = (select auth.uid()));
create policy "add own attempts" on public.attempts for insert to authenticated with check (user_id = (select auth.uid()));

create policy "read own mastery" on public.mastery for select to authenticated using (user_id = (select auth.uid()));
create policy "add own mastery" on public.mastery for insert to authenticated with check (user_id = (select auth.uid()));
create policy "update own mastery" on public.mastery for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "read own progress" on public.lesson_progress for select to authenticated using (user_id = (select auth.uid()));
create policy "add own progress" on public.lesson_progress for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (
    select 1 from public.lessons l where l.id = lesson_id and l.course_id = lesson_progress.course_id and public.can_read_course(l.course_id)
  ));
create policy "update own progress" on public.lesson_progress for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and exists (
    select 1 from public.lessons l where l.id = lesson_id and l.course_id = lesson_progress.course_id and public.can_read_course(l.course_id)
  ));

create policy "read own tutor messages" on public.tutor_messages for select to authenticated using (user_id = (select auth.uid()));
create policy "add own tutor messages" on public.tutor_messages for insert to authenticated
  with check (user_id = (select auth.uid()) and public.can_read_course(course_id));

create policy "read own bug reports" on public.bug_reports for select to authenticated using (user_id = (select auth.uid()));
create policy "add own bug reports" on public.bug_reports for insert to authenticated with check (user_id = (select auth.uid()));

-- Explicit grants (RLS above still decides which rows)
grant select on public.courses, public.units, public.lessons, public.concepts, public.lesson_concepts, public.questions to anon, authenticated;
grant insert, update, delete on public.courses to authenticated;
grant select, insert, update, delete on public.source_files to authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert on public.attempts, public.tutor_messages, public.bug_reports to authenticated;
grant select, insert, update on public.mastery, public.lesson_progress to authenticated;
