-- Rodar no SQL Editor do projeto Supabase (banco já existente).
-- Modo de jogo do dia: 6 = 6x6 (padrão), 5 = 5x5.
alter table game_days
  add column if not exists team_size int not null default 6 check (team_size in (5, 6));
