create table if not exists public.personal_terms (
  user_id uuid not null references auth.users (id) on delete cascade,
  term_id text not null,
  term_data jsonb not null check (jsonb_typeof(term_data) = 'object'),
  updated_at timestamptz not null default now(),
  primary key (user_id, term_id)
);

create table if not exists public.saved_answers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  question text not null check (char_length(question) between 1 and 2000),
  summary text not null check (char_length(summary) <= 2000),
  created_at timestamptz not null default now(),
  unique (user_id, question)
);

alter table public.personal_terms enable row level security;
alter table public.saved_answers enable row level security;

drop policy if exists "Users can read their own personal terms" on public.personal_terms;
create policy "Users can read their own personal terms"
  on public.personal_terms for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their own personal terms" on public.personal_terms;
create policy "Users can create their own personal terms"
  on public.personal_terms for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own personal terms" on public.personal_terms;
create policy "Users can update their own personal terms"
  on public.personal_terms for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own personal terms" on public.personal_terms;
create policy "Users can delete their own personal terms"
  on public.personal_terms for delete to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can read their own saved answers" on public.saved_answers;
create policy "Users can read their own saved answers"
  on public.saved_answers for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their own saved answers" on public.saved_answers;
create policy "Users can create their own saved answers"
  on public.saved_answers for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own saved answers" on public.saved_answers;
create policy "Users can delete their own saved answers"
  on public.saved_answers for delete to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.personal_terms to authenticated;
grant select, insert, delete on public.saved_answers to authenticated;
