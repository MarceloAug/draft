import type { Player } from "./types";

export function computeTeamSizes(n: number): { teamSize: number; bench: number } {
  const teamSize = Math.min(6, Math.floor(n / 2));
  return { teamSize, bench: n - teamSize * 2 };
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function pickBench(
  present: Player[],
  benchCount: number,
  alreadyRestedIds: Set<string>
): Player[] {
  if (benchCount === 0) return [];
  let candidates = present.filter((p) => !alreadyRestedIds.has(p.id));
  // everyone present already rested once today: reset the rotation cycle
  if (candidates.length < benchCount) candidates = present;
  return shuffle(candidates).slice(0, benchCount);
}

function balancedSplit(playing: Player[]): { teamA: Player[]; teamB: Player[] } {
  const women = shuffle(playing.filter((p) => p.gender === "F"));
  const men = shuffle(playing.filter((p) => p.gender === "M"));
  const teamA: Player[] = [];
  const teamB: Player[] = [];
  let turnA = Math.random() < 0.5;
  for (const p of [...women, ...men]) {
    (turnA ? teamA : teamB).push(p);
    turnA = !turnA;
  }
  return { teamA, teamB };
}

export function splitTeams(
  playing: Player[],
  previousTeamAIds?: Set<string>,
  maxAttempts = 20
): { teamA: Player[]; teamB: Player[] } {
  let result = balancedSplit(playing);
  if (!previousTeamAIds) return result;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const idsA = new Set(result.teamA.map((p) => p.id));
    const sameAsBefore =
      idsA.size === previousTeamAIds.size &&
      [...idsA].every((id) => previousTeamAIds.has(id));
    if (!sameAsBefore) break;
    result = balancedSplit(playing);
  }
  return result;
}

export function drawRound(
  present: Player[],
  alreadyRestedIds: Set<string>,
  previousTeamAIds?: Set<string>
) {
  const { teamSize, bench } = computeTeamSizes(present.length);
  const benchPlayers = pickBench(present, bench, alreadyRestedIds);
  const benchIds = new Set(benchPlayers.map((p) => p.id));
  const playing = present.filter((p) => !benchIds.has(p.id));
  const { teamA, teamB } = splitTeams(playing, previousTeamAIds);
  return { teamSize, teamA, teamB, bench: benchPlayers };
}
