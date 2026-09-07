# Sorteio de Times de Vôlei — Design

## Objetivo
App web (mobile-first) pra time de vôlei amador (10-15 jogadores) sortear times
balanceados por gênero a cada set, controlando rodízio de banco e ranking de
vitórias. Deploy Vercel, banco Supabase (Postgres), sem autenticação.

## Stack
- Next.js (App Router, TypeScript)
- Supabase (Postgres + supabase-js, client-side, anon key)
- Tailwind CSS

## Schema (Supabase/Postgres)

```sql
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
```

RLS habilitado em todas, policy pública (select/insert/update/delete para
`anon`) — app sem login, proteção é só "não divulgar o link".

## Regra de divisão de times
Para N jogadores presentes:
- `teamSize = min(6, floor(N/2))`
- `bench = N - 2*teamSize`

Exemplos: N=10→5x5/0 banco; N=12→6x6/0; N=13→6x6/1; N=11→5x5/1; N=14→6x6/2;
N=16→6x6/4.

Dentro do time, mulheres distribuídas o mais igual possível entre A e B
(diferença máx. 1).

## Rodízio de banco (por dia)
Ao sortear, exclui do banco quem já descansou nesse `game_day` (consulta
`round_players` do dia com `team='BENCH'`), até todos os presentes já terem
passado — nesse ponto o ciclo reseta (ninguém excluído).

## Diversificação de times
Compara o novo split (conjunto de ids do time A) com o do round anterior do
mesmo dia; se idêntico, re-sorteia (até 20 tentativas, depois aceita).

## Páginas
- `/jogadores` — cadastro (nome + gênero), lista, exclusão.
- `/` — marcar presença do dia (cria/reusa `game_day` pela data de hoje),
  botão "Sortear", exibe Time A / Time B / Banco, botões "Time A venceu" /
  "Time B venceu" (grava em `rounds.winner`), botão "Novo set".
- `/ranking` — toggle "Hoje" / "Geral": contagem de vitórias por jogador via
  join `rounds` + `round_players` (filtrando por `game_day_id` ou não).

## Fora de escopo
- Login/autenticação
- Editar jogador depois de criado (só criar/excluir)
- Histórico de rounds anteriores em tela (só o round atual + ranking)
