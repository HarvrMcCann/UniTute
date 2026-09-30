-- UniTute phase 6: graded answers, mastery, and prepaid credits for AI features.
-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.

-- ---------------------------------------------------------------------------
-- Answers: a 0-1 score (partial credit), who marked it, and what was written
-- ---------------------------------------------------------------------------

alter table public.attempts
  add column score real check (score between 0 and 1),
  add column marked_by text not null default 'auto' check (marked_by in ('auto', 'self', 'ai')),
  add column response text check (char_length(response) <= 4000),   -- short answers only
  add column feedback text;                                           -- AI marker's comment

update public.attempts set score = case when correct then 1 else 0 end where score is null;
alter table public.attempts alter column score set not null;

-- "Has this question been answered in the last day?" (retries don't move mastery).
create index on public.attempts (user_id, question_id, answered_at desc);

-- ---------------------------------------------------------------------------
-- Credits (US dollars as the user sees them). Spent on AI marking now; the tutor,
-- interactive fixes and course changes later. Users can read their balance but
-- only the server (secret key) changes it, through adjust_credit.
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column credit_usd numeric(12, 6) not null default 0 check (credit_usd >= 0);

-- Users may still change their own name and theme, but not their balance.
revoke update on public.profiles from authenticated;
grant update (display_name, theme) on public.profiles to authenticated;

-- Every change to a balance, for a clear history (top-ups positive, spending negative).
create table public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  delta_usd numeric(12, 6) not null,
  reason text not null,
  created_at timestamptz not null default now()
);
create index on public.credit_ledger (user_id, created_at desc);

alter table public.credit_ledger enable row level security;
create policy "read own credit history" on public.credit_ledger for select to authenticated
  using (user_id = (select auth.uid()));
grant select on public.credit_ledger to authenticated;

-- Adds (positive) or spends (negative) credit. Spending never takes the balance below
-- zero: it charges what's left. Returns the new balance, or null if there's no profile.
create function public.adjust_credit(p_user uuid, p_delta numeric, p_reason text)
returns numeric
language plpgsql
security definer set search_path = ''
as $$
declare
  applied numeric;
  balance numeric;
begin
  select greatest(p_delta, -credit_usd) into applied from public.profiles where id = p_user for update;
  if applied is null then return null; end if;
  update public.profiles set credit_usd = credit_usd + applied where id = p_user returning credit_usd into balance;
  if applied <> 0 then
    insert into public.credit_ledger (user_id, delta_usd, reason) values (p_user, applied, p_reason);
  end if;
  return balance;
end;
$$;

revoke execute on function public.adjust_credit(uuid, numeric, text) from public, anon, authenticated;
grant execute on function public.adjust_credit(uuid, numeric, text) to service_role;
