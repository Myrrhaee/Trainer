-- Антропометрия клиента в profiles (выполните в Supabase SQL Editor, если миграции не применяются автоматически)
alter table public.profiles
  add column if not exists current_weight_kg numeric;

alter table public.profiles
  add column if not exists height_cm numeric;

alter table public.profiles
  add column if not exists target_weight_kg numeric;
