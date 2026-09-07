"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { Gender, Player } from "@/lib/types";

export default function JogadoresPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [name, setName] = useState("");
  const [gender, setGender] = useState<Gender>("M");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("players")
      .select("id, name, gender")
      .order("name");
    if (error) setError(error.message);
    else setPlayers(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function addPlayer(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setError(null);
    setSaving(true);
    const { error } = await supabase.from("players").insert({ name: trimmed, gender });
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setName("");
    load();
  }

  async function removePlayer(id: string) {
    if (!confirm("Remover este jogador?")) return;
    const { error } = await supabase.from("players").delete().eq("id", id);
    if (error) setError(error.message);
    else load();
  }

  const women = players.filter((p) => p.gender === "F").length;
  const men = players.length - women;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-white">Jogadores</h2>
        <p className="text-sm text-slate-400">Cadastro do elenco do time.</p>
      </div>

      <form
        onSubmit={addPlayer}
        className="space-y-4 rounded-2xl border border-white/5 bg-white/[0.03] p-4 shadow-xl shadow-black/20 sm:p-5"
      >
        <h3 className="text-sm font-semibold text-slate-300">Novo jogador</h3>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome do jogador"
          className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none ring-orange-500/50 focus:ring-2"
        />
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-900/60 p-1">
          <GenderOption label="Homem" active={gender === "M"} onClick={() => setGender("M")} />
          <GenderOption label="Mulher" active={gender === "F"} onClick={() => setGender("F")} />
        </div>
        <button
          type="submit"
          disabled={saving || !name.trim()}
          className="w-full rounded-xl bg-gradient-to-r from-orange-500 to-amber-400 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-orange-500/25 transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Adicionando..." : "+ Adicionar jogador"}
        </button>
      </form>

      {error && (
        <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-300">
          {error}
        </p>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-300">
            Elenco ({players.length})
          </h3>
          {players.length > 0 && (
            <p className="text-xs text-slate-500">
              {men} homens · {women} mulheres
            </p>
          )}
        </div>

        {loading ? (
          <SkeletonList />
        ) : players.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {players.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.03] px-3.5 py-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-bold ${
                      p.gender === "F"
                        ? "bg-pink-500/15 text-pink-300"
                        : "bg-sky-500/15 text-sky-300"
                    }`}
                  >
                    {p.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="truncate text-sm font-medium text-slate-200">
                    {p.name}
                  </span>
                </div>
                <button
                  onClick={() => removePlayer(p.id)}
                  className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-slate-500 transition hover:bg-red-500/10 hover:text-red-400"
                >
                  Remover
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
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

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-10 text-center">
      <p className="text-3xl">🏐</p>
      <p className="mt-2 text-sm text-slate-400">Nenhum jogador cadastrado ainda.</p>
    </div>
  );
}

function SkeletonList() {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-[54px] animate-pulse rounded-xl bg-white/[0.03]" />
      ))}
    </div>
  );
}
