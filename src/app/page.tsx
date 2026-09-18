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
  const [busy, setBusy] = useState<null | "sortear" | "A" | "B" | "swap">(null);
  const [editMode, setEditMode] = useState(false);
  const [swapSelection, setSwapSelection] = useState<string | null>(null);

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

  const playersFor = (ids: string[]) =>
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
    if (!confirm("Sortear os times agora?")) return;
    setError(null);
    setBusy("sortear");
    try {
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
    } finally {
      setBusy(null);
    }
  }

  async function markWinner(team: "A" | "B") {
    const current = rounds[rounds.length - 1];
    if (!current) return;
    if (!confirm(`Confirma que o Time ${team} venceu?`)) return;
    setBusy(team);
    try {
      const { error } = await supabase
        .from("rounds")
        .update({ winner: team })
        .eq("id", current.id);
      if (error) {
        setError(error.message);
        return;
      }
      setRounds(rounds.map((r) => (r.id === current.id ? { ...r, winner: team } : r)));
    } finally {
      setBusy(null);
    }
  }

  function locateTeam(round: RoundState, playerId: string): "A" | "B" | "BENCH" | null {
    if (round.teamAIds.includes(playerId)) return "A";
    if (round.teamBIds.includes(playerId)) return "B";
    if (round.benchIds.includes(playerId)) return "BENCH";
    return null;
  }

  async function swapPlayers(idA: string, idB: string) {
    const current = rounds[rounds.length - 1];
    if (!current || idA === idB) return;
    const teamOfA = locateTeam(current, idA);
    const teamOfB = locateTeam(current, idB);
    if (!teamOfA || !teamOfB || teamOfA === teamOfB) return;

    setError(null);
    setBusy("swap");
    try {
      const [{ error: errA }, { error: errB }] = await Promise.all([
        supabase
          .from("round_players")
          .update({ team: teamOfB })
          .eq("round_id", current.id)
          .eq("player_id", idA),
        supabase
          .from("round_players")
          .update({ team: teamOfA })
          .eq("round_id", current.id)
          .eq("player_id", idB),
      ]);
      if (errA || errB) {
        setError((errA ?? errB)!.message);
        return;
      }
      setRounds(
        rounds.map((r) => {
          if (r.id !== current.id) return r;
          const remove = (arr: string[], id: string) => arr.filter((x) => x !== id);
          let teamAIds = remove(r.teamAIds, idA);
          let teamBIds = remove(r.teamBIds, idB);
          let benchIds = r.benchIds;
          teamAIds = remove(teamAIds, idB);
          teamBIds = remove(teamBIds, idA);
          benchIds = remove(remove(benchIds, idA), idB);
          const addTo = (team: "A" | "B" | "BENCH", id: string) => {
            if (team === "A") teamAIds = [...teamAIds, id];
            else if (team === "B") teamBIds = [...teamBIds, id];
            else benchIds = [...benchIds, id];
          };
          addTo(teamOfB, idA);
          addTo(teamOfA, idB);
          return { ...r, teamAIds, teamBIds, benchIds };
        })
      );
    } finally {
      setBusy(null);
      setSwapSelection(null);
    }
  }

  function handlePlayerTap(playerId: string) {
    if (!editMode || busy) return;
    if (swapSelection === null) {
      setSwapSelection(playerId);
      return;
    }
    if (swapSelection === playerId) {
      setSwapSelection(null);
      return;
    }
    const nameA = playerById.get(swapSelection)?.name ?? "?";
    const nameB = playerById.get(playerId)?.name ?? "?";
    if (!confirm(`Trocar ${nameA} com ${nameB}?`)) {
      setSwapSelection(null);
      return;
    }
    swapPlayers(swapSelection, playerId);
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
          disabled={busy !== null}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-400 py-3.5 text-base font-bold text-slate-950 shadow-xl shadow-orange-500/25 transition active:scale-[0.98] disabled:opacity-60"
        >
          {busy === "sortear" ? (
            <>
              <Spinner /> Sorteando...
            </>
          ) : (
            "🎲 Sortear times"
          )}
        </button>
      )}

      {current && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold tracking-tight text-white">
              Set {current.round_number}
            </h2>
            {current.winner ? (
              <span className="text-xs font-semibold text-emerald-400">Encerrado ✓</span>
            ) : (
              <button
                onClick={() => {
                  setEditMode((v) => !v);
                  setSwapSelection(null);
                }}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  editMode
                    ? "bg-orange-500 text-white"
                    : "bg-white/5 text-slate-400 hover:text-white"
                }`}
              >
                {editMode ? "✕ Cancelar" : "✏️ Trocar"}
              </button>
            )}
          </div>

          {editMode && (
            <p className="text-xs text-slate-400">
              Toque em 2 jogadores (times ou banco) pra trocar de lugar.
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <TeamCard
              label="Time A"
              accent="sky"
              players={playersFor(current.teamAIds)}
              isWinner={current.winner === "A"}
              editMode={editMode}
              selectedId={swapSelection}
              onSelect={handlePlayerTap}
            />
            <TeamCard
              label="Time B"
              accent="violet"
              players={playersFor(current.teamBIds)}
              isWinner={current.winner === "B"}
              editMode={editMode}
              selectedId={swapSelection}
              onSelect={handlePlayerTap}
            />
          </div>

          {current.benchIds.length > 0 && (
            <div className="rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3">
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Banco
              </p>
              <div className="flex flex-wrap gap-1.5">
                {playersFor(current.benchIds).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    disabled={!editMode}
                    onClick={() => handlePlayerTap(p.id)}
                    className={`rounded-full px-2.5 py-1 text-sm transition ${
                      swapSelection === p.id
                        ? "bg-orange-500 text-white"
                        : editMode
                          ? "bg-white/10 text-slate-200 hover:bg-white/20"
                          : "text-slate-300"
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!current.winner && (
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => markWinner("A")}
                disabled={busy !== null}
                className="flex items-center justify-center gap-2 rounded-xl border border-sky-500/30 bg-sky-500/10 py-2.5 text-sm font-semibold text-sky-300 transition active:scale-[0.98] disabled:opacity-60"
              >
                {busy === "A" ? (
                  <>
                    <Spinner /> Salvando...
                  </>
                ) : (
                  "🏆 Time A venceu"
                )}
              </button>
              <button
                onClick={() => markWinner("B")}
                disabled={busy !== null}
                className="flex items-center justify-center gap-2 rounded-xl border border-violet-500/30 bg-violet-500/10 py-2.5 text-sm font-semibold text-violet-300 transition active:scale-[0.98] disabled:opacity-60"
              >
                {busy === "B" ? (
                  <>
                    <Spinner /> Salvando...
                  </>
                ) : (
                  "🏆 Time B venceu"
                )}
              </button>
            </div>
          )}

          {current.winner && (
            <button
              onClick={sortear}
              disabled={busy !== null}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-400 py-3.5 text-base font-bold text-slate-950 shadow-xl shadow-orange-500/25 transition active:scale-[0.98] disabled:opacity-60"
            >
              {busy === "sortear" ? (
                <>
                  <Spinner /> Sorteando...
                </>
              ) : (
                "🎲 Sortear próximo set"
              )}
            </button>
          )}
        </section>
      )}
    </div>
  );
}

function TeamCard({
  label,
  players,
  isWinner,
  accent,
  editMode,
  selectedId,
  onSelect,
}: {
  label: string;
  players: Player[];
  isWinner: boolean;
  accent: "sky" | "violet";
  editMode: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
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
      <ul className="space-y-1 text-sm">
        {players.map((p) => (
          <li key={p.id}>
            {editMode ? (
              <button
                type="button"
                onClick={() => onSelect(p.id)}
                className={`w-full truncate rounded-lg px-1.5 py-0.5 text-left transition ${
                  selectedId === p.id
                    ? "bg-orange-500 text-white"
                    : "text-slate-300 hover:bg-white/10"
                }`}
              >
                {p.name}
              </button>
            ) : (
              <span className="block truncate text-slate-300">{p.name}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Spinner() {
  return (
    <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent" />
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
