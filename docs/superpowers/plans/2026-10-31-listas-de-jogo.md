# Listas de jogo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar listas de jogo com link público de confirmação e carregar a lista na presença do sorteio.

**Architecture:** Duas tabelas novas (`game_lists`, `game_list_entries`) independentes de `game_days`. Tela `/listas` para gerenciar, tela pública `/lista/[id]` para confirmar (identidade em `localStorage`), e um select no sorteio que soma os confirmados à `attendance` do jogo atual e encerra a lista. Tudo client component falando direto com o Supabase, como o resto do app.

**Tech Stack:** Next.js 16 (App Router, client components), React 19, Supabase JS v2, Tailwind v4, bun test.

**Spec:** `docs/superpowers/specs/2026-10-31-listas-de-jogo-design.md`

## Global Constraints

- App sem login: RLS com policy `"public full access"` em toda tabela nova.
- Next.js 16: em client component, ler params dinâmicos com `useParams` de `next/navigation` (ver `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-params.md`).
- Textos de UI em português, mesmo estilo visual (Tailwind) das páginas existentes.
- Erros do Supabase aparecem na caixa vermelha padrão (`rounded-xl border border-red-500/20 bg-red-500/10 ...`).
- `localStorage` sempre dentro de try/catch; chave `volei:playerId`.
- Sem dependências novas.
- Verificação: `bun test`, `bunx tsc --noEmit`, `bun run lint` precisam passar ao fim de cada task.

## File Structure

- Create `supabase/migrations/0003_add_game_lists.sql` — tabelas + RLS.
- Modify `supabase/schema.sql` — mesmas tabelas no schema completo.
- Modify `src/lib/types.ts` — tipo `GameList`.
- Modify `src/lib/date.ts` — mover `formatDate` de `historico` para cá (reuso).
- Modify `src/app/historico/page.tsx` — importar `formatDate`.
- Create `src/lib/listText.ts` + `src/lib/listText.test.ts` — texto do WhatsApp.
- Create `src/app/listas/page.tsx` — gerenciar listas.
- Modify `src/components/NavBar.tsx` — aba "Listas".
- Create `src/app/lista/[id]/page.tsx` — link público.
- Modify `src/app/page.tsx` — select "Carregar lista…".

---

### Task 1: Banco, tipos e helpers puros

**Files:**
- Create: `supabase/migrations/0003_add_game_lists.sql`
- Modify: `supabase/schema.sql` (final do arquivo)
- Modify: `src/lib/types.ts`
- Modify: `src/lib/date.ts`
- Modify: `src/app/historico/page.tsx` (remover `formatDate` local, importar)
- Create: `src/lib/listText.ts`
- Test: `src/lib/listText.test.ts`

**Interfaces:**
- Produces: `interface GameList { id: string; title: string; date: string; closed: boolean; created_at: string }` em `@/lib/types`
- Produces: `formatDate(dateStr: string): string` em `@/lib/date`
- Produces: `buildListText(title: string, names: string[], url: string): string` em `@/lib/listText`

- [ ] **Step 1: Migration**

`supabase/migrations/0003_add_game_lists.sql`:

```sql
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
```

- [ ] **Step 2: schema.sql**

Em `supabase/schema.sql`, adicionar as duas `create table` (sem `if not exists`) logo depois de `round_players`, e no bloco de RLS adicionar:

```sql
alter table game_lists enable row level security;
alter table game_list_entries enable row level security;
```

```sql
create policy "public full access" on game_lists for all using (true) with check (true);
create policy "public full access" on game_list_entries for all using (true) with check (true);
```

- [ ] **Step 3: Aplicar a migration no Supabase**

Pedir confirmação ao usuário antes (altera o banco de produção). Com OK, aplicar via Supabase MCP (`apply_migration`/`execute_sql`) ou o usuário cola o arquivo no SQL Editor. Conferir: `select count(*) from game_lists;` retorna 0 sem erro.

- [ ] **Step 4: Tipo `GameList`**

Adicionar ao fim de `src/lib/types.ts`:

```ts
export interface GameList {
  id: string;
  title: string;
  date: string;
  closed: boolean;
  created_at: string;
}
```

- [ ] **Step 5: Mover `formatDate`**

Adicionar ao fim de `src/lib/date.ts`:

```ts
export function formatDate(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}
```

