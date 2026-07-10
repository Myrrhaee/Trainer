create table if not exists public.trainer_client_messages (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.profiles(id) on delete cascade,
  client_id uuid not null references public.profiles(id) on delete cascade,
  sender_role text not null check (sender_role in ('trainer', 'client')),
  body text not null,
  status text not null default 'sent' check (status in ('draft', 'sent', 'read')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists trainer_client_messages_thread_idx
  on public.trainer_client_messages (trainer_id, client_id, created_at desc);

create index if not exists trainer_client_messages_client_idx
  on public.trainer_client_messages (client_id, created_at desc);

alter table public.trainer_client_messages enable row level security;

drop policy if exists "Trainers can read own client messages" on public.trainer_client_messages;
create policy "Trainers can read own client messages"
  on public.trainer_client_messages
  for select
  using (trainer_id = auth.uid());

drop policy if exists "Clients can read own messages" on public.trainer_client_messages;
create policy "Clients can read own messages"
  on public.trainer_client_messages
  for select
  using (client_id = auth.uid());

drop policy if exists "Trainers can create own client messages" on public.trainer_client_messages;
create policy "Trainers can create own client messages"
  on public.trainer_client_messages
  for insert
  with check (trainer_id = auth.uid() and sender_role = 'trainer');

drop policy if exists "Clients can create own messages" on public.trainer_client_messages;
create policy "Clients can create own messages"
  on public.trainer_client_messages
  for insert
  with check (client_id = auth.uid() and sender_role = 'client');

drop policy if exists "Trainers can update own client messages" on public.trainer_client_messages;
create policy "Trainers can update own client messages"
  on public.trainer_client_messages
  for update
  using (trainer_id = auth.uid())
  with check (trainer_id = auth.uid());
