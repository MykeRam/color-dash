begin;

-- Legacy rows predate anonymous player identities and cannot be assigned
-- reliably. The approved clean reset starts the identity-backed board empty.
delete from public.color_dash_scores
where user_id is null;

alter table public.color_dash_scores
  alter column user_id set not null;

drop index if exists public.color_dash_scores_user_id_key;

create unique index color_dash_scores_user_id_key
  on public.color_dash_scores (user_id);

create or replace function public.submit_color_dash_score(
  p_player_name text,
  p_score integer
)
returns table (
  saved boolean,
  best_score integer
)
language plpgsql
security definer
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
  on conflict (user_id)
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

revoke insert, update, delete
  on public.color_dash_scores
  from anon, authenticated;
grant select
  on public.color_dash_scores
  to anon, authenticated;

drop policy if exists "Legacy visitors can submit during rollout"
  on public.color_dash_scores;
drop policy if exists "Players can create their own score"
  on public.color_dash_scores;
drop policy if exists "Players can improve their own score"
  on public.color_dash_scores;

commit;
