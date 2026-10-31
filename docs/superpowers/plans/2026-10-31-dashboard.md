# Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tela inicial com jogo de hoje, próximo jogo, pódio, último jogo e atalhos; sorteio movido para `/sorteio`; ranking corrigido (vários jogos no dia e limite de 1000 linhas).

**Architecture:** A contagem de vitórias sai de `ranking/page.tsx` para uma função pura (`rankPlayers`) e a busca de `round_players` vira paginada (`fetchWinRows`); ranking e dashboard usam as duas. O dashboard é um client component que só lê do Supabase. O sorteio é movido de arquivo sem mudança de comportamento.

**Tech Stack:** Next.js 16 (App Router, client components), React 19, Supabase JS v2, Tailwind v4, bun test.

**Spec:** `docs/superpowers/specs/2026-10-31-dashboard-design.md`

## Global Constraints

- O dashboard nunca insere nem altera dados.
- Menu, nesta ordem: 🏠 Início `/`, 🎲 Sorteio `/sorteio`, 📋 Listas `/listas`, 🏆 Ranking `/ranking`, 🗓️ Histórico `/historico`.
- Textos de UI em português, mesmo estilo visual (Tailwind) das páginas existentes.
- Erros do Supabase na caixa vermelha padrão: `rounded-xl border border-red-500/20 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-300`.
- Empates no ranking dividem a posição (`withPositions`, já existente em `src/lib/ranking.ts`).
- Sem dependências novas. Sem mudança de banco.
- Verificação ao fim de cada task: `bun test && bunx tsc --noEmit && bun run lint`.

## File Structure

- Modify `src/lib/ranking.ts` — tipos `WinRow`/`RankedPlayer` + `rankPlayers`.
- Modify `src/lib/ranking.test.ts` — testes de `rankPlayers`.
- Create `src/lib/winRows.ts` — `fetchWinRows` paginado.
- Modify `src/app/ranking/page.tsx` — usar `rankPlayers`/`fetchWinRows`, "Hoje" com todas as sessões, caixa de erro.
- Modify `src/lib/date.ts` — `formatSession`.
- Modify `src/app/historico/page.tsx` — usar `formatSession`.
- Move `src/app/page.tsx` → `src/app/sorteio/page.tsx` (sem edição).
- Modify `src/components/NavBar.tsx` — novo menu.
- Create `src/app/page.tsx` — dashboard.

---

### Task 1: Ranking compartilhado e corrigido

**Files:**
- Modify: `src/lib/ranking.ts`
- Test: `src/lib/ranking.test.ts`
- Create: `src/lib/winRows.ts`
- Modify: `src/app/ranking/page.tsx`

**Interfaces:**
- Produces (em `@/lib/ranking`):
  - `interface WinRow { team: "A" | "B" | "BENCH"; players: { id: string; name: string } | null; rounds: { winner: "A" | "B" | null; game_day_id: string } | null }`
  - `interface RankedPlayer { id: string; name: string; wins: number; position: number }`
  - `rankPlayers(rows: WinRow[], gameDayIds?: Set<string>): RankedPlayer[]`
- Produces (em `@/lib/winRows`): `fetchWinRows(): Promise<{ rows: WinRow[]; error: string | null }>`

- [ ] **Step 1: Testes de `rankPlayers` (falhando)**

Adicionar ao fim de `src/lib/ranking.test.ts` (e trocar o import para `import { rankPlayers, withPositions, type WinRow } from "./ranking";`):

