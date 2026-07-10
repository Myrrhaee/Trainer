create table if not exists public.exercise_library (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  muscle_group text not null default 'Общее',
  equipment text,
  difficulty text,
  description text,
  video_url text,
  is_system boolean not null default false,
  owner_user_id uuid references public.profiles(id) on delete cascade,
  source_exercise_id uuid references public.exercise_library(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint exercise_library_owner_check check (
    (is_system = true and owner_user_id is null)
    or
    (is_system = false and owner_user_id is not null)
  )
);

create index if not exists exercise_library_owner_idx
  on public.exercise_library (owner_user_id);

create index if not exists exercise_library_system_idx
  on public.exercise_library (is_system, title);

create index if not exists exercise_library_source_idx
  on public.exercise_library (source_exercise_id);

create or replace function public.set_exercise_library_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists exercise_library_set_updated_at on public.exercise_library;

create trigger exercise_library_set_updated_at
before update on public.exercise_library
for each row
execute function public.set_exercise_library_updated_at();

alter table public.exercise_library enable row level security;

drop policy if exists "exercise_library_select_visible" on public.exercise_library;
create policy "exercise_library_select_visible"
on public.exercise_library
for select
to authenticated
using (is_system = true or owner_user_id = auth.uid());

drop policy if exists "exercise_library_insert_owned" on public.exercise_library;
create policy "exercise_library_insert_owned"
on public.exercise_library
for insert
to authenticated
with check (is_system = false and owner_user_id = auth.uid());

drop policy if exists "exercise_library_update_owned" on public.exercise_library;
create policy "exercise_library_update_owned"
on public.exercise_library
for update
to authenticated
using (is_system = false and owner_user_id = auth.uid())
with check (is_system = false and owner_user_id = auth.uid());

drop policy if exists "exercise_library_delete_owned" on public.exercise_library;
create policy "exercise_library_delete_owned"
on public.exercise_library
for delete
to authenticated
using (is_system = false and owner_user_id = auth.uid());

insert into public.exercise_library (
  title,
  muscle_group,
  equipment,
  difficulty,
  description,
  video_url,
  is_system
)
select seed.title, seed.muscle_group, seed.equipment, seed.difficulty, seed.description, seed.video_url, true
from (
  values
    ('Жим штанги лёжа', 'Грудь', 'Штанга', 'Средняя', 'Базовое упражнение на грудь с акцентом на контроль лопаток и траектории.', null),
    ('Подтягивания широким хватом', 'Спина', 'Турник', 'Средняя', 'Вертикальная тяга с акцентом на широчайшие и стабильный корпус.', null),
    ('Приседания со штангой', 'Ноги', 'Штанга', 'Средняя', 'Базовое упражнение для ног и ягодиц с контролем глубины и корпуса.', null),
    ('Жим гантелей сидя', 'Плечи', 'Гантели', 'Средняя', 'Жим на передний и средний пучок дельт с контролем амплитуды.', null),
    ('Сгибание рук со штангой', 'Руки', 'Штанга', 'Лёгкая', 'Базовое упражнение на бицепс без раскачки корпусом.', null),
    ('Разгибание рук на блоке', 'Руки', 'Блок', 'Лёгкая', 'Изолирующее упражнение на трицепс с фиксацией локтей.', null),
    ('Планка', 'Кора', 'Без оборудования', 'Лёгкая', 'Статическое упражнение на стабилизацию корпуса и контроль таза.', null),
    ('Румынская тяга', 'Ноги', 'Штанга', 'Средняя', 'Упражнение на заднюю поверхность бедра и ягодицы с нейтральной спиной.', null)
) as seed(title, muscle_group, equipment, difficulty, description, video_url)
where not exists (
  select 1
  from public.exercise_library existing
  where existing.is_system = true
    and existing.title = seed.title
);

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'exercises'
  ) then
    execute $legacy$
      insert into public.exercise_library (
        title,
        muscle_group,
        equipment,
        difficulty,
        description,
        video_url,
        is_system,
        owner_user_id,
        created_at,
        updated_at
      )
      select
        e.title,
        coalesce(e.muscle_group, 'Общее'),
        null,
        null,
        e.description,
        e.video_url,
        false,
        e.trainer_id,
        coalesce(e.created_at, now()),
        coalesce(e.created_at, now())
      from public.exercises e
      where e.trainer_id is not null
        and not exists (
          select 1
          from public.exercise_library lib
          where lib.is_system = false
            and lib.owner_user_id = e.trainer_id
            and lib.title = e.title
            and coalesce(lib.muscle_group, '') = coalesce(e.muscle_group, '')
        )
    $legacy$;
  end if;
end;
$$;

create or replace function public.copy_system_exercise_to_my_library(id uuid)
returns public.exercise_library
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  source_row public.exercise_library;
  inserted_row public.exercise_library;
begin
  current_user_id := auth.uid();

  if current_user_id is null then
    raise exception 'Требуется авторизация';
  end if;

  select *
  into source_row
  from public.exercise_library
  where exercise_library.id = copy_system_exercise_to_my_library.id
    and exercise_library.is_system = true;

  if not found then
    raise exception 'Системное упражнение не найдено';
  end if;

  insert into public.exercise_library (
    title,
    muscle_group,
    equipment,
    difficulty,
    description,
    video_url,
    is_system,
    owner_user_id,
    source_exercise_id
  )
  values (
    source_row.title,
    source_row.muscle_group,
    source_row.equipment,
    source_row.difficulty,
    source_row.description,
    source_row.video_url,
    false,
    current_user_id,
    source_row.id
  )
  returning *
  into inserted_row;

  return inserted_row;
end;
$$;

revoke all on function public.copy_system_exercise_to_my_library(uuid) from public;
grant execute on function public.copy_system_exercise_to_my_library(uuid) to authenticated;
