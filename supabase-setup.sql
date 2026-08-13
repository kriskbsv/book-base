-- ============================================================
-- BOOK BASE — миграция под редизайн (админка + трекер подарков)
-- Запусти это в Supabase → SQL Editor.
-- Все команды идемпотентны (можно запускать повторно).
-- ============================================================

-- 1) Точные дата-время встречи — для живого обратного отсчёта на главной.
--    meeting_date / meeting_time остаются как текст для красивого показа.
alter table public.meetings
  add column if not exists meeting_at timestamptz;

-- 2) Место и описание встречи (если их ещё нет).
alter table public.meetings
  add column if not exists place text;
alter table public.meetings
  add column if not exists description text;

-- 3) Оценка книги (звёзды) — как в прошлой миграции.
alter table public.attendance
  add column if not exists rating smallint check (rating between 1 and 5);

-- 4) ТРЕКЕР ПОДАРКОВ.
--    Подарок даётся за каждые 5 посещённых встреч.
--    Заработано  = floor(посещено / 5)
--    Выдано      = gift_claimed_count  (админ жмёт «Выдать»)
--    Ожидает     = заработано - выдано
alter table public.users
  add column if not exists gift_claimed_count int not null default 0;


-- ============================================================
-- RLS-политики. Выполняй, только если включён Row Level Security
-- и приложение не может читать/писать. Разрешает анонимному ключу
-- то, что и так делает приложение (маленький закрытый клуб — ок).
-- ============================================================
do $$
begin
  -- USERS: читать, создавать, обновлять (в т.ч. gift_claimed_count)
  if not exists (select 1 from pg_policies where tablename='users' and policyname='anon read users') then
    create policy "anon read users"   on public.users    for select to anon using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='users' and policyname='anon write users') then
    create policy "anon write users"  on public.users    for insert to anon with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='users' and policyname='anon update users') then
    create policy "anon update users" on public.users    for update to anon using (true) with check (true);
  end if;

  -- MEETINGS: читать всем, создавать/обновлять (админ добавляет и завершает)
  if not exists (select 1 from pg_policies where tablename='meetings' and policyname='anon read meetings') then
    create policy "anon read meetings"   on public.meetings for select to anon using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='meetings' and policyname='anon insert meetings') then
    create policy "anon insert meetings" on public.meetings for insert to anon with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='meetings' and policyname='anon update meetings') then
    create policy "anon update meetings" on public.meetings for update to anon using (true) with check (true);
  end if;

  -- ATTENDANCE: запись на встречу + отметка присутствия
  if not exists (select 1 from pg_policies where tablename='attendance' and policyname='anon read attendance') then
    create policy "anon read attendance"   on public.attendance for select to anon using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='attendance' and policyname='anon insert attendance') then
    create policy "anon insert attendance" on public.attendance for insert to anon with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='attendance' and policyname='anon update attendance') then
    create policy "anon update attendance" on public.attendance for update to anon using (true) with check (true);
  end if;
end $$;