Em `src/app/historico/page.tsx`, apagar a função `formatDate` local e adicionar `import { formatDate } from "@/lib/date";`.

- [ ] **Step 6: Teste do texto (falhando)**

`src/lib/listText.test.ts`:

```ts
import { expect, test } from "bun:test";
import { buildListText } from "./listText";

test("numbers names and appends the link", () => {
  expect(buildListText("Jogo domingo 01/11", ["Rony", "Joel"], "https://x/lista/1")).toBe(
    "🏐 Jogo domingo 01/11\n1. Rony\n2. Joel\n\nConfirme aqui: https://x/lista/1"
  );
});

test("empty list still has title and link", () => {
  expect(buildListText("Jogo sábado", [], "https://x/lista/2")).toBe(
    "🏐 Jogo sábado\n\nConfirme aqui: https://x/lista/2"
  );
});
```

- [ ] **Step 7: Rodar e ver falhar**

Run: `bun test src/lib/listText.test.ts`
Expected: FAIL — `Cannot find module './listText'`.

- [ ] **Step 8: Implementar**

`src/lib/listText.ts`:

```ts
export function buildListText(title: string, names: string[], url: string): string {
  const lines = names.map((name, i) => `${i + 1}. ${name}`);
  return [`🏐 ${title}`, ...lines, "", `Confirme aqui: ${url}`].join("\n");
}
```

- [ ] **Step 9: Verificar**

Run: `bun test && bunx tsc --noEmit && bun run lint`
Expected: todos os testes passam, sem erros de tipo/lint.

- [ ] **Step 10: Commit**

```bash
git add supabase src/lib src/app/historico/page.tsx
git commit -m "feat: add game lists tables and WhatsApp list text helper"
```

---

### Task 2: Tela `/listas` (gerenciar) + aba no menu

**Files:**
- Create: `src/app/listas/page.tsx`
- Modify: `src/components/NavBar.tsx:6-11` (navItems) e `:44` (`grid-cols-4` → `grid-cols-5`)

**Interfaces:**
- Consumes: `GameList` (`@/lib/types`), `buildListText` (`@/lib/listText`), `formatDate`, `todayStr` (`@/lib/date`)
- Produces: rota `/listas`; link público no formato `${window.location.origin}/lista/${id}` (Task 3 implementa a rota)

- [ ] **Step 1: NavBar**

Em `src/components/NavBar.tsx`, `navItems` vira:

```ts
const navItems = [
  { href: "/", label: "Sorteio", icon: "🎲" },
  { href: "/listas", label: "Listas", icon: "📋" },
  { href: "/jogadores", label: "Jogadores", icon: "👥" },
  { href: "/ranking", label: "Ranking", icon: "🏆" },
  { href: "/historico", label: "Histórico", icon: "🗓️" },
];
```

E na nav de baixo trocar `grid-cols-4` por `grid-cols-5`.

- [ ] **Step 2: Página**

