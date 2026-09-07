import { describe, expect, test } from "bun:test";
import { computeTeamSizes, pickBench, drawRound } from "./draw";
import type { Player } from "./types";

function makePlayers(n: number, women: number): Player[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    name: `Player ${i}`,
    gender: i < women ? "F" : "M",
  }));
}

describe("computeTeamSizes", () => {
  test("even up to 12: no bench", () => {
    expect(computeTeamSizes(10)).toEqual({ teamSize: 5, bench: 0 });
    expect(computeTeamSizes(12)).toEqual({ teamSize: 6, bench: 0 });
  });
  test("odd: 1 rests", () => {
    expect(computeTeamSizes(11)).toEqual({ teamSize: 5, bench: 1 });
    expect(computeTeamSizes(13)).toEqual({ teamSize: 6, bench: 1 });
  });
  test("14+: capped at 6x6, rest benched", () => {
    expect(computeTeamSizes(14)).toEqual({ teamSize: 6, bench: 2 });
    expect(computeTeamSizes(16)).toEqual({ teamSize: 6, bench: 4 });
  });
});

describe("pickBench", () => {
  test("does not repeat someone already rested today until everyone has", () => {
    const players = makePlayers(13, 5);
    const rested = new Set(["p0", "p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8", "p9", "p10", "p11"]);
    // 12 of 13 already rested; only p12 hasn't -> must be picked
    const bench = pickBench(players, 1, rested);
    expect(bench.map((p) => p.id)).toEqual(["p12"]);
  });
  test("resets the cycle once everyone has rested", () => {
    const players = makePlayers(13, 5);
    const allRested = new Set(players.map((p) => p.id));
    const bench = pickBench(players, 1, allRested);
    expect(bench.length).toBe(1);
  });
});

describe("drawRound", () => {
  test("splits into two teams with gender diff of at most 1", () => {
    const players = makePlayers(12, 5);
    const { teamA, teamB, bench } = drawRound(players, new Set());
    expect(bench.length).toBe(0);
    expect(teamA.length).toBe(6);
    expect(teamB.length).toBe(6);
    const womenA = teamA.filter((p) => p.gender === "F").length;
    const womenB = teamB.filter((p) => p.gender === "F").length;
    expect(Math.abs(womenA - womenB)).toBeLessThanOrEqual(1);
  });

  test("avoids repeating the exact same team A split", () => {
    const players = makePlayers(10, 4);
    const first = drawRound(players, new Set());
    const previousTeamAIds = new Set(first.teamA.map((p) => p.id));
    const second = drawRound(players, new Set(), previousTeamAIds);
    const idsA = new Set(second.teamA.map((p) => p.id));
    const same =
      idsA.size === previousTeamAIds.size &&
      [...idsA].every((id) => previousTeamAIds.has(id));
    expect(same).toBe(false);
  });
});
