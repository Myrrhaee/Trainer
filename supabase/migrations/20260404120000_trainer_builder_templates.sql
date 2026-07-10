create table if not exists public.trainer_builder_templates (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  training_type text not null default 'Силовая тренировка',
  note text not null default '',
  exercises jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists trainer_builder_templates_trainer_idx
  on public.trainer_builder_templates (trainer_id, updated_at desc);

create or replace function public.set_trainer_builder_templates_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trainer_builder_templates_set_updated_at on public.trainer_builder_templates;

create trigger trainer_builder_templates_set_updated_at
before update on public.trainer_builder_templates
for each row
execute function public.set_trainer_builder_templates_updated_at();

alter table public.trainer_builder_templates enable row level security;

drop policy if exists "trainer_builder_templates_select_own" on public.trainer_builder_templates;
create policy "trainer_builder_templates_select_own"
on public.trainer_builder_templates
for select
to authenticated
using (trainer_id = auth.uid());

drop policy if exists "trainer_builder_templates_insert_own" on public.trainer_builder_templates;
create policy "trainer_builder_templates_insert_own"
on public.trainer_builder_templates
for insert
to authenticated
with check (trainer_id = auth.uid());

drop policy if exists "trainer_builder_templates_update_own" on public.trainer_builder_templates;
create policy "trainer_builder_templates_update_own"
on public.trainer_builder_templates
for update
to authenticated
using (trainer_id = auth.uid())
with check (trainer_id = auth.uid());

drop policy if exists "trainer_builder_templates_delete_own" on public.trainer_builder_templates;
create policy "trainer_builder_templates_delete_own"
on public.trainer_builder_templates
for delete
to authenticated
using (trainer_id = auth.uid());
