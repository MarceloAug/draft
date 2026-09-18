"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

interface GameDayRow {
  id: string;
  date: string;
  finished: boolean;
  session_number: number;
}

interface RoundRow {
  id: string;
  game_day_id: string;
  round_number: number;
  winner: "A" | "B" | null;
  round_players: { player_id: string; team: "A" | "B" | "BENCH" }[];
}

const medals = ["🥇", "🥈", "🥉"];

function formatDate(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}

function labelFor(day: GameDayRow) {
  const base = formatDate(day.date);
  return day.session_number > 1 ? `${base} _${day.session_number}` : base;
}

function rankingFor(rounds: RoundRow[]) {
  const wins = new Map<string, number>();
  for (const r of rounds) {
    if (!r.winner) continue;
    for (const rp of r.round_players) {
      if (rp.team !== r.winner) continue;
      wins.set(rp.player_id, (wins.get(rp.player_id) ?? 0) + 1);
    }
  }
  return [...wins.entries()]
    .map(([playerId, count]) => ({ playerId, wins: count }))
    .sort((a, b) => b.wins - a.wins);
}

export default function HistoricoPage() {
  const [days, setDays] = useState<GameDayRow[]>([]);
  const [attendanceCounts, setAttendanceCounts] = useState<Map<string, number>>(new Map());
  const [roundsByDay, setRoundsByDay] = useState<Map<string, RoundRow[]>>(new Map());
  const [playerNames, setPlayerNames] = useState<Map<string, string>>(new Map());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [{ data: daysData }, { data: attendanceData }, { data: roundsData }, { data: playersData }] =
      await Promise.all([
        supabase
          .from("game_days")
          .select("id, date, finished, session_number")
          .order("date", { ascending: false })
          .order("session_number", { ascending: false }),
        supabase.from("attendance").select("game_day_id, player_id"),
        supabase
          .from("rounds")
          .select("id, game_day_id, round_number, winner, round_players(player_id, team)")
          .order("round_number"),
        supabase.from("players").select("id, name"),
      ]);

    setDays(daysData ?? []);

    const counts = new Map<string, number>();
    for (const a of attendanceData ?? []) {
      counts.set(a.game_day_id, (counts.get(a.game_day_id) ?? 0) + 1);
    }
    setAttendanceCounts(counts);

    const grouped = new Map<string, RoundRow[]>();
    for (const r of (roundsData as unknown as RoundRow[]) ?? []) {
      const list = grouped.get(r.game_day_id) ?? [];
      list.push(r);
      grouped.set(r.game_day_id, list);
    }
    setRoundsByDay(grouped);

    setPlayerNames(new Map((playersData ?? []).map((p) => [p.id, p.name])));

    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const nameOf = (id: string) => playerNames.get(id) ?? "?";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-white">Histórico</h2>
        <p className="text-sm text-slate-400">Dias jogados, sets e resultados.</p>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-white/[0.03]" />
          ))}
        </div>
      ) : days.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-10 text-center">
          <p className="text-3xl">🗓️</p>
          <p className="mt-2 text-sm text-slate-400">Nenhum dia jogado ainda.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {days.map((day) => {
            const rounds = (roundsByDay.get(day.id) ?? []).sort(
              (a, b) => a.round_number - b.round_number
            );
            const expanded = expandedId === day.id;
            return (
              <li
                key={day.id}
                className="overflow-hidden rounded-xl border border-white/5 bg-white/[0.03]"
              >
                <button
                  onClick={() => setExpandedId(expanded ? null : day.id)}
                  className="flex w-full items-center justify-between px-4 py-3.5 text-left"
                >
                  <div>
                    <p className="text-sm font-semibold capitalize text-slate-100">
                      {labelFor(day)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {attendanceCounts.get(day.id) ?? 0} jogadores · {rounds.length}{" "}
                      {rounds.length === 1 ? "set" : "sets"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        day.finished
                          ? "bg-emerald-500/15 text-emerald-400"
                          : "bg-orange-500/15 text-orange-400"
                      }`}
                    >
                      {day.finished ? "Encerrado" : "Em andamento"}
                    </span>
                    <span className="text-slate-500">{expanded ? "▲" : "▼"}</span>
                  </div>
                </button>

                {expanded && (
                  <div className="space-y-2 border-t border-white/5 px-4 py-3">
                    {(() => {
                      const ranking = rankingFor(rounds);
                      if (ranking.length === 0) {
                        return (
                          <p className="text-sm text-slate-500">
                            Nenhum vencedor registrado nesse dia.
                          </p>
                        );
                      }
                      return ranking.map((entry, i) => (
                        <div
                          key={entry.playerId}
                          className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${
                            i === 0
                              ? "border-amber-400/30 bg-amber-400/5"
                              : "border-white/5 bg-white/[0.02]"
                          }`}
                        >
                          <span className="w-6 shrink-0 text-center">
                            {medals[i] ?? (
                              <span className="text-xs text-slate-500">{i + 1}º</span>
                            )}
                          </span>
                          <span className="flex-1 truncate text-sm font-medium text-slate-100">
                            {nameOf(entry.playerId)}
                          </span>
                          <span className="text-sm font-bold text-orange-400">
                            {entry.wins} {entry.wins === 1 ? "vitória" : "vitórias"}
                          </span>
                        </div>
                      ));
                    })()}
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
