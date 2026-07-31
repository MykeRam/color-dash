create table if not exists public.color_dash_scores (
  id uuid primary key default gen_random_uuid(),
  player_name text not null,
  score integer not null,
  created_at timestamptz not null default now(),
  constraint color_dash_scores_name_check check (
    player_name = btrim(player_name)
    and char_length(player_name) between 1 and 18
  ),
  constraint color_dash_scores_score_check check (score between 1 and 10000)
);

create index if not exists color_dash_scores_rank_idx
  on public.color_dash_scores (score desc, created_at asc);

alter table public.color_dash_scores enable row level security;

revoke all on public.color_dash_scores from anon, authenticated;
grant select, insert on public.color_dash_scores to anon, authenticated;

drop policy if exists "Public scores are readable"
  on public.color_dash_scores;

create policy "Public scores are readable"
  on public.color_dash_scores
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Visitors can submit valid scores"
  on public.color_dash_scores;

create policy "Visitors can submit valid scores"
  on public.color_dash_scores
  for insert
  to anon, authenticated
  with check (
    player_name = btrim(player_name)
    and char_length(player_name) between 1 and 18
    and score between 1 and 10000
  );