```ts
const row = (
  playerId: string,
  team: "A" | "B" | "BENCH",
  winner: "A" | "B" | null,
  dayId = "d1"
): WinRow => ({
  team,
  players: { id: playerId, name: playerId.toUpperCase() },
  rounds: { winner, game_day_id: dayId },
});

test("counts only players on the winning team", () => {
  const ranked = rankPlayers([
    row("ana", "A", "A"),
    row("bia", "B", "A"),
    row("caio", "BENCH", "A"),
    row("ana", "A", null),
    row("ana", "A", "A"),
  ]);
  expect(ranked).toEqual([{ id: "ana", name: "ANA", wins: 2, position: 1 }]);
});

test("filters by game days and shares positions on ties", () => {
  const rows = [
    row("ana", "A", "A", "d1"),
    row("bia", "A", "A", "d1"),
    row("caio", "B", "B", "d2"),
    row("caio", "B", "B", "d2"),
  ];
  expect(rankPlayers(rows, new Set(["d1"])).map((r) => [r.id, r.position])).toEqual([
    ["ana", 1],
    ["bia", 1],
  ]);
  expect(rankPlayers(rows).map((r) => [r.id, r.wins, r.position])).toEqual([
    ["caio", 2, 1],
    ["ana", 1, 2],
    ["bia", 1, 2],
  ]);
});

test("skips rows without player or round", () => {
  expect(
    rankPlayers([{ team: "A", players: null, rounds: { winner: "A", game_day_id: "d1" } }, { team: "A", players: { id: "x", name: "X" }, rounds: null }])
  ).toEqual([]);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `bun test src/lib/ranking.test.ts`
Expected: FAIL — `rankPlayers` não exportado.

- [ ] **Step 3: Implementar `rankPlayers`**

Adicionar a `src/lib/ranking.ts` (mantendo `withPositions`):

```ts
export interface WinRow {
  team: "A" | "B" | "BENCH";
  players: { id: string; name: string } | null;
  rounds: { winner: "A" | "B" | null; game_day_id: string } | null;
}

export interface RankedPlayer {
  id: string;
  name: string;
  wins: number;
  position: number;
}

// gameDayIds: count only those days; omitted = every day
export function rankPlayers(rows: WinRow[], gameDayIds?: Set<string>): RankedPlayer[] {
  const wins = new Map<string, { id: string; name: string; wins: number }>();
  for (const row of rows) {
    if (!row.players || !row.rounds || !row.rounds.winner) continue;
    if (row.team !== row.rounds.winner) continue;
    if (gameDayIds && !gameDayIds.has(row.rounds.game_day_id)) continue;
    const entry = wins.get(row.players.id) ?? {
      id: row.players.id,
      name: row.players.name,
      wins: 0,
    };
    entry.wins += 1;
    wins.set(row.players.id, entry);
  }
  return withPositions([...wins.values()].sort((a, b) => b.wins - a.wins));
}
```

Note: `Array.prototype.sort` é estável, então empatados mantêm a ordem de primeira aparição — o teste de "filters by game days" depende disso.

- [ ] **Step 4: Rodar e ver passar**

Run: `bun test src/lib/ranking.test.ts`
Expected: PASS (4 testes).

- [ ] **Step 5: `fetchWinRows` paginado**

`src/lib/winRows.ts`:

```ts
import { supabase } from "./supabaseClient";
import type { WinRow } from "./ranking";

// PostgREST silently caps a response at 1000 rows, so page through round_players
const PAGE_SIZE = 1000;

export async function fetchWinRows(): Promise<{ rows: WinRow[]; error: string | null }> {
  const rows: WinRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("round_players")
      .select("team, players(id, name), rounds(winner, game_day_id)")
      .order("round_id")
      .order("player_id")
      .range(from, from + PAGE_SIZE - 1);
    if (error) return { rows, error: error.message };
    rows.push(...((data as unknown as WinRow[]) ?? []));
    if (!data || data.length < PAGE_SIZE) return { rows, error: null };
  }
}
```

- [ ] **Step 6: Ranking page**

Em `src/app/ranking/page.tsx`:

1. Imports viram:

```ts
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { todayStr } from "@/lib/date";
import { rankPlayers, type WinRow } from "@/lib/ranking";
import { fetchWinRows } from "@/lib/winRows";
```

2. Apagar a `interface WinRow` local.

3. Estado, `load` e `ranking` viram:

```ts
  const [rows, setRows] = useState<WinRow[]>([]);
  const [todayIds, setTodayIds] = useState<Set<string>>(new Set());
  const [scope, setScope] = useState<"hoje" | "geral">("geral");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    // every session of today counts toward "Hoje"
    const [daysRes, winRes] = await Promise.all([
      supabase.from("game_days").select("id").eq("date", todayStr()),
      fetchWinRows(),
    ]);
    setTodayIds(new Set((daysRes.data ?? []).map((d) => d.id)));
    setRows(winRes.rows);
    setError(daysRes.error?.message ?? winRes.error);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const ranking = useMemo(
    () => rankPlayers(rows, scope === "hoje" ? todayIds : undefined),
    [rows, scope, todayIds]
  );