`src/app/listas/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { formatDate, todayStr } from "@/lib/date";
import { buildListText } from "@/lib/listText";
import type { GameList } from "@/lib/types";

interface EntryRow {
  list_id: string;
  player_id: string;
  players: { name: string } | null;
}

export default function ListasPage() {
  const [lists, setLists] = useState<GameList[]>([]);
  const [entries, setEntries] = useState<EntryRow[]>([]);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(todayStr());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const [listsRes, entriesRes] = await Promise.all([
      supabase
        .from("game_lists")
        .select("id, title, date, closed, created_at")
        .order("date", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase
        .from("game_list_entries")
        .select("list_id, player_id, players(name)")
        .order("created_at"),
    ]);
    const firstError = listsRes.error ?? entriesRes.error;
    if (firstError) {
      setError(firstError.message);
      setLoading(false);
      return;
    }
    setLists(listsRes.data ?? []);
    setEntries((entriesRes.data as unknown as EntryRow[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const entriesOf = (listId: string) => entries.filter((e) => e.list_id === listId);

  async function createList(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed || !date) return;
    setError(null);
    setSaving(true);
    const { data, error } = await supabase
      .from("game_lists")
      .insert({ title: trimmed, date })
      .select("id")
      .single();
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setTitle("");
    setExpandedId(data.id);
    load();
  }

  async function removeEntry(listId: string, playerId: string) {
    const { error } = await supabase
      .from("game_list_entries")
      .delete()
      .eq("list_id", listId)
      .eq("player_id", playerId);
    if (error) setError(error.message);
    else load();
  }

  async function setClosed(listId: string, closed: boolean) {
    const { error } = await supabase.from("game_lists").update({ closed }).eq("id", listId);
    if (error) setError(error.message);
    else load();
  }

  async function copyText(list: GameList) {
    const url = `${window.location.origin}/lista/${list.id}`;
    const names = entriesOf(list.id).map((e) => e.players?.name ?? "?");
    try {
      await navigator.clipboard.writeText(buildListText(list.title, names, url));
      setCopiedId(list.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      setError(`Não foi possível copiar. Link da lista: ${url}`);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-white">Listas</h2>
        <p className="text-sm text-slate-400">Crie a lista do jogo e mande o link no grupo.</p>
      </div>

      <form
        onSubmit={createList}
        className="space-y-3 rounded-2xl border border-white/5 bg-white/[0.03] p-4 shadow-xl shadow-black/20 sm:p-5"
      >
        <h3 className="text-sm font-semibold text-slate-300">Nova lista</h3>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ex.: Jogo domingo 01/11"
          className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none ring-orange-500/50 focus:ring-2"
        />
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-3.5 py-2.5 text-sm text-white outline-none ring-orange-500/50 focus:ring-2"
        />
        <button
          type="submit"
          disabled={saving || !title.trim() || !date}
          className="w-full rounded-xl bg-gradient-to-r from-orange-500 to-amber-400 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-orange-500/25 transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Criando..." : "+ Criar lista"}
        </button>
      </form>

      {error && (
        <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-300">
          {error}
        </p>
      )}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-white/[0.03]" />
          ))}
        </div>
      ) : lists.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-10 text-center">
          <p className="text-3xl">📋</p>
          <p className="mt-2 text-sm text-slate-400">Nenhuma lista criada ainda.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {lists.map((list) => {
            const listEntries = entriesOf(list.id);
            const expanded = expandedId === list.id;
            return (
              <li
                key={list.id}
                className="overflow-hidden rounded-xl border border-white/5 bg-white/[0.03]"
              >
                <button
                  onClick={() => setExpandedId(expanded ? null : list.id)}
                  className="flex w-full items-center justify-between px-4 py-3.5 text-left"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-100">{list.title}</p>
                    <p className="text-xs capitalize text-slate-500">
                      {formatDate(list.date)} · {listEntries.length} confirmados
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        list.closed
                          ? "bg-emerald-500/15 text-emerald-400"
                          : "bg-orange-500/15 text-orange-400"
                      }`}
                    >
                      {list.closed ? "Encerrada" : "Aberta"}
                    </span>
                    <span className="text-slate-500">{expanded ? "▲" : "▼"}</span>
                  </div>
                </button>

                {expanded && (
                  <div className="space-y-3 border-t border-white/5 px-4 py-3">
                    {listEntries.length === 0 ? (
                      <p className="text-sm text-slate-500">Ninguém confirmou ainda.</p>
                    ) : (
                      <ol className="space-y-1">
                        {listEntries.map((e, i) => (
                          <li
                            key={e.player_id}
                            className="flex items-center justify-between gap-2 text-sm text-slate-200"
                          >
                            <span className="truncate">
                              <span className="text-slate-500">{i + 1}.</span>{" "}
                              {e.players?.name ?? "?"}
                            </span>
                            {!list.closed && (
                              <button
                                onClick={() => removeEntry(list.id, e.player_id)}
                                aria-label={`Remover ${e.players?.name ?? ""}`}
                                className="shrink-0 rounded-lg px-2 py-0.5 text-xs text-slate-500 transition hover:bg-red-500/10 hover:text-red-400"
                              >
                                ✕
                              </button>
                            )}
                          </li>
                        ))}
                      </ol>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => copyText(list)}
                        className="flex-1 rounded-lg bg-gradient-to-r from-orange-500 to-amber-400 px-3 py-2 text-xs font-bold text-slate-950 transition active:scale-[0.98]"
                      >
                        {copiedId === list.id ? "✓ Copiado!" : "📲 Copiar para o WhatsApp"}
                      </button>
                      <a
                        href={`/lista/${list.id}`}
                        className="rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold text-white"
                      >
                        Abrir link
                      </a>
                      <button
                        onClick={() => setClosed(list.id, !list.closed)}
                        className="rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold text-white"
                      >
                        {list.closed ? "Reabrir" : "Encerrar"}
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verificar estático**

Run: `bun test && bunx tsc --noEmit && bun run lint`
Expected: tudo passa.

- [ ] **Step 4: Verificar no app**

Run: `bun dev` e abrir `http://localhost:3000/listas`.
Conferir: criar "Jogo domingo 01/11" → aparece expandida com "Ninguém confirmou ainda"; "Copiar para o WhatsApp" mostra "✓ Copiado!" e o texto colado bate com o formato do spec; "Encerrar" muda o selo para "Encerrada" e esconde os ✕; "Reabrir" volta. Aba "Listas" aparece no menu de cima e no de baixo (largura de celular).

- [ ] **Step 5: Commit**

```bash
git add src/app/listas/page.tsx src/components/NavBar.tsx
git commit -m "feat: add lists management page"
```

---

### Task 3: Link público `/lista/[id]`

**Files:**
- Create: `src/app/lista/[id]/page.tsx`

**Interfaces:**
- Consumes: `GameList`, `Gender`, `Player` (`@/lib/types`), `formatDate` (`@/lib/date`), tabela `game_list_entries` (Task 1)
- Produces: rota `/lista/[id]` usada pelo link da Task 2

- [ ] **Step 1: Página**

`src/app/lista/[id]/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { formatDate } from "@/lib/date";
import type { GameList, Gender, Player } from "@/lib/types";

const STORAGE_KEY = "volei:playerId";

function readStoredId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredId(id: string | null) {
  try {
    if (id) localStorage.setItem(STORAGE_KEY, id);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // storage blocked (private mode): the person just picks their name each visit
  }
}

export default function ListaPublicaPage() {
  const { id } = useParams<{ id: string }>();
  const [list, setList] = useState<GameList | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [players, setPlayers] = useState<Player[]>([]);
  const [entryIds, setEntryIds] = useState<string[]>([]);
  const [meId, setMeId] = useState<string | null>(null);
  const [picker, setPicker] = useState<null | "me" | "other">(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const [listRes, playersRes, entriesRes] = await Promise.all([
      supabase
        .from("game_lists")
        .select("id, title, date, closed, created_at")
        .eq("id", id)
        .maybeSingle(),
      supabase.from("players").select("id, name, gender").order("name"),
      supabase
        .from("game_list_entries")
        .select("player_id")
        .eq("list_id", id)
        .order("created_at"),
    ]);
    // 22P02 = id in the URL isn't a valid uuid
    if (listRes.error?.code === "22P02" || (!listRes.error && !listRes.data)) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    const firstError = listRes.error ?? playersRes.error ?? entriesRes.error;
    if (firstError) {
      setError(firstError.message);
      setLoading(false);
      return;
    }
    const playersData = playersRes.data ?? [];
    setList(listRes.data);
    setPlayers(playersData);
    setEntryIds((entriesRes.data ?? []).map((e) => e.player_id));
    const stored = readStoredId();
    setMeId(stored && playersData.some((p) => p.id === stored) ? stored : null);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [id]);

  async function addEntry(playerId: string) {
    setBusy(true);
    setError(null);
    const { error } = await supabase
      .from("game_list_entries")
      .insert({ list_id: id, player_id: playerId });
    setBusy(false);
    // 23505 = already on the list: nothing to do
    if (error && error.code !== "23505") {
      setError(error.message);
      return;
    }
    load();
  }

  async function removeEntry(playerId: string) {
    setBusy(true);
    setError(null);
    const { error } = await supabase
      .from("game_list_entries")
      .delete()
      .eq("list_id", id)
      .eq("player_id", playerId);
    setBusy(false);
    if (error) setError(error.message);
    else load();
  }

  async function registerPlayer(name: string, gender: Gender): Promise<string | null> {
    const { data, error } = await supabase
      .from("players")
      .insert({ name, gender })
      .select("id")
      .single();
    if (error) {
      setError(error.message);
      return null;
    }
    return data.id;
  }

  function handlePick(playerId: string) {
    if (picker === "me") {
      writeStoredId(playerId);
      setMeId(playerId);
    }
    setPicker(null);
    addEntry(playerId);
  }

  function forgetMe() {
    writeStoredId(null);
    setMeId(null);
  }

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded-xl bg-white/[0.03]" />
        ))}
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-10 text-center">
        <p className="text-3xl">🤷</p>
        <p className="mt-2 text-sm text-slate-400">Lista não encontrada.</p>
      </div>
    );
  }

  const nameOf = (pid: string) => players.find((p) => p.id === pid)?.name ?? "?";
  const me = meId ? players.find((p) => p.id === meId) : undefined;
  const meConfirmed = !!meId && entryIds.includes(meId);
  const open = !!list && !list.closed;

  return (
    <div className="space-y-6">
      {list && (
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white">{list.title}</h2>
          <p className="text-sm capitalize text-slate-400">{formatDate(list.date)}</p>
        </div>
      )}

      {error && (
        <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-300">
          {error}
        </p>
      )}

      {!open && list && (
        <p className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-300">
          ✅ Lista encerrada
        </p>
      )}

      {open && picker === null && (
        <div className="space-y-3 rounded-2xl border border-white/5 bg-white/[0.03] p-4">
          {me ? (
            <>
              <p className="text-sm text-slate-300">
                Oi, <span className="font-semibold text-white">{me.name}</span> 👋{" "}
                <button onClick={forgetMe} className="text-xs text-slate-500 underline">
                  não sou {me.name}
                </button>
              </p>
              <button
                onClick={() => (meConfirmed ? removeEntry(me.id) : addEntry(me.id))}
                disabled={busy}
                className={`w-full rounded-xl py-3 text-base font-bold transition active:scale-[0.98] disabled:opacity-60 ${
                  meConfirmed
                    ? "bg-white/10 text-white"
                    : "bg-gradient-to-r from-orange-500 to-amber-400 text-slate-950 shadow-lg shadow-orange-500/25"
                }`}
              >
                {meConfirmed ? "Sair da lista" : "✋ Confirmar presença"}
              </button>
            </>
          ) : (
            <button
              onClick={() => setPicker("me")}
              className="w-full rounded-xl bg-gradient-to-r from-orange-500 to-amber-400 py-3 text-base font-bold text-slate-950 shadow-lg shadow-orange-500/25 transition active:scale-[0.98]"
            >
              ✋ Quem é você? Confirmar presença
            </button>
          )}
          <button
            onClick={() => setPicker("other")}
            className="w-full rounded-xl bg-white/5 py-2 text-sm font-medium text-slate-300"
          >
            + Adicionar outra pessoa
          </button>
        </div>
      )}

      {open && picker !== null && (
        <PlayerPicker
          title={picker === "me" ? "Quem é você?" : "Quem você quer adicionar?"}
          players={players.filter((p) => !entryIds.includes(p.id) || picker === "me")}
          onPick={handlePick}
          onRegister={registerPlayer}
          onCancel={() => setPicker(null)}
        />
      )}

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-300">
          Confirmados ({entryIds.length})
        </h3>
        {entryIds.length === 0 ? (
          <p className="text-sm text-slate-500">Ninguém confirmou ainda.</p>
        ) : (
          <ol className="space-y-1">
            {entryIds.map((pid, i) => (
              <li
                key={pid}
                className="flex items-center justify-between gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-sm text-slate-200"
              >
                <span className="truncate">
                  <span className="text-slate-500">{i + 1}.</span> {nameOf(pid)}
                </span>
                {open && (
                  <button
                    onClick={() => removeEntry(pid)}
                    disabled={busy}
                    aria-label={`Remover ${nameOf(pid)}`}
                    className="shrink-0 rounded-lg px-2 py-0.5 text-xs text-slate-500 transition hover:bg-red-500/10 hover:text-red-400"
                  >
                    ✕
                  </button>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function PlayerPicker({
  title,
  players,
  onPick,
  onRegister,
  onCancel,
}: {
  title: string;
  players: Player[];
  onPick: (playerId: string) => void;
  onRegister: (name: string, gender: Gender) => Promise<string | null>;
  onCancel: () => void;
}) {
  const [query, setQuery] = useState("");
  const [registering, setRegistering] = useState(false);
  const [gender, setGender] = useState<Gender>("M");
  const [saving, setSaving] = useState(false);

  const q = query.trim().toLowerCase();
  const matches = players.filter((p) => p.name.toLowerCase().includes(q));

  async function register(e: React.FormEvent) {
    e.preventDefault();
    const name = query.trim();
    if (!name) return;
    // avoid duplicate players when someone types a name that already exists
    const existing = players.find((p) => p.name.trim().toLowerCase() === name.toLowerCase());
    if (existing) return onPick(existing.id);
    setSaving(true);
    const newId = await onRegister(name, gender);
    setSaving(false);
    if (newId) onPick(newId);
  }

  return (
    <div className="space-y-3 rounded-2xl border border-white/5 bg-white/[0.03] p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
        <button onClick={onCancel} className="text-xs text-slate-500">
          Cancelar
        </button>
      </div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={registering ? "Nome" : "Buscar nome..."}
        autoFocus
        className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none ring-orange-500/50 focus:ring-2"
      />

      {registering ? (
        <form onSubmit={register} className="space-y-3">
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-900/60 p-1">
            <GenderOption label="Homem" active={gender === "M"} onClick={() => setGender("M")} />
            <GenderOption label="Mulher" active={gender === "F"} onClick={() => setGender("F")} />
          </div>
          <button
            type="submit"
            disabled={saving || !query.trim()}
            className="w-full rounded-xl bg-gradient-to-r from-orange-500 to-amber-400 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-50"
          >
            {saving ? "Cadastrando..." : "Cadastrar e confirmar"}
          </button>
        </form>
      ) : (
        <>
          <ul className="max-h-72 space-y-1 overflow-y-auto">
            {matches.map((p) => (
              <li key={p.id}>
                <button
                  onClick={() => onPick(p.id)}
                  className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-200 hover:bg-white/5"
                >
                  {p.name}
                </button>
              </li>
            ))}
            {matches.length === 0 && (
              <li className="px-3 py-2 text-sm text-slate-500">Nenhum jogador com esse nome.</li>
            )}
          </ul>
          <button
            onClick={() => setRegistering(true)}
            className="w-full rounded-xl bg-white/5 py-2 text-sm font-medium text-slate-300"
          >
            Não está na lista? Cadastrar
          </button>
        </>
      )}
    </div>
  );
}

function GenderOption({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg py-2 text-sm font-medium transition ${
        active ? "bg-orange-500 text-white shadow shadow-orange-500/30" : "text-slate-400"
      }`}
    >
      {label}
    </button>
  );
}
```

- [ ] **Step 2: Verificar estático**

Run: `bun test && bunx tsc --noEmit && bun run lint`
Expected: tudo passa. Se o lint reclamar de `react-hooks/exhaustive-deps` no `useEffect(..., [id])`, seguir o mesmo padrão das outras páginas (o lint atual aceita `useEffect(() => { load(); }, [])`); não desabilitar a regra globalmente.

- [ ] **Step 3: Verificar no app**

Com `bun dev`, a partir de `/listas` clicar em "Abrir link":
1. Primeira visita: botão "Quem é você?" → escolher um nome → entra como 1º na lista e a tela mostra "Oi, <nome> 👋" + "Sair da lista".
2. Recarregar a página: continua reconhecendo a pessoa.
3. "Sair da lista" remove; "Confirmar presença" volta a adicionar.
4. "+ Adicionar outra pessoa" → buscar outro nome → entra na lista, identidade não muda.
5. Cadastrar nome novo ("Teste Link", Mulher) → aparece na lista e em `/jogadores` (apagar depois).
6. "não sou <nome>" → volta para "Quem é você?".
7. Encerrar em `/listas` → link mostra "✅ Lista encerrada" sem botões.
8. `/lista/abc` → "Lista não encontrada".
9. Em aba anônima o fluxo funciona (só não lembra a pessoa entre visitas, se o storage estiver bloqueado).

- [ ] **Step 4: Commit**

```bash
git add "src/app/lista/[id]/page.tsx"
git commit -m "feat: add public list confirmation page"
```

---

### Task 4: Carregar lista no sorteio

**Files:**
- Modify: `src/app/page.tsx` — estado `lists`, consulta em `init`, função `carregarLista`, select na seção "Presença de hoje"

**Interfaces:**
- Consumes: `GameList` (`@/lib/types`), tabelas `game_lists` / `game_list_entries` (Task 1)
- Produces: nada para outras tasks

- [ ] **Step 1: Estado e tipo de busy**

Em `src/app/page.tsx`:

```ts
import type { GameList, Player } from "@/lib/types";
```

Adicionar estado junto dos outros:

```ts
  const [lists, setLists] = useState<GameList[]>([]);
