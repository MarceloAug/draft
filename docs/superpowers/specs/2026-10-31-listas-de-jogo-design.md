# Listas de jogo — design

## Problema

Toda semana o grupo monta no WhatsApp a lista de quem vai jogar (sábado, domingo ou ambos),
copiando e colando a mensagem. Fica desorganizado e, no dia, a presença do sorteio é marcada
à mão de novo.

## Objetivo

Um responsável cria a lista no app, cola o link no grupo, cada pessoa confirma pelo link e,
no dia, o sorteio carrega a lista para marcar a presença — mantendo os checkboxes editáveis
para desmarcar quem faltou.

Fora do escopo: pegar o nome/número do WhatsApp automaticamente (o WhatsApp não repassa
identidade ao abrir um link; um bot seria frágil e contra os termos), limite de vagas /
lista de espera, login. Dashboard fica para uma etapa posterior.

## Dados

Tabelas novas, independentes de `game_days` (uma lista não é um dia jogado e pode ser
reusada em mais de um jogo do mesmo dia):

```sql
create table game_lists (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  date date not null,
  closed boolean not null default false,
  created_at timestamptz not null default now()
);

create table game_list_entries (
  list_id uuid not null references game_lists(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (list_id, player_id)
);

alter table game_lists enable row level security;
alter table game_list_entries enable row level security;
create policy "public full access" on game_lists for all using (true) with check (true);
create policy "public full access" on game_list_entries for all using (true) with check (true);
```

- Migration nova em `supabase/migrations/0003_add_game_lists.sql`; `schema.sql` atualizado.
- Ordem da lista = `game_list_entries.created_at` ascendente.
- Jogadores vêm de `players`; quem se cadastra pelo link vira jogador normal.
- PK `(list_id, player_id)` impede nome duplicado na mesma lista.

## Telas

### `/listas` — gerenciar (nova aba no menu: 📋 Listas)

- "Nova lista": título (ex.: "Jogo domingo 01/11") + data.
- Listas ordenadas por data desc (depois `created_at` desc), com nº de confirmados e
  estado aberta/encerrada.
- Ao abrir uma lista:
  - confirmados numerados com ✕ para remover (só com a lista aberta);
  - "Copiar para o WhatsApp" — copia o texto abaixo para a área de transferência;
  - "Encerrar" / "Reabrir".

Texto copiado:

```
🏐 Jogo domingo 01/11
1. Rony
2. Joel

Confirme aqui: https://<host>/lista/<id>
```

### `/lista/[id]` — link público

- Cabeçalho com título, data e lista numerada dos confirmados.
- Identidade guardada em `localStorage` (`volei:playerId`), lida e escrita com try/catch;
  se indisponível, a pessoa só escolhe o nome toda vez.
- Sem identidade: "Quem é você?" — busca por nome entre os jogadores + "Não estou na lista,
  me cadastrar" (nome + gênero). A escolha é salva e já confirma a presença.
- Com identidade: "Oi, <nome> 👋" + botão "Confirmar presença" / "Sair da lista";
  link "não sou <nome>" limpa a identidade.
- "Adicionar outra pessoa": mesma busca/cadastro, adiciona sem salvar identidade.
- Qualquer um pode remover qualquer um da lista (✕ ao lado do nome).
- Lista encerrada: sem botões de edição, aviso "Lista encerrada".
- id inexistente: "Lista não encontrada".

### Sorteio (`/`) — seção "Presença de hoje"

- Select "Carregar lista…" com todas as listas (inclusive encerradas), data desc.
- Ao escolher: insere em `attendance` do jogo atual os jogadores da lista que ainda não estão
  marcados (soma, não substitui) e marca a lista como `closed = true`.
- Checkboxes seguem funcionando para desmarcar ausentes.
- Desabilitado quando o dia está encerrado (`gameDayFinished`), como os demais controles.

## Fechamento da lista

- Automático: ao ser carregada no sorteio.
- Manual: "Encerrar" / "Reabrir" em `/listas`.

## Erros

Erros do Supabase aparecem na caixa vermelha já usada em `/historico` e no sorteio.

## Testes

- `src/lib/listText.ts` — função pura que monta o texto do WhatsApp; teste em
  `src/lib/listText.test.ts` (bun).
- Demais fluxos verificados rodando o app (`bun dev`).
