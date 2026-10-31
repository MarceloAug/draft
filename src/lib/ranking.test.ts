import { expect, test } from "bun:test";
import { rankPlayers, withPositions, type WinRow } from "./ranking";

test("ties share a position", () => {
  const ranked = withPositions([{ wins: 5 }, { wins: 5 }, { wins: 3 }, { wins: 1 }, { wins: 1 }]);
  expect(ranked.map((r) => r.position)).toEqual([1, 1, 2, 3, 3]);
});

const row = (
  playerId: string,
  team: "A" | "B" | "BENCH",
  winner: "A" | "B" | null,
  dayId = "d1"
): WinRow => ({
  team,
  players: { id: playerId, name: playerId.toUpperCase() },
  rounds: { winner, game_day_id: dayId },
});

test("counts only players on the winning team", () => {
  const ranked = rankPlayers([
    row("ana", "A", "A"),
    row("bia", "B", "A"),
    row("caio", "BENCH", "A"),
    row("ana", "A", null),
    row("ana", "A", "A"),
  ]);
  expect(ranked).toEqual([{ id: "ana", name: "ANA", wins: 2, position: 1 }]);
});

test("filters by game days and shares positions on ties", () => {
  const rows = [
    row("ana", "A", "A", "d1"),
    row("bia", "A", "A", "d1"),
    row("caio", "B", "B", "d2"),
    row("caio", "B", "B", "d2"),
  ];
  expect(rankPlayers(rows, new Set(["d1"])).map((r) => [r.id, r.position])).toEqual([
    ["ana", 1],
    ["bia", 1],
  ]);
  expect(rankPlayers(rows).map((r) => [r.id, r.wins, r.position])).toEqual([
    ["caio", 2, 1],
    ["ana", 1, 2],
    ["bia", 1, 2],
  ]);
});

test("skips rows without player or round", () => {
  expect(
    rankPlayers([
      { team: "A", players: null, rounds: { winner: "A", game_day_id: "d1" } },
      { team: "A", players: { id: "x", name: "X" }, rounds: null },
    ])
  ).toEqual([]);
});
