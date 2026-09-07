"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { todayStr } from "@/lib/date";

interface WinRow {
  team: "A" | "B" | "BENCH";
  players: { id: string; name: string } | null;
  rounds: { winner: "A" | "B" | null; game_day_id: string } | null;
}

export default function RankingPage() {
  const [rows, setRows] = useState<WinRow[]>([]);
  const [todayId, setTodayId] = useState<string | null>(null);
  const [scope, setScope] = useState<"hoje" | "geral">("geral");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data: day } = await supabase
      .from("game_days")
      .select("id")
      .eq("date", todayStr())
      .maybeSingle();
    setTodayId(day?.id ?? null);

    const { data } = await supabase
      .from("round_players")
      .select("team, players(id, name), rounds(winner, game_day_id)");
    setRows((data as unknown as WinRow[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const ranking = useMemo(() => {
    const wins = new Map<string, { name: string; wins: number }>();
    for (const row of rows) {
      if (!row.players || !row.rounds || !row.rounds.winner) continue;
      if (row.team !== row.rounds.winner) continue;
      if (scope === "hoje" && row.rounds.game_day_id !== todayId) continue;
      const entry = wins.get(row.players.id) ?? { name: row.players.name, wins: 0 };
      entry.wins += 1;
      wins.set(row.players.id, entry);
    }
    return [...wins.values()].sort((a, b) => b.wins - a.wins);
  }, [rows, scope, todayId]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setScope("hoje")}
          className={`rounded-lg py-2 font-medium ${
            scope === "hoje" ? "bg-orange-600 text-white" : "bg-white text-slate-600"
          }`}
        >
          Hoje
        </button>
        <button
          onClick={() => setScope("geral")}
          className={`rounded-lg py-2 font-medium ${
            scope === "geral" ? "bg-orange-600 text-white" : "bg-white text-slate-600"
          }`}
        >
          Geral
        </button>
      </div>

      {loading ? (
        <p className="text-slate-500 text-sm">Carregando...</p>
      ) : ranking.length === 0 ? (
        <p className="text-slate-500 text-sm">Nenhuma vitória registrada ainda.</p>
      ) : (
        <ol className="bg-white rounded-xl shadow-sm divide-y divide-slate-200">
          {ranking.map((r, i) => (
            <li key={r.name} className="flex items-center justify-between px-4 py-3">
              <span>
                <span className="text-slate-400 mr-2">{i + 1}º</span>
                {r.name}
              </span>
              <span className="font-semibold">{r.wins}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