```

4. Logo depois do `<div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-900/60 p-1">…</div>` dos botões Hoje/Geral, inserir:

```tsx
      {error && (
        <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-300">
          {error}
        </p>
      )}
```

5. Na lista, trocar `key={r.name}` por `key={r.id}`. O resto do JSX não muda.

- [ ] **Step 7: Verificar**

Run: `bun test && bunx tsc --noEmit && bun run lint`
Expected: tudo passa.

- [ ] **Step 8: Commit**

```bash
git add src/lib/ranking.ts src/lib/ranking.test.ts src/lib/winRows.ts src/app/ranking/page.tsx
git commit -m "fix: page ranking rows past 1000 and count every session of today"
```

---

### Task 2: Dashboard, sorteio em `/sorteio` e novo menu

**Files:**
- Modify: `src/lib/date.ts`
- Modify: `src/app/historico/page.tsx`
- Move: `src/app/page.tsx` → `src/app/sorteio/page.tsx`
- Modify: `src/components/NavBar.tsx:6-12`
- Create: `src/app/page.tsx`

**Interfaces:**
- Consumes: `rankPlayers`, `RankedPlayer` (`@/lib/ranking`), `fetchWinRows` (`@/lib/winRows`), `buildListText(title, names, url)` (`@/lib/listText`), `formatDate`, `todayStr` (`@/lib/date`), `GameList` (`@/lib/types`).
- Produces: `formatSession(dateStr: string, sessionNumber: number): string` em `@/lib/date`.

- [ ] **Step 1: `formatSession`**

Adicionar ao fim de `src/lib/date.ts`:

```ts
export function formatSession(dateStr: string, sessionNumber: number): string {
  const base = formatDate(dateStr);
  return sessionNumber > 1 ? `${base} _${sessionNumber}` : base;
}
```

Em `src/app/historico/page.tsx`: apagar a função `labelFor`, trocar o import para `import { formatSession } from "@/lib/date";` e trocar `{labelFor(day)}` por `{formatSession(day.date, day.session_number)}`.

- [ ] **Step 2: Mover o sorteio**

```bash
mkdir -p src/app/sorteio
git mv src/app/page.tsx src/app/sorteio/page.tsx
```

Não editar o conteúdo (os imports usam `@/`, então continuam válidos).

- [ ] **Step 3: Menu**

Em `src/components/NavBar.tsx`, `navItems` vira:

```ts
const navItems = [
  { href: "/", label: "Início", icon: "🏠" },
  { href: "/sorteio", label: "Sorteio", icon: "🎲" },
  { href: "/listas", label: "Listas", icon: "📋" },
  { href: "/ranking", label: "Ranking", icon: "🏆" },
  { href: "/historico", label: "Histórico", icon: "🗓️" },
];
```

(`grid-cols-5` do rodapé continua certo.)

- [ ] **Step 4: Dashboard**

