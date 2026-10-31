-- Rodar no SQL Editor do projeto Supabase (banco já existente).
-- Listas de confirmação de presença para os jogos (link compartilhado no WhatsApp).
create table if not exists game_lists (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  date date not null,
  closed boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists game_list_entries (
  list_id uuid not null references game_lists(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (list_id, player_id)
);

alter table game_lists enable row level security;
alter table game_list_entries enable row level security;

create policy "public full access" on game_lists for all using (true) with check (true);
create policy "public full access" on game_list_entries for all using (true) with check (true);