```

E incluir `"lista"` no union de `busy`:

```ts
  const [busy, setBusy] = useState<
    null | "sortear" | "A" | "B" | "swap" | "day" | "reset" | "lista"
  >(null);
```

- [ ] **Step 2: Buscar listas em `init`**

Em `init`, logo antes do `setLoading(false)` final:

```ts
    const { data: listsData } = await supabase
      .from("game_lists")
      .select("id, title, date, closed, created_at")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });
    setLists(listsData ?? []);
```

- [ ] **Step 3: `carregarLista`**

Depois de `toggleAttendance`:

```ts
  async function carregarLista(listId: string) {
    if (!gameDayId || !listId) return;
    setBusy("lista");
    setError(null);
    const { data: entriesData, error: entriesErr } = await supabase
      .from("game_list_entries")
      .select("player_id")
      .eq("list_id", listId);
    if (entriesErr) {
      setError(entriesErr.message);
      setBusy(null);
      return;
    }
    const toAdd = (entriesData ?? [])
      .map((e) => e.player_id)
      .filter((pid) => !attendingIds.has(pid));
    if (toAdd.length > 0) {
      const { error: insertErr } = await supabase
        .from("attendance")
        .insert(toAdd.map((pid) => ({ game_day_id: gameDayId, player_id: pid })));
      if (insertErr) {
        setError(insertErr.message);
        setBusy(null);
        return;
      }
    }
    const { error: closeErr } = await supabase
      .from("game_lists")
      .update({ closed: true })
      .eq("id", listId);
    if (closeErr) setError(closeErr.message);
    // someone may have registered through the link after this page loaded
    const { data: playersData } = await supabase
      .from("players")
      .select("id, name, gender")
      .order("name");
    if (playersData) setPlayers(playersData);
    setAttendingIds((prev) => new Set([...prev, ...toAdd]));
    setLists((prev) => prev.map((l) => (l.id === listId ? { ...l, closed: true } : l)));
    setBusy(null);
  }
