"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { drawRound } from "@/lib/draw";
import { todayStr } from "@/lib/date";
import type { Player } from "@/lib/types";

interface RoundState {
  id: string;
  round_number: number;
  teamAIds: string[];
  teamBIds: string[];
  benchIds: string[];
  winner: "A" | "B" | null;
}

export default function SorteioPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [attendingIds, setAttendingIds] = useState<Set<string>>(new Set());
  const [gameDayId, setGameDayId] = useState<string | null>(null);
  const [rounds, setRounds] = useState<RoundState[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const init = async () => {
    setLoading(true);
    const { data: playersData, error: playersErr } = await supabase
      .from("players")
      .select("id, name, gender")
      .order("name");
    if (playersErr) {
      setError(playersErr.message);
      setLoading(false);
      return;
    }
    setPlayers(playersData ?? []);

    const date = todayStr();
    let dayId: string;
    const { data: existingDay } = await supabase
      .from("game_days")
      .select("id")
      .eq("date", date)
      .maybeSingle();
    if (existingDay) {
      dayId = existingDay.id;
    } else {
      const { data: newDay, error: newDayErr } = await supabase
        .from("game_days")
        .insert({ date })
        .select("id")
        .single();
      if (newDayErr) {
        setError(newDayErr.message);
        setLoading(false);
        return;
      }
      dayId = newDay.id;
    }
    setGameDayId(dayId);

    const { data: attendanceData } = await supabase
      .from("attendance")
      .select("player_id")
      .eq("game_day_id", dayId);
    setAttendingIds(new Set((attendanceData ?? []).map((a) => a.player_id)));

    const { data: roundsData } = await supabase
      .from("rounds")
      .select("id, round_number, winner, round_players(player_id, team)")
      .eq("game_day_id", dayId)
      .order("round_number");
    setRounds(
      (roundsData ?? []).map((r) => ({
        id: r.id,
        round_number: r.round_number,
        winner: r.winner,
        teamAIds: r.round_players.filter((rp) => rp.team === "A").map((rp) => rp.player_id),
        teamBIds: r.round_players.filter((rp) => rp.team === "B").map((rp) => rp.player_id),
        benchIds: r.round_players
          .filter((rp) => rp.team === "BENCH")
          .map((rp) => rp.player_id),
      }))
    );
    setLoading(false);
  };

  useEffect(() => {
    init();
  }, []);

  const playerById = useMemo(() => {
    const map = new Map<string, Player>();
    for (const p of players) map.set(p.id, p);
    return map;
  }, [players]);

  const namesFor = (ids: string[]) =>
    ids
      .map((id) => playerById.get(id))
      .filter((p): p is Player => !!p)
      .sort((a, b) => a.name.localeCompare(b.name));

  async function toggleAttendance(playerId: string) {
    if (!gameDayId) return;
    const attending = attendingIds.has(playerId);
    if (attending) {
      await supabase
        .from("attendance")
        .delete()
        .eq("game_day_id", gameDayId)
        .eq("player_id", playerId);
    } else {
      await supabase.from("attendance").insert({ game_day_id: gameDayId, player_id: playerId });
    }
    setAttendingIds((prev) => {
      const next = new Set(prev);
      if (attending) next.delete(playerId);
      else next.add(playerId);
      return next;
    });
  }

  async function sortear() {
    if (!gameDayId) return;
    const present = players.filter((p) => attendingIds.has(p.id));
    if (present.length < 2) {
      setError("Marque presença de pelo menos 2 jogadores.");
      return;
    }
    setError(null);
    const alreadyRested = new Set(rounds.flatMap((r) => r.benchIds));
    const last = rounds[rounds.length - 1];
    const previousTeamAIds = last ? new Set(last.teamAIds) : undefined;
    const { teamA, teamB, bench } = drawRound(present, alreadyRested, previousTeamAIds);
    const roundNumber = last ? last.round_number + 1 : 1;

    const { data: roundRow, error: roundErr } = await supabase
      .from("rounds")
      .insert({ game_day_id: gameDayId, round_number: roundNumber })
      .select("id")
      .single();
    if (roundErr) {
      setError(roundErr.message);
      return;
    }
    const rows = [
      ...teamA.map((p) => ({ round_id: roundRow.id, player_id: p.id, team: "A" })),
      ...teamB.map((p) => ({ round_id: roundRow.id, player_id: p.id, team: "B" })),
      ...bench.map((p) => ({ round_id: roundRow.id, player_id: p.id, team: "BENCH" })),
    ];
    const { error: rpErr } = await supabase.from("round_players").insert(rows);
    if (rpErr) {
      setError(rpErr.message);
      return;
    }
    setRounds([
      ...rounds,
      {
        id: roundRow.id,
        round_number: roundNumber,
        winner: null,
        teamAIds: teamA.map((p) => p.id),
        teamBIds: teamB.map((p) => p.id),
        benchIds: bench.map((p) => p.id),
      },
    ]);
  }

  async function markWinner(team: "A" | "B") {
    const current = rounds[rounds.length - 1];
    if (!current) return;
    const { error } = await supabase.from("rounds").update({ winner: team }).eq("id", current.id);
    if (error) {
      setError(error.message);
      return;
    }
    setRounds(rounds.map((r) => (r.id === current.id ? { ...r, winner: team } : r)));
  }

  if (loading) return <SorteioSkeleton />;

  const current = rounds[rounds.length - 1];

  return (
    <div className="space-y-7">
      {error && (
        <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-300">
          {error}
        </p>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold tracking-tight text-white">Presença de hoje</h2>
          <span className="rounded-full bg-orange-500/15 px-2.5 py-1 text-xs font-semibold text-orange-400">
            {attendingIds.size} confirmados
          </span>
        </div>

        {players.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-8 text-center text-sm text-slate-400">
            Cadastre jogadores na aba <span className="font-medium text-slate-300">Jogadores</span> primeiro.
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {players.map((p) => {
              const active = attendingIds.has(p.id);
              return (
                <li key={p.id}>
                  <button
                    onClick={() => toggleAttendance(p.id)}
                    className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition ${
                      active
                        ? "border-orange-500/40 bg-orange-500/10 text-white"
                        : "border-white/5 bg-white/[0.03] text-slate-400"
                    }`}
                  >
                    <span
                      className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] ${
                        active ? "bg-orange-500 text-white" : "bg-white/5 text-transparent"
                      }`}
                    >
                      ✓
                    </span>
                    <span className="truncate">{p.name}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {!current && players.length > 0 && (
        <button
          onClick={sortear}
          className="w-full rounded-2xl bg-gradient-to-r from-orange-500 to-amber-400 py-3.5 text-base font-bold text-slate-950 shadow-xl shadow-orange-500/25 transition active:scale-[0.98]"
        >
          🎲 Sortear times
        </button>
      )}

      {current && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold tracking-tight text-white">
              Set {current.round_number}
            </h2>
            {current.winner && (
              <span className="text-xs font-semibold text-emerald-400">Encerrado ✓</span>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <TeamCard
              label="Time A"
              accent="sky"
              names={namesFor(current.teamAIds).map((p) => p.name)}
              isWinner={current.winner === "A"}
            />
            <TeamCard
              label="Time B"
              accent="violet"
              names={namesFor(current.teamBIds).map((p) => p.name)}
              isWinner={current.winner === "B"}
            />
          </div>

          {current.benchIds.length > 0 && (
            <div className="rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Banco
              </p>
              <p className="mt-1 text-sm text-slate-300">
                {namesFor(current.benchIds)
                  .map((p) => p.name)
                  .join(" · ")}
              </p>
            </div>
          )}

          {!current.winner && (
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => markWinner("A")}
                className="rounded-xl border border-sky-500/30 bg-sky-500/10 py-2.5 text-sm font-semibold text-sky-300 transition active:scale-[0.98]"
              >
                🏆 Time A venceu
              </button>
              <button
                onClick={() => markWinner("B")}
                className="rounded-xl border border-violet-500/30 bg-violet-500/10 py-2.5 text-sm font-semibold text-violet-300 transition active:scale-[0.98]"
              >
                🏆 Time B venceu
              </button>
            </div>
          )}

          {current.winner && (
            <button
              onClick={sortear}
              className="w-full rounded-2xl bg-gradient-to-r from-orange-500 to-amber-400 py-3.5 text-base font-bold text-slate-950 shadow-xl shadow-orange-500/25 transition active:scale-[0.98]"
            >
              🎲 Sortear próximo set
            </button>
          )}
        </section>
      )}
    </div>
  );
}

function TeamCard({
  label,
  names,
  isWinner,
  accent,
}: {
  label: string;
  names: string[];
  isWinner: boolean;
  accent: "sky" | "violet";
}) {
  const accentClasses =
    accent === "sky"
      ? "from-sky-500/10 border-sky-500/20"
      : "from-violet-500/10 border-violet-500/20";

  return (
    <div
      className={`rounded-2xl border bg-gradient-to-br to-transparent p-4 shadow-lg shadow-black/10 ${accentClasses} ${
        isWinner ? "ring-2 ring-emerald-400/60" : ""
      }`}
    >
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-bold text-white">{label}</h3>
        {isWinner && <span className="text-lg">🏆</span>}
      </div>
      <ul className="space-y-1 text-sm text-slate-300">
        {names.map((n) => (
          <li key={n} className="truncate">
            {n}
          </li>
        ))}
      </ul>
    </div>
  );
}

function SorteioSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-6 w-40 animate-pulse rounded bg-white/[0.05]" />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-10 animate-pulse rounded-xl bg-white/[0.03]" />
        ))}
      </div>
      <div className="h-12 animate-pulse rounded-2xl bg-white/[0.03]" />
    </div>
  );
}
