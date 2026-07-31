alter table public.color_dash_scores
  add column if not exists user_id uuid references auth.users (id) on delete cascade,
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists color_dash_scores_user_id_key
  on public.color_dash_scores (user_id)
  where user_id is not null;

create or replace function public.protect_color_dash_high_score()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.user_id is distinct from old.user_id then
    raise exception 'A leaderboard score cannot change owners.'
      using errcode = '23514';
  end if;

  if new.score <= old.score then
    raise exception 'A new score must beat the saved high score.'
      using errcode = '23514';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

revoke execute on function public.protect_color_dash_high_score() from public;

drop trigger if exists protect_color_dash_high_score
  on public.color_dash_scores;

create trigger protect_color_dash_high_score
  before update on public.color_dash_scores
  for each row
  execute function public.protect_color_dash_high_score();

create or replace function public.submit_color_dash_score(
  p_player_name text,
  p_score integer
)
returns table (
  saved boolean,
  best_score integer
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_player_name text :=
    regexp_replace(btrim(p_player_name), '[[:space:]]+', ' ', 'g');
  v_best_score integer;
begin
  if v_user_id is null then
    raise exception 'An authenticated player session is required.'
      using errcode = '42501';
  end if;

  if v_player_name is null
    or char_length(v_player_name) not between 1 and 18 then
    raise exception 'Player names must contain 1 to 18 characters.'
      using errcode = '23514';
  end if;

  if p_score is null or p_score not between 1 and 10000 then
    raise exception 'Scores must be between 1 and 10000.'
      using errcode = '23514';
  end if;

  insert into public.color_dash_scores (
    user_id,
    player_name,
    score
  )
  values (
    v_user_id,
    v_player_name,
    p_score
  )
  on conflict (user_id) where user_id is not null
  do update
    set player_name = excluded.player_name,
        score = excluded.score
    where excluded.score > public.color_dash_scores.score
  returning score into v_best_score;

  if found then
    return query select true, v_best_score;
    return;
  end if;

  select color_dash_scores.score
    into v_best_score
    from public.color_dash_scores
    where color_dash_scores.user_id = v_user_id;

  return query select false, v_best_score;
end;
$$;

revoke execute on function public.submit_color_dash_score(text, integer)
  from public, anon;
grant execute on function public.submit_color_dash_score(text, integer)
  to authenticated;

revoke all on public.color_dash_scores from anon, authenticated;
grant select, insert on public.color_dash_scores to anon;
grant select, insert, update on public.color_dash_scores to authenticated;

drop policy if exists "Visitors can submit valid scores"
  on public.color_dash_scores;

create policy "Legacy visitors can submit during rollout"
  on public.color_dash_scores
  for insert
  to anon
  with check (
    user_id is null
    and player_name = btrim(player_name)
    and char_length(player_name) between 1 and 18
    and score between 1 and 10000
  );

drop policy if exists "Players can create their own score"
  on public.color_dash_scores;

create policy "Players can create their own score"
  on public.color_dash_scores
  for insert
  to authenticated
  with check (
    (select auth.uid()) is not null
    and (select auth.uid()) = user_id
  );

drop policy if exists "Players can improve their own score"
  on public.color_dash_scores;

create policy "Players can improve their own score"
  on public.color_dash_scores
  for update
  to authenticated
  using (
    (select auth.uid()) is not null
    and (select auth.uid()) = user_id
  )
  with check (
    (select auth.uid()) is not null
    and (select auth.uid()) = user_id
  );