```

- [ ] **Step 4: Select na UI**

Na seção "Presença de hoje", logo depois do `<div className="flex items-center justify-between">…</div>` do cabeçalho (antes do `{players.length === 0 ? …`):

```tsx
        {lists.length > 0 && !gameDayFinished && (
          <select
            value=""
            onChange={(e) => carregarLista(e.target.value)}
            disabled={busy !== null}
            className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-3.5 py-2.5 text-sm text-white outline-none ring-orange-500/50 focus:ring-2 disabled:opacity-60"
          >
            <option value="">
              {busy === "lista" ? "Carregando lista..." : "📋 Carregar lista..."}
            </option>
            {lists.map((l) => (
              <option key={l.id} value={l.id}>
                {l.title}
                {l.closed ? " (encerrada)" : ""}
              </option>
            ))}
          </select>
        )}
```

- [ ] **Step 5: Verificar estático**

Run: `bun test && bunx tsc --noEmit && bun run lint`
Expected: tudo passa.

- [ ] **Step 6: Verificar no app**

Com `bun dev`:
1. Ter uma lista aberta com 3+ confirmados (via link) e marcar à mão no sorteio 1 jogador que não está na lista.
2. Em `/`, escolher a lista no select → confirmados ficam marcados, o marcado à mão continua, contador "N confirmados" atualiza, select volta para "📋 Carregar lista...".
3. Em `/listas` a lista aparece "Encerrada".
4. Desmarcar um jogador funciona normalmente; "Sortear" usa só os marcados.
5. Escolher a mesma lista de novo não duplica nada (nenhum erro de chave).
6. Com o dia encerrado, o select não aparece.

- [ ] **Step 7: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: load a game list into today's attendance"
```

---

## Self-review

- Spec coverage: tabelas/RLS/migration (T1), texto WhatsApp + teste (T1), `/listas` com criar/remover/copiar/encerrar/reabrir (T2), aba no menu (T2), link público com identidade, cadastro, adicionar outra pessoa, remover, encerrada, não encontrada (T3), select no sorteio que soma e encerra, inclusive listas encerradas, desabilitado com dia encerrado (T4). Dashboard fora do escopo por decisão.
- Nomes consistentes: `GameList`, `buildListText`, `formatDate`, `carregarLista`, chave `volei:playerId`.
