"use client";

import { useCallback, useEffect, useState } from "react";
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

  const load = useCallback(async () => {
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
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

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
