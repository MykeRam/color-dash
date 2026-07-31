begin;

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
      ('idiot'),
      ('imbecile'),
      ('jackass'),
      ('kike'),
      ('loser'),
      ('moron'),
      ('motherfucker'),
      ('motherfucking'),
      ('nigga'),
      ('nigger'),
      ('prick'),
      ('pussy'),
      ('retard'),
      ('retarded'),
      ('scumbag'),
      ('shit'),
      ('shithead'),
      ('shitty'),
      ('slut'),
      ('spic'),
      ('stupid'),
      ('tranny'),
      ('twat'),
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

do $$
begin
  if not private.color_dash_name_is_allowed('Wifey') then
    raise exception 'The focused name filter must allow Wifey.';
  end if;

  if private.color_dash_name_is_allowed('Friendly Idiot') then
    raise exception 'The focused name filter must still reject direct insults.';
  end if;

  if private.color_dash_name_is_allowed('f.u.c.k') then
    raise exception 'The focused name filter must still reject obfuscated profanity.';
  end if;
end;
$$;

commit;