`src/app/page.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { formatDate, formatSession, todayStr } from "@/lib/date";
import { buildListText } from "@/lib/listText";
import { rankPlayers, type RankedPlayer } from "@/lib/ranking";
import { fetchWinRows } from "@/lib/winRows";
import type { GameList } from "@/lib/types";

interface TodayGame {
  id: string;
  session_number: number;
  finished: boolean;
  attendance: { count: number }[];
  rounds: { count: number }[];
}

interface DayRow {
  id: string;
  date: string;
  session_number: number;
}

type NextList = GameList & {
  game_list_entries: { player_id: string; players: { name: string } | null }[];
};

const medals = ["🥇", "🥈", "🥉"];

const shortcuts = [
  { href: "/sorteio", label: "Sorteio", icon: "🎲" },
  { href: "/listas", label: "Listas", icon: "📋" },
  { href: "/jogadores", label: "Jogadores", icon: "👥" },
  { href: "/ranking", label: "Ranking", icon: "🏆" },
  { href: "/historico", label: "Histórico", icon: "🗓️" },
];

const cardClass = "space-y-3 rounded-2xl border border-white/5 bg-white/[0.03] p-4";

export default function InicioPage() {
  const [todayGame, setTodayGame] = useState<TodayGame | null>(null);
  const [nextList, setNextList] = useState<NextList | null>(null);
  const [podium, setPodium] = useState<RankedPlayer[]>([]);
  const [lastGame, setLastGame] = useState<{ day: DayRow; top: RankedPlayer[] } | null>(
    null
  );
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const today = todayStr();
    // read-only: the draw page is the one that creates today's game_day
    const [todayRes, listRes, daysRes, winRes] = await Promise.all([
      supabase
        .from("game_days")
        .select("id, session_number, finished, attendance(count), rounds(count)")
        .eq("date", today)
        .order("session_number", { ascending: false })
        .limit(1),
      supabase
        .from("game_lists")
        .select(
          "id, title, date, closed, created_at, game_list_entries(player_id, created_at, players(name))"
        )
        .eq("closed", false)
        .gte("date", today)
        .order("date")
        .order("created_at")
        .order("created_at", { referencedTable: "game_list_entries" })
        .limit(1),
      supabase
        .from("game_days")
        .select("id, date, session_number")
        .order("date", { ascending: false })
        .order("session_number", { ascending: false }),
      fetchWinRows(),
    ]);
    const firstError =
      todayRes.error?.message ??
      listRes.error?.message ??
      daysRes.error?.message ??
      winRes.error;
    if (firstError) {
      setError(firstError);
      setLoading(false);
      return;
    }

    setTodayGame((todayRes.data?.[0] as unknown as TodayGame) ?? null);
    setNextList((listRes.data?.[0] as unknown as NextList) ?? null);
    setPodium(rankPlayers(winRes.rows).filter((p) => p.position <= 3));

    const daysWithWinner = new Set(
      winRes.rows.flatMap((r) => (r.rounds && r.rounds.winner ? [r.rounds.game_day_id] : []))
    );
    const last = ((daysRes.data ?? []) as DayRow[]).find((d) => daysWithWinner.has(d.id));
    setLastGame(
      last
        ? {
            day: last,
            top: rankPlayers(winRes.rows, new Set([last.id])).filter((p) => p.position === 1),
          }
        : null
    );
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function copyList(list: NextList) {
    const url = `${window.location.origin}/lista/${list.id}`;
    const names = list.game_list_entries.map((e) => e.players?.name ?? "?");
    try {
      await navigator.clipboard.writeText(buildListText(list.title, names, url));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError(`Não foi possível copiar. Link da lista: ${url}`);
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl bg-white/[0.03]" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-white">Início</h2>
        <p className="text-sm text-slate-400">O que está rolando no vôlei.</p>
      </div>

      {error && (
        <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-300">
          {error}
        </p>
      )}

      {todayGame && (
        <section className={cardClass}>
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-slate-200">🏐 Jogo de hoje</h3>
              {todayGame.session_number > 1 && (
                <p className="text-xs font-medium text-orange-400">
                  Jogo {todayGame.session_number} do dia
                </p>
              )}
            </div>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                todayGame.finished
                  ? "bg-emerald-500/15 text-emerald-400"
                  : "bg-orange-500/15 text-orange-400"
              }`}
            >
              {todayGame.finished ? "Encerrado" : "Em andamento"}
            </span>
          </div>
          <p className="text-sm text-slate-400">
            {todayGame.attendance[0]?.count ?? 0} presentes · {todayGame.rounds[0]?.count ?? 0}{" "}
            {(todayGame.rounds[0]?.count ?? 0) === 1 ? "set" : "sets"}
          </p>
          <Link
            href="/sorteio"
            className="block w-full rounded-xl bg-gradient-to-r from-orange-500 to-amber-400 py-2.5 text-center text-sm font-bold text-slate-950 shadow-lg shadow-orange-500/25 transition active:scale-[0.98]"
          >
            Ir para o sorteio
          </Link>
        </section>
      )}

      <section className={cardClass}>
        <h3 className="text-sm font-semibold text-slate-200">📋 Próximo jogo</h3>
        {nextList ? (
          <>
            <div>
              <p className="text-base font-semibold text-white">{nextList.title}</p>
              <p className="text-xs capitalize text-slate-500">
                {formatDate(nextList.date)} · {nextList.game_list_entries.length} confirmados
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => copyList(nextList)}
                className="flex-1 rounded-lg bg-gradient-to-r from-orange-500 to-amber-400 px-3 py-2 text-xs font-bold text-slate-950 transition active:scale-[0.98]"
              >
                {copied ? "✓ Copiado!" : "📲 Copiar para o WhatsApp"}
              </button>
              <Link
                href={`/lista/${nextList.id}`}
                className="rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold text-white"
              >
                Abrir lista
              </Link>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-slate-500">Nenhuma lista aberta.</p>
            <Link
              href="/listas"
              className="rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold text-white"
            >
              Criar lista
            </Link>
          </div>
        )}
      </section>

      <section className={cardClass}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-200">🏆 Pódio</h3>
          <Link href="/ranking" className="text-xs font-medium text-orange-400">
            Ver ranking completo
          </Link>
        </div>
        {podium.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhuma vitória registrada ainda.</p>
        ) : (
          <ol className="space-y-1.5">
            {podium.map((p) => (
              <li key={p.id} className="flex items-center gap-3 text-sm">
                <span className="w-6 shrink-0 text-center">{medals[p.position - 1]}</span>
                <span className="flex-1 truncate font-medium text-slate-100">{p.name}</span>
                <span className="font-bold text-orange-400">
                  {p.wins} {p.wins === 1 ? "vitória" : "vitórias"}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      {lastGame && (
        <section className={cardClass}>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-200">🗓️ Último jogo</h3>
            <Link href="/historico" className="text-xs font-medium text-orange-400">
              Ver histórico
            </Link>
          </div>
          <p className="text-xs capitalize text-slate-500">
            {formatSession(lastGame.day.date, lastGame.day.session_number)}
          </p>
          <p className="text-sm text-slate-300">
            Quem mais venceu:{" "}
            <span className="font-semibold text-white">
              {lastGame.top.map((p) => p.name).join(", ")}
            </span>{" "}
            · {lastGame.top[0].wins} {lastGame.top[0].wins === 1 ? "vitória" : "vitórias"}
          </p>
        </section>
      )}

      <section className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {shortcuts.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="flex flex-col items-center gap-1 rounded-xl border border-white/5 bg-white/[0.03] py-3 text-xs font-medium text-slate-300 transition hover:bg-white/[0.06]"
          >
            <span className="text-xl" aria-hidden>
              {s.icon}
            </span>
            {s.label}
          </Link>
        ))}
      </section>
    </div>
  );
}
```

`lastGame.top` nunca é vazio: o dia só é escolhido se tiver set com vencedor, e todo set com vencedor tem jogadores no time vencedor.

- [ ] **Step 5: Verificar estático**

Run: `bun test && bunx tsc --noEmit && bun run lint`
Expected: tudo passa.

- [ ] **Step 6: Verificar no app**

Com `bun dev`:
1. `/` mostra Início; cards na ordem do spec; nenhum `game_day` novo é criado ao abrir (conferir em `/historico` antes/depois).
2. `/sorteio` funciona igual ao sorteio antigo.
3. Menu (topo e rodapé em largura de celular) mostra Início, Sorteio, Listas, Ranking, Histórico; aba ativa destacada.
4. "Copiar para o WhatsApp" do card copia o mesmo texto da tela de listas.
5. Atalho "Jogadores" abre `/jogadores`.
6. `/ranking` aba "Hoje" mostra vitórias de todas as sessões do dia.

- [ ] **Step 7: Commit**

```bash
git add src/lib/date.ts src/app/historico/page.tsx src/app/sorteio/page.tsx src/components/NavBar.tsx src/app/page.tsx
git commit -m "feat: add dashboard home and move draw to /sorteio"
```

---

## Self-review

- Spec coverage: rotas/menu (T2 S2-S3), só leitura (T2 S4 comentário + verificação), cards 1-5 (T2 S4), `rankPlayers` + teste (T1 S1-S4), correção "Hoje" (T1 S6), limite 1000 (T1 S5-S6), `formatSession` (T2 S1).
- Tipos consistentes: `WinRow`, `RankedPlayer`, `rankPlayers`, `fetchWinRows`, `formatSession`.
