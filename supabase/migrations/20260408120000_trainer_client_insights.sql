create table if not exists public.trainer_client_insights (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.profiles(id) on delete cascade,
  client_id uuid references public.profiles(id) on delete cascade,
  health_score integer not null check (health_score between 0 and 100),
  adherence_score integer not null check (adherence_score between 0 and 100),
  segment text not null check (segment in ('risk', 'growth', 'new')),
  tone text not null check (tone in ('risk', 'stable', 'growth')),
  driver text not null,
  recommended_action text not null,
  metrics jsonb not null default '{}'::jsonb,
  snapshot_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists trainer_client_insights_trainer_idx
  on public.trainer_client_insights (trainer_id, snapshot_at desc);

create index if not exists trainer_client_insights_client_idx
  on public.trainer_client_insights (client_id, snapshot_at desc);

alter table public.trainer_client_insights enable row level security;

drop policy if exists "Trainers can read own client insights" on public.trainer_client_insights;
create policy "Trainers can read own client insights"
  on public.trainer_client_insights
  for select
  using (trainer_id = auth.uid());

drop policy if exists "Trainers can create own client insights" on public.trainer_client_insights;
create policy "Trainers can create own client insights"
  on public.trainer_client_insights
  for insert
  with check (trainer_id = auth.uid());

drop policy if exists "Trainers can update own client insights" on public.trainer_client_insights;
create policy "Trainers can update own client insights"
  on public.trainer_client_insights
  for update
  using (trainer_id = auth.uid())
  with check (trainer_id = auth.uid());
