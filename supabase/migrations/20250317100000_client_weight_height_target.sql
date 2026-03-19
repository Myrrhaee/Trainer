-- Поля антропометрии: weight, height, target_weight (Supabase SQL Editor при необходимости)
alter table public.profiles
  add column if not exists weight numeric;

alter table public.profiles
  add column if not exists height numeric;

alter table public.profiles
  add column if not exists target_weight numeric;
