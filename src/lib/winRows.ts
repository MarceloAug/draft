import { supabase } from "./supabaseClient";
import type { WinRow } from "./ranking";

// PostgREST silently caps a response at 1000 rows, so page through round_players
const PAGE_SIZE = 1000;

export async function fetchWinRows(): Promise<{ rows: WinRow[]; error: string | null }> {
  const rows: WinRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("round_players")
      .select("team, players(id, name), rounds(winner, game_day_id)")
      .order("round_id")
      .order("player_id")
      .range(from, from + PAGE_SIZE - 1);
    if (error) return { rows, error: error.message };
    rows.push(...((data as unknown as WinRow[]) ?? []));
    if (!data || data.length < PAGE_SIZE) return { rows, error: null };
  }
}
