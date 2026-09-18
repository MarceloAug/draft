-- Rodar no SQL Editor do projeto Supabase (banco já existente).
alter table game_days add column if not exists finished boolean not null default false;
