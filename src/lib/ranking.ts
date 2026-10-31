// Dense ranking: players with the same wins share a position (5,5,3 -> 1,1,2).
export function withPositions<T extends { wins: number }>(sorted: T[]): (T & { position: number })[] {
  let position = 0;
  return sorted.map((r, i) => {
    if (i === 0 || r.wins !== sorted[i - 1].wins) position++;
    return { ...r, position };
  });
}

export interface WinRow {
  team: "A" | "B" | "BENCH";
  players: { id: string; name: string } | null;
  rounds: { winner: "A" | "B" | null; game_day_id: string } | null;
}

export interface RankedPlayer {
  id: string;
  name: string;
  wins: number;
  position: number;
}

// gameDayIds: count only those days; omitted = every day
export function rankPlayers(rows: WinRow[], gameDayIds?: Set<string>): RankedPlayer[] {
  const wins = new Map<string, { id: string; name: string; wins: number }>();
  for (const row of rows) {
    if (!row.players || !row.rounds || !row.rounds.winner) continue;
    if (row.team !== row.rounds.winner) continue;
    if (gameDayIds && !gameDayIds.has(row.rounds.game_day_id)) continue;
    const entry = wins.get(row.players.id) ?? {
      id: row.players.id,
      name: row.players.name,
      wins: 0,
    };
    entry.wins += 1;
    wins.set(row.players.id, entry);
  }
  return withPositions([...wins.values()].sort((a, b) => b.wins - a.wins));
}
