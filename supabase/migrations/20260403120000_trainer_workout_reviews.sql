create table if not exists public.trainer_workout_reviews (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.profiles(id) on delete cascade,
  client_id uuid not null references public.profiles(id) on delete cascade,
  workout_date date not null,
  status text not null default 'needs_review',
  comment text not null default '',
  reviewed_at timestamptz,
  client_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trainer_workout_reviews_status_check check (status in ('needs_review', 'reviewed')),
  constraint trainer_workout_reviews_unique_day unique (trainer_id, client_id, workout_date)
);

alter table public.trainer_workout_reviews
  add column if not exists client_seen_at timestamptz;

create index if not exists trainer_workout_reviews_trainer_idx
  on public.trainer_workout_reviews (trainer_id, workout_date desc);

create index if not exists trainer_workout_reviews_client_idx
  on public.trainer_workout_reviews (client_id, workout_date desc);

create or replace function public.set_trainer_workout_reviews_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trainer_workout_reviews_set_updated_at on public.trainer_workout_reviews;

create trigger trainer_workout_reviews_set_updated_at
before update on public.trainer_workout_reviews
for each row
execute function public.set_trainer_workout_reviews_updated_at();

alter table public.trainer_workout_reviews enable row level security;

drop policy if exists "trainer_workout_reviews_select_own" on public.trainer_workout_reviews;
drop policy if exists "trainer_workout_reviews_select_visible" on public.trainer_workout_reviews;
create policy "trainer_workout_reviews_select_visible"
on public.trainer_workout_reviews
for select
to authenticated
using (
  trainer_id = auth.uid()
  or (
    client_id = auth.uid()
    and status = 'reviewed'
  )
);

drop policy if exists "trainer_workout_reviews_insert_own_client" on public.trainer_workout_reviews;
create policy "trainer_workout_reviews_insert_own_client"
on public.trainer_workout_reviews
for insert
to authenticated
with check (
  trainer_id = auth.uid()
  and exists (
    select 1
    from public.profiles client_profile
    where client_profile.id = trainer_workout_reviews.client_id
      and client_profile.trainer_id = auth.uid()
  )
);

drop policy if exists "trainer_workout_reviews_update_own_client" on public.trainer_workout_reviews;
create policy "trainer_workout_reviews_update_own_client"
on public.trainer_workout_reviews
for update
to authenticated
using (trainer_id = auth.uid())
with check (
  trainer_id = auth.uid()
  and exists (
    select 1
    from public.profiles client_profile
    where client_profile.id = trainer_workout_reviews.client_id
      and client_profile.trainer_id = auth.uid()
  )
);

drop policy if exists "trainer_workout_reviews_delete_own" on public.trainer_workout_reviews;
create policy "trainer_workout_reviews_delete_own"
on public.trainer_workout_reviews
for delete
to authenticated
using (trainer_id = auth.uid());

create or replace function public.mark_trainer_workout_review_seen(workout_date date)
returns public.trainer_workout_reviews
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  updated_row public.trainer_workout_reviews;
begin
  current_user_id := auth.uid();

  if current_user_id is null then
    raise exception 'Требуется авторизация';
  end if;

  update public.trainer_workout_reviews review
  set client_seen_at = coalesce(review.client_seen_at, now())
  where review.client_id = current_user_id
    and review.workout_date = mark_trainer_workout_review_seen.workout_date
    and review.status = 'reviewed'
  returning *
  into updated_row;

  if not found then
    raise exception 'Разбор не найден';
  end if;

  return updated_row;
end;
$$;

revoke all on function public.mark_trainer_workout_review_seen(date) from public;
grant execute on function public.mark_trainer_workout_review_seen(date) to authenticated;
