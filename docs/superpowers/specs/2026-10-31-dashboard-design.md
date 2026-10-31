# Dashboard (tela inicial) — design

## Objetivo

Uma tela inicial que mostra o que importa na semana — jogo de hoje, próximo jogo (lista),
pódio, último jogo — e dá atalho para todos os menus.

## Rotas e menu

- `/` passa a ser o dashboard ("Início").
- O sorteio atual (`src/app/page.tsx`) é movido sem mudanças de comportamento para
  `/sorteio` (`src/app/sorteio/page.tsx`).
- Menu (`NavBar`, topo e rodapé), nesta ordem: 🏠 Início `/`, 🎲 Sorteio `/sorteio`,
  📋 Listas `/listas`, 🏆 Ranking `/ranking`, 🗓️ Histórico `/historico`. Jogadores sai do
  menu; `/jogadores` continua existindo e é acessado pelo atalho do dashboard.
- Links internos que apontam para o sorteio passam a usar `/sorteio`.

## Regra: o dashboard só lê

O sorteio cria o `game_day` de hoje ao abrir. O dashboard nunca insere nem altera nada —
abrir o app num dia sem jogo não cria "dia jogado".

## Cards (de cima para baixo)

1. **Jogo de hoje** — só aparece se existir `game_day` com `date = hoje`. Com várias
   sessões, usa a de maior `session_number`. Mostra: nº de presentes (`attendance`),
   nº de sets (`rounds`), selo "Em andamento" / "Encerrado" (`finished`), "Jogo N do dia"
   quando `session_number > 1`, botão "Ir para o sorteio" (`/sorteio`).
2. **Próximo jogo** — a lista com `closed = false` e `date >= hoje`, menor `date`
   (empate: mais antiga `created_at`). Mostra título, data (`formatDate`), nº de
   confirmados, botões "Copiar para o WhatsApp" (mesmo texto de `/listas`, via
   `buildListText`, com feedback "✓ Copiado!") e "Abrir lista" (`/lista/<id>`).
   Sem lista: "Nenhuma lista aberta" + botão "Criar lista" (`/listas`).
3. **Pódio** — top 3 posições do ranking geral (posições compartilhadas em empate, via
   `withPositions`; mostra todos os jogadores com posição ≤ 3) com medalhas 🥇🥈🥉 e
   nº de vitórias; link "Ver ranking completo" (`/ranking`). Sem vitórias: "Nenhuma
   vitória registrada ainda."
4. **Último jogo** — o `game_day` mais recente (date desc, session_number desc) com pelo
   menos um set com vencedor. Mostra a data (`formatDate`, com "_N" para sessão > 1 como no
   histórico) e quem mais venceu naquele dia (todos os empatados no topo, "N vitórias");
   link "Ver histórico" (`/historico`). Sem nenhum: card oculto.
5. **Atalhos** — grade de botões: Sorteio, Listas, Jogadores, Ranking, Histórico.

Carregando: esqueleto animado (`animate-pulse`) como nas outras telas. Erros do Supabase:
caixa vermelha padrão.

## Contagem de vitórias compartilhada

A contagem hoje vive dentro de `ranking/page.tsx`. Extrair para `src/lib/ranking.ts`:

```ts
export interface WinRow {
  team: "A" | "B" | "BENCH";
  players: { id: string; name: string } | null;
  rounds: { winner: "A" | "B" | null; game_day_id: string } | null;
}

// gameDayIds: conta só esses dias; omitido = todos
export function rankPlayers(rows: WinRow[], gameDayIds?: Set<string>):
  { id: string; name: string; wins: number; position: number }[]
```

Ordenado por vitórias desc, com `position` de `withPositions`. Usado por `/ranking` e pelo
pódio do dashboard. Teste em `src/lib/ranking.test.ts`.

## Correção: ranking "Hoje" com vários jogos no dia

`/ranking` busca o dia de hoje com `.maybeSingle()`, que falha quando há mais de uma
sessão na data — a aba "Hoje" fica vazia. Passa a buscar todos os `game_days` de hoje e
contar vitórias de todas as sessões do dia (`rankPlayers(rows, todayIds)`).

## Testes

- `rankPlayers`: contagem só de quem estava no time vencedor, ignora banco e sets sem
  vencedor, filtro por dias, posições com empate.
- Telas verificadas rodando o app (`bun dev`).
