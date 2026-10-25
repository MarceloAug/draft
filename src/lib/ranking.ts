// Dense ranking: players with the same wins share a position (5,5,3 -> 1,1,2).
export function withPositions<T extends { wins: number }>(sorted: T[]): (T & { position: number })[] {
  let position = 0;
  return sorted.map((r, i) => {
    if (i === 0 || r.wins !== sorted[i - 1].wins) position++;
    return { ...r, position };
  });
}
