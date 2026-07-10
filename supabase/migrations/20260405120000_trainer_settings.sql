create table if not exists public.trainer_settings (
  trainer_id uuid primary key references public.profiles(id) on delete cascade,
  profile jsonb not null default '{}'::jsonb,
  storefront jsonb not null default '{}'::jsonb,
  notifications jsonb not null default '{}'::jsonb,
  operations jsonb not null default '{}'::jsonb,
  security jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_trainer_settings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trainer_settings_updated_at on public.trainer_settings;
create trigger trainer_settings_updated_at
before update on public.trainer_settings
for each row
execute function public.set_trainer_settings_updated_at();

alter table public.trainer_settings enable row level security;

drop policy if exists "Trainers can read own settings" on public.trainer_settings;
create policy "Trainers can read own settings"
on public.trainer_settings
for select
using (trainer_id = auth.uid());

drop policy if exists "Trainers can insert own settings" on public.trainer_settings;
create policy "Trainers can insert own settings"
on public.trainer_settings
for insert
with check (trainer_id = auth.uid());

drop policy if exists "Trainers can update own settings" on public.trainer_settings;
create policy "Trainers can update own settings"
on public.trainer_settings
for update
using (trainer_id = auth.uid())
with check (trainer_id = auth.uid());
