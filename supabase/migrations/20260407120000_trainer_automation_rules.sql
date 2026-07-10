create table if not exists public.trainer_automation_rules (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  trigger_key text not null,
  channel text not null check (channel in ('message', 'calendar', 'task')),
  delay_label text not null default 'сразу',
  status text not null default 'active' check (status in ('active', 'paused')),
  audience text not null default 'Все клиенты',
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  run_count integer not null default 0,
  success_rate integer not null default 100 check (success_rate between 0 and 100),
  last_run_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists trainer_automation_rules_trainer_idx
  on public.trainer_automation_rules (trainer_id, status, updated_at desc);

alter table public.trainer_automation_rules enable row level security;

drop policy if exists "Trainers can read own automation rules" on public.trainer_automation_rules;
create policy "Trainers can read own automation rules"
  on public.trainer_automation_rules
  for select
  using (trainer_id = auth.uid());

drop policy if exists "Trainers can create own automation rules" on public.trainer_automation_rules;
create policy "Trainers can create own automation rules"
  on public.trainer_automation_rules
  for insert
  with check (trainer_id = auth.uid());

drop policy if exists "Trainers can update own automation rules" on public.trainer_automation_rules;
create policy "Trainers can update own automation rules"
  on public.trainer_automation_rules
  for update
  using (trainer_id = auth.uid())
  with check (trainer_id = auth.uid());

drop policy if exists "Trainers can delete own automation rules" on public.trainer_automation_rules;
create policy "Trainers can delete own automation rules"
  on public.trainer_automation_rules
  for delete
  using (trainer_id = auth.uid());
