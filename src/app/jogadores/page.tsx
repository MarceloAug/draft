"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { Gender, Player } from "@/lib/types";

export default function JogadoresPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [name, setName] = useState("");
  const [gender, setGender] = useState<Gender>("M");
  const [loading, setLoading] = useState(true);
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
    const { error } = await supabase.from("players").insert({ name: trimmed, gender });
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

  return (
    <div className="space-y-6">
      <form onSubmit={addPlayer} className="space-y-3 bg-white rounded-xl p-4 shadow-sm">
        <h2 className="font-semibold text-slate-700">Novo jogador</h2>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome"
          className="w-full rounded-lg border border-slate-300 px-3 py-2"
        />
        <div className="flex gap-4">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={gender === "M"}
              onChange={() => setGender("M")}
            />
            Homem
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={gender === "F"}
              onChange={() => setGender("F")}
            />
            Mulher
          </label>
        </div>
        <button
          type="submit"
          className="w-full rounded-lg bg-orange-600 text-white font-medium py-2 active:bg-orange-700"
        >
          Adicionar
        </button>
      </form>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <div className="space-y-2">
        <h2 className="font-semibold text-slate-700">
          Jogadores cadastrados ({players.length})
        </h2>
        {loading ? (
          <p className="text-slate-500 text-sm">Carregando...</p>
        ) : players.length === 0 ? (
          <p className="text-slate-500 text-sm">Nenhum jogador cadastrado ainda.</p>
        ) : (
          <ul className="divide-y divide-slate-200 bg-white rounded-xl shadow-sm overflow-hidden">
            {players.map((p) => (
              <li key={p.id} className="flex items-center justify-between px-4 py-3">
                <span>
                  {p.name}{" "}
                  <span className="text-slate-400 text-sm">
                    ({p.gender === "M" ? "H" : "M"})
                  </span>
                </span>
                <button
                  onClick={() => removePlayer(p.id)}
                  className="text-red-600 text-sm font-medium"
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
