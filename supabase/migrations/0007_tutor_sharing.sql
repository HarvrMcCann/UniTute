-- UniTute phase 7: tutor chat context, share links and bug reports.
-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Safe to run while a course is generating (only adds things; generation doesn't use these).

-- ---------------------------------------------------------------------------
-- Share links: a signed-in user who opens /join/<share_token> becomes a member
-- and can study the course (their own progress, mastery and tutor chat).
-- Members are added by the server (secret key) after it checks the token.
-- ---------------------------------------------------------------------------

create table public.course_members (
  course_id text not null references public.courses (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (course_id, user_id)
);
create index on public.course_members (user_id);

alter table public.course_members enable row level security;
create policy "read own memberships" on public.course_members for select to authenticated
  using (user_id = (select auth.uid()));
create policy "owners read their course's members" on public.course_members for select to authenticated
  using (exists (select 1 from public.courses c where c.id = course_id and c.owner_id = (select auth.uid())));
grant select on public.course_members to authenticated;

-- Samples, your own courses, and courses you've joined.
create or replace function public.can_read_course(target_course_id text)
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select exists (
    select 1 from public.courses c
    where c.id = target_course_id
      and (
        c.is_sample
        or c.owner_id = (select auth.uid())
        or exists (select 1 from public.course_members m where m.course_id = c.id and m.user_id = (select auth.uid()))
      )
  );
$$;

drop policy "read sample or own courses" on public.courses;
create policy "read readable courses" on public.courses for select to anon, authenticated
  using (public.can_read_course(id));

-- ---------------------------------------------------------------------------
-- Tutor messages remember which lesson they were asked in, so links in old
-- answers can still jump to the right place.
-- ---------------------------------------------------------------------------

alter table public.tutor_messages add column lesson_key text;
alter table public.tutor_messages add constraint tutor_message_length check (char_length(content) <= 20000);

-- ---------------------------------------------------------------------------
-- Bug reports: the course owner can read the reports on their course.
-- ---------------------------------------------------------------------------

alter table public.bug_reports add column lesson_key text;
alter table public.bug_reports add constraint bug_report_length check (char_length(note) <= 2000);
drop policy "add own bug reports" on public.bug_reports;
create policy "add own bug reports" on public.bug_reports for insert to authenticated
  with check (user_id = (select auth.uid()) and public.can_read_course(course_id));
create policy "owners read their course's bug reports" on public.bug_reports for select to authenticated
  using (exists (select 1 from public.courses c where c.id = course_id and c.owner_id = (select auth.uid())));
