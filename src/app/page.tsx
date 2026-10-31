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
  const [loadFailed, setLoadFailed] = useState(false);

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
      setLoadFailed(true);
      setLoading(false);
      return;
    }

    setTodayGame((todayRes.data?.[0] as unknown as TodayGame) ?? null);
    setNextList((listRes.data?.[0] as unknown as NextList) ?? null);
    setPodium(rankPlayers(winRes.rows).filter((p) => p.position <= 3));

    const daysWithWinner = new Set(
      winRes.rows.flatMap((r) =>
        r.players && r.rounds && r.rounds.winner && r.team === r.rounds.winner
          ? [r.rounds.game_day_id]
          : []
      )
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

      {!loadFailed && (
        <>
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
        </>
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
