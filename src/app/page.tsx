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

  const names = (ids: string[]) =>
    ids.map((id) => playerById.get(id)?.name ?? "?").sort();

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

  if (loading) return <p className="text-slate-500 text-sm">Carregando...</p>;

  const current = rounds[rounds.length - 1];

  return (
    <div className="space-y-6">
      {error && <p className="text-red-600 text-sm">{error}</p>}

      <section className="space-y-2">
        <h2 className="font-semibold text-slate-700">
          Presença hoje ({attendingIds.size})
        </h2>
        {players.length === 0 ? (
          <p className="text-slate-500 text-sm">
            Cadastre jogadores na aba &quot;Jogadores&quot; primeiro.
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-2">
            {players.map((p) => (
              <li key={p.id}>
                <label className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 shadow-sm">
                  <input
                    type="checkbox"
                    checked={attendingIds.has(p.id)}
                    onChange={() => toggleAttendance(p.id)}
                  />
                  <span className="text-sm">
                    {p.name} <span className="text-slate-400">({p.gender === "M" ? "H" : "M"})</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </section>

      {(!current || current.winner) && (
        <button
          onClick={sortear}
          className="w-full rounded-lg bg-orange-600 text-white font-semibold py-3 active:bg-orange-700"
        >
          {current ? "Sortear próximo set" : "Sortear times"}
        </button>
      )}

      {current && (
        <section className="space-y-3">
          <h2 className="font-semibold text-slate-700">Set {current.round_number}</h2>
          <div className="grid grid-cols-2 gap-3">
            <TeamCard
              label="Time A"
              names={names(current.teamAIds)}
              isWinner={current.winner === "A"}
            />
            <TeamCard
              label="Time B"
              names={names(current.teamBIds)}
              isWinner={current.winner === "B"}
            />
          </div>
          {current.benchIds.length > 0 && (
            <p className="text-sm text-slate-500">
              Banco: {names(current.benchIds).join(", ")}
            </p>
          )}
          {!current.winner && (
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => markWinner("A")}
                className="rounded-lg bg-slate-800 text-white font-medium py-2 active:bg-slate-900"
              >
                Time A venceu
              </button>
              <button
                onClick={() => markWinner("B")}
                className="rounded-lg bg-slate-800 text-white font-medium py-2 active:bg-slate-900"
              >
                Time B venceu
              </button>
            </div>
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
}: {
  label: string;
  names: string[];
  isWinner: boolean;
}) {
  return (
    <div
      className={`rounded-xl p-3 shadow-sm ${
        isWinner ? "bg-green-100 ring-2 ring-green-500" : "bg-white"
      }`}
    >
      <h3 className="font-semibold mb-1">
        {label} {isWinner && "🏆"}
      </h3>
      <ul className="text-sm space-y-0.5">
        {names.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>
    </div>
  );
}
