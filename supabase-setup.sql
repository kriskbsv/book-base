-- ============================================================
-- BOOK BASE — миграция под новые функции
-- Запусти это в Supabase → SQL Editor (после Resume проекта).
-- ============================================================

-- 1) Оценка книги (звёзды) — нужна для «книжной полки» в профиле
alter table public.attendance
  add column if not exists rating smallint
  check (rating between 1 and 5);


-- ============================================================
-- 2) RLS-политики (выполняй только если у тебя включён Row Level
--    Security и приложение жалуется, что данные не читаются/не
--    сохраняются). Это разрешает анонимному ключу то, что и так
--    делает приложение. Для маленького закрытого клуба ок;
--    если клуб вырастет — стоит сузить правила.
-- ============================================================

-- читать всем (участники, встречи, посещения, цитаты, лента)
do $$
begin
  -- USERS
  if not exists (select 1 from pg_policies where tablename='users' and policyname='anon read users') then
    create policy "anon read users"  on public.users      for select to anon using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='users' and policyname='anon write users') then
    create policy "anon write users" on public.users      for insert to anon with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='users' and policyname='anon update users') then
    create policy "anon update users" on public.users     for update to anon using (true) with check (true);
  end if;

  -- MEETINGS
  if not exists (select 1 from pg_policies where tablename='meetings' and policyname='anon read meetings') then
    create policy "anon read meetings" on public.meetings for select to anon using (true);
  end if;

  -- ATTENDANCE (запись на встречу + оценка)
  if not exists (select 1 from pg_policies where tablename='attendance' and policyname='anon read attendance') then
    create policy "anon read attendance"   on public.attendance for select to anon using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='attendance' and policyname='anon insert attendance') then
    create policy "anon insert attendance" on public.attendance for insert to anon with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='attendance' and policyname='anon update attendance') then
    create policy "anon update attendance" on public.attendance for update to anon using (true) with check (true);
  end if;

  -- QUOTES (цитаты + лента на главной)
  if not exists (select 1 from pg_policies where tablename='quotes' and policyname='anon read quotes') then
    create policy "anon read quotes"   on public.quotes for select to anon using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='quotes' and policyname='anon insert quotes') then
    create policy "anon insert quotes" on public.quotes for insert to anon with check (true);
  end if;
end $$;
