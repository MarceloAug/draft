"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { todayStr } from "@/lib/date";
import { rankPlayers, type WinRow } from "@/lib/ranking";
import { fetchWinRows } from "@/lib/winRows";

const medals = ["🥇", "🥈", "🥉"];

export default function RankingPage() {
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

  const maxWins = ranking[0]?.wins ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-white">Ranking</h2>
        <p className="text-sm text-slate-400">Quem mais venceu sets.</p>
      </div>

      <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-900/60 p-1">
        <ScopeButton label="Hoje" active={scope === "hoje"} onClick={() => setScope("hoje")} />
        <ScopeButton label="Geral" active={scope === "geral"} onClick={() => setScope("geral")} />
      </div>

      {error && (
        <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-300">
          {error}
        </p>
      )}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl bg-white/[0.03]" />
          ))}
        </div>
      ) : ranking.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-10 text-center">
          <p className="text-3xl">🏆</p>
          <p className="mt-2 text-sm text-slate-400">Nenhuma vitória registrada ainda.</p>
        </div>
      ) : (
        <ol className="space-y-2">
          {ranking.map((r) => (
            <li
              key={r.id}
              className={`flex items-center gap-3 rounded-xl border px-4 py-3.5 ${
                r.position === 1
                  ? "border-amber-400/30 bg-amber-400/5"
                  : "border-white/5 bg-white/[0.03]"
              }`}
            >
              <span className="w-6 shrink-0 text-center text-lg">
                {medals[r.position - 1] ?? (
                  <span className="text-sm text-slate-500">{r.position}º</span>
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm font-semibold text-slate-100">
                    {r.name}
                  </span>
                  <span className="shrink-0 text-sm font-bold text-orange-400">
                    {r.wins} {r.wins === 1 ? "vitória" : "vitórias"}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-400"
                    style={{ width: `${maxWins ? (r.wins / maxWins) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function ScopeButton({
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
      onClick={onClick}
      className={`rounded-lg py-2 text-sm font-semibold transition ${
        active ? "bg-orange-500 text-white shadow shadow-orange-500/30" : "text-slate-400"
      }`}
    >
      {label}
    </button>
  );
}
