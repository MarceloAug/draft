export type Gender = "M" | "F";

export interface Player {
  id: string;
  name: string;
  gender: Gender;
}

export type Team = "A" | "B" | "BENCH";

export interface Round {
  id: string;
  game_day_id: string;
  round_number: number;
  winner: "A" | "B" | null;
}
