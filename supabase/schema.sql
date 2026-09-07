-- Sorteio de Times de Vôlei — schema Supabase/Postgres
-- Rodar no SQL Editor do projeto Supabase.

create table players (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  gender text not null check (gender in ('M','F')),
  created_at timestamptz not null default now()
);

create table game_days (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  created_at timestamptz not null default now()
);

create table attendance (
  game_day_id uuid not null references game_days(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  primary key (game_day_id, player_id)
);

create table rounds (
  id uuid primary key default gen_random_uuid(),
  game_day_id uuid not null references game_days(id) on delete cascade,
  round_number int not null,
  winner text check (winner in ('A','B')),
  created_at timestamptz not null default now()
);

create table round_players (
  round_id uuid not null references rounds(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  team text not null check (team in ('A','B','BENCH')),
  primary key (round_id, player_id)
);

-- App sem login: RLS habilitado com policies públicas (qualquer um com a
-- anon key, ou seja, qualquer um com o link do app, lê e escreve).
alter table players enable row level security;
alter table game_days enable row level security;
alter table attendance enable row level security;
alter table rounds enable row level security;
alter table round_players enable row level security;

create policy "public full access" on players for all using (true) with check (true);
create policy "public full access" on game_days for all using (true) with check (true);
create policy "public full access" on attendance for all using (true) with check (true);
create policy "public full access" on rounds for all using (true) with check (true);
create policy "public full access" on round_players for all using (true) with check (true);
