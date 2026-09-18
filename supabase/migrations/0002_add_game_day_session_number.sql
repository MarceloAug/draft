-- Rodar no SQL Editor do projeto Supabase (banco já existente).
-- Permite mais de um "dia de jogo" na mesma data (ex: dois jogos no mesmo sábado).
alter table game_days add column if not exists session_number int not null default 1;
alter table game_days drop constraint if exists game_days_date_key;
alter table game_days
  add constraint game_days_date_session_key unique (date, session_number);
