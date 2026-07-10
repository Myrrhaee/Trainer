create table if not exists public.trainer_client_reports (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.profiles(id) on delete cascade,
  client_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'draft' check (status in ('draft', 'ready', 'sent')),
  title text not null default 'Weekly review',
  period_label text not null,
  summary text not null,
  wins jsonb not null default '[]'::jsonb,
  risks jsonb not null default '[]'::jsonb,
  next_focus jsonb not null default '[]'::jsonb,
  metrics jsonb not null default '{}'::jsonb,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists trainer_client_reports_trainer_idx
  on public.trainer_client_reports (trainer_id, status, updated_at desc);

create index if not exists trainer_client_reports_client_idx
  on public.trainer_client_reports (client_id, updated_at desc);

alter table public.trainer_client_reports enable row level security;

drop policy if exists "Trainers can read own client reports" on public.trainer_client_reports;
create policy "Trainers can read own client reports"
  on public.trainer_client_reports
  for select
  using (trainer_id = auth.uid());

drop policy if exists "Clients can read own sent reports" on public.trainer_client_reports;
create policy "Clients can read own sent reports"
  on public.trainer_client_reports
  for select
  using (client_id = auth.uid() and status = 'sent');

drop policy if exists "Trainers can create own client reports" on public.trainer_client_reports;
create policy "Trainers can create own client reports"
  on public.trainer_client_reports
  for insert
  with check (trainer_id = auth.uid());

drop policy if exists "Trainers can update own client reports" on public.trainer_client_reports;
create policy "Trainers can update own client reports"
  on public.trainer_client_reports
  for update
  using (trainer_id = auth.uid())
  with check (trainer_id = auth.uid());

drop policy if exists "Trainers can delete own client reports" on public.trainer_client_reports;
create policy "Trainers can delete own client reports"
  on public.trainer_client_reports
  for delete
  using (trainer_id = auth.uid());
