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

function buildTeamAWithGroup(playing: Player[], group: Player[], teamSize: number): Player[] {
  const groupIds = new Set(group.map((p) => p.id));
  const pool = playing.filter((p) => !groupIds.has(p.id));
  const totalWomen = playing.filter((p) => p.gender === "F").length;
  const groupWomen = group.filter((p) => p.gender === "F").length;
  const slotsLeft = teamSize - group.length;

  const targetWomenA = Math.round(totalWomen / 2);
  const womenNeeded = Math.min(Math.max(targetWomenA - groupWomen, 0), slotsLeft);

  const poolWomen = shuffle(pool.filter((p) => p.gender === "F"));
  const poolMen = shuffle(pool.filter((p) => p.gender === "M"));

  const fillWomen = poolWomen.slice(0, womenNeeded);
  const fillMen = poolMen.slice(0, slotsLeft - fillWomen.length);
  let fill = [...fillWomen, ...fillMen];
  if (fill.length < slotsLeft) {
    // one gender ran out in the pool: top up with whatever's left
    const usedIds = new Set(fill.map((p) => p.id));
    const leftovers = shuffle(pool.filter((p) => !usedIds.has(p.id)));
    fill = [...fill, ...leftovers.slice(0, slotsLeft - fill.length)];
  }
  return [...group, ...fill];
}

function splitKeepingGroupTogether(
  playing: Player[],
  group: Player[],
  teamSize: number,
  previousTeamAIds?: Set<string>,
  maxAttempts = 20
): { teamA: Player[]; teamB: Player[] } {
  let teamA = buildTeamAWithGroup(playing, group, teamSize);
  if (previousTeamAIds) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const idsA = new Set(teamA.map((p) => p.id));
      const sameAsBefore =
        idsA.size === previousTeamAIds.size &&
        [...idsA].every((id) => previousTeamAIds.has(id));
      if (!sameAsBefore) break;
      teamA = buildTeamAWithGroup(playing, group, teamSize);
    }
  }
  const idsA = new Set(teamA.map((p) => p.id));
  const teamB = playing.filter((p) => !idsA.has(p.id));
  return { teamA, teamB };
}

export function drawRound(
  present: Player[],
  alreadyRestedIds: Set<string>,
  previousTeamAIds?: Set<string>,
  previousBenchIds?: Set<string>
) {
  const { teamSize, bench } = computeTeamSizes(present.length);
  const benchPlayers = pickBench(present, bench, alreadyRestedIds);
  const benchIds = new Set(benchPlayers.map((p) => p.id));
  const playing = present.filter((p) => !benchIds.has(p.id));

  const returning = previousBenchIds
    ? playing.filter((p) => previousBenchIds.has(p.id))
    : [];

  // ponytail: if the returning group is bigger than one team, it can't be
  // kept together — fall back to the plain balanced split.
  const { teamA, teamB } =
    returning.length > 0 && returning.length <= teamSize
      ? splitKeepingGroupTogether(playing, returning, teamSize, previousTeamAIds)
      : splitTeams(playing, previousTeamAIds);

  return { teamSize, teamA, teamB, bench: benchPlayers };
}
