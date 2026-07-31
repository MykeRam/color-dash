begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.color_dash_name_is_allowed(p_name text)
returns boolean
language sql
immutable
parallel safe
security invoker
set search_path = ''
as $$
  with blocked(term) as (
    values
      ('ass'),
      ('asshole'),
      ('asswipe'),
      ('bastard'),
      ('bitch'),
      ('blowjob'),
      ('bullshit'),
      ('chink'),
      ('cock'),
      ('cocksucker'),
      ('cunt'),
      ('dick'),
      ('dickhead'),
      ('douche'),
      ('douchebag'),
      ('dumbass'),
      ('fag'),
      ('faggot'),
      ('fuck'),
      ('fucker'),
      ('fucking'),
      ('fuckoff'),
      ('fuckyou'),
      ('gook'),
      ('handjob'),
      ('hitler'),
      ('idiot'),
      ('imbecile'),
      ('jackass'),
      ('kike'),
      ('kkk'),
      ('loser'),
      ('moron'),
      ('motherfucker'),
      ('motherfucking'),
      ('nazi'),
      ('nigga'),
      ('nigger'),
      ('penis'),
      ('porn'),
      ('porno'),
      ('prick'),
      ('pussy'),
      ('rape'),
      ('rapist'),
      ('retard'),
      ('retarded'),
      ('rimjob'),
      ('scumbag'),
      ('shit'),
      ('shithead'),
      ('shitty'),
      ('slut'),
      ('spic'),
      ('stupid'),
      ('tranny'),
      ('twat'),
      ('vagina'),
      ('wanker'),
      ('wetback'),
      ('whore')
  ),
  normalized(value) as (
    select translate(
      translate(
        lower(p_name),
        'áàâäãåéèêëíìîïóòôöõúùûüñç',
        'aaaaaaeeeeiiiiooooouuuunc'
      ),
      '01345789@$!',
      'oieastbgsai'
    )
  ),
  candidates(value) as (
    select word
    from normalized,
      lateral regexp_split_to_table(normalized.value, '[^a-z0-9]+') as word
    where word <> ''

    union

    select regexp_replace(value, '[^a-z0-9]', '', 'g')
    from normalized
  ),
  candidate_forms(value) as (
    select value
    from candidates

    union

    select regexp_replace(value, '(.)\1+', '\1', 'g')
    from candidates
    where char_length(value) >= 4
  ),
  blocked_forms(value) as (
    select term
    from blocked

    union

    select regexp_replace(term, '(.)\1+', '\1', 'g')
    from blocked
    where char_length(term) >= 4
  )
  select not exists (
    select 1
    from candidate_forms
    join blocked_forms using (value)
  );
$$;

revoke execute on function private.color_dash_name_is_allowed(text)
  from public, anon, authenticated;

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

  if not private.color_dash_name_is_allowed(v_player_name) then
    raise exception 'Please choose a different player name.'
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

commit;
