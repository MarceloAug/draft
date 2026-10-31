"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { formatDate, todayStr } from "@/lib/date";
import { buildListText } from "@/lib/listText";
import type { GameList } from "@/lib/types";

interface EntryRow {
  list_id: string;
  player_id: string;
  players: { name: string } | null;
}

export default function ListasPage() {
  const [lists, setLists] = useState<GameList[]>([]);
  const [entries, setEntries] = useState<EntryRow[]>([]);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(todayStr());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const [listsRes, entriesRes] = await Promise.all([
      supabase
        .from("game_lists")
        .select("id, title, date, closed, created_at")
        .order("date", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase
        .from("game_list_entries")
        .select("list_id, player_id, players(name)")
        .order("created_at"),
    ]);
    const firstError = listsRes.error ?? entriesRes.error;
    if (firstError) {
      setError(firstError.message);
      setLoading(false);
      return;
    }
    setLists(listsRes.data ?? []);
    setEntries((entriesRes.data as unknown as EntryRow[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const entriesOf = (listId: string) => entries.filter((e) => e.list_id === listId);

  async function createList(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed || !date) return;
    setError(null);
    setSaving(true);
    const { data, error } = await supabase
      .from("game_lists")
      .insert({ title: trimmed, date })
      .select("id")
      .single();
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setTitle("");
    setExpandedId(data.id);
    load();
  }

  async function removeEntry(listId: string, playerId: string) {
    const { error } = await supabase
      .from("game_list_entries")
      .delete()
      .eq("list_id", listId)
      .eq("player_id", playerId);
    if (error) setError(error.message);
    else load();
  }

  async function setClosed(listId: string, closed: boolean) {
    const { error } = await supabase.from("game_lists").update({ closed }).eq("id", listId);
    if (error) setError(error.message);
    else load();
  }

  async function copyText(list: GameList) {
    const url = `${window.location.origin}/lista/${list.id}`;
    const names = entriesOf(list.id).map((e) => e.players?.name ?? "?");
    try {
      await navigator.clipboard.writeText(buildListText(list.title, names, url));
      setCopiedId(list.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      setError(`Não foi possível copiar. Link da lista: ${url}`);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-white">Listas</h2>
        <p className="text-sm text-slate-400">Crie a lista do jogo e mande o link no grupo.</p>
      </div>

      <form
        onSubmit={createList}
        className="space-y-3 rounded-2xl border border-white/5 bg-white/[0.03] p-4 shadow-xl shadow-black/20 sm:p-5"
      >
        <h3 className="text-sm font-semibold text-slate-300">Nova lista</h3>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ex.: Jogo domingo 01/11"
          className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none ring-orange-500/50 focus:ring-2"
        />
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-3.5 py-2.5 text-sm text-white outline-none ring-orange-500/50 focus:ring-2"
        />
        <button
          type="submit"
          disabled={saving || !title.trim() || !date}
          className="w-full rounded-xl bg-gradient-to-r from-orange-500 to-amber-400 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-orange-500/25 transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Criando..." : "+ Criar lista"}
        </button>
      </form>

      {error && (
        <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-300">
          {error}
        </p>
      )}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-white/[0.03]" />
          ))}
        </div>
      ) : lists.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-10 text-center">
          <p className="text-3xl">📋</p>
          <p className="mt-2 text-sm text-slate-400">Nenhuma lista criada ainda.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {lists.map((list) => {
            const listEntries = entriesOf(list.id);
            const expanded = expandedId === list.id;
            return (
              <li
                key={list.id}
                className="overflow-hidden rounded-xl border border-white/5 bg-white/[0.03]"
              >
                <button
                  onClick={() => setExpandedId(expanded ? null : list.id)}
                  className="flex w-full items-center justify-between px-4 py-3.5 text-left"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-100">{list.title}</p>
                    <p className="text-xs capitalize text-slate-500">
                      {formatDate(list.date)} · {listEntries.length} confirmados
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        list.closed
                          ? "bg-emerald-500/15 text-emerald-400"
                          : "bg-orange-500/15 text-orange-400"
                      }`}
                    >
                      {list.closed ? "Encerrada" : "Aberta"}
                    </span>
                    <span className="text-slate-500">{expanded ? "▲" : "▼"}</span>
                  </div>
                </button>

                {expanded && (
                  <div className="space-y-3 border-t border-white/5 px-4 py-3">
                    {listEntries.length === 0 ? (
                      <p className="text-sm text-slate-500">Ninguém confirmou ainda.</p>
                    ) : (
                      <ol className="space-y-1">
                        {listEntries.map((e, i) => (
                          <li
                            key={e.player_id}
                            className="flex items-center justify-between gap-2 text-sm text-slate-200"
                          >
                            <span className="truncate">
                              <span className="text-slate-500">{i + 1}.</span>{" "}
                              {e.players?.name ?? "?"}
                            </span>
                            {!list.closed && (
                              <button
                                onClick={() => removeEntry(list.id, e.player_id)}
                                aria-label={`Remover ${e.players?.name ?? ""}`}
                                className="shrink-0 rounded-lg px-2 py-0.5 text-xs text-slate-500 transition hover:bg-red-500/10 hover:text-red-400"
                              >
                                ✕
                              </button>
                            )}
                          </li>
                        ))}
                      </ol>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => copyText(list)}
                        className="flex-1 rounded-lg bg-gradient-to-r from-orange-500 to-amber-400 px-3 py-2 text-xs font-bold text-slate-950 transition active:scale-[0.98]"
                      >
                        {copiedId === list.id ? "✓ Copiado!" : "📲 Copiar para o WhatsApp"}
                      </button>
                      <a
                        href={`/lista/${list.id}`}
                        className="rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold text-white"
                      >
                        Abrir link
                      </a>
                      <button
                        onClick={() => setClosed(list.id, !list.closed)}
                        className="rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold text-white"
                      >
                        {list.closed ? "Reabrir" : "Encerrar"}
                      </button>
                    </div>
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
