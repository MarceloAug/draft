import { expect, test } from "bun:test";
import { withPositions } from "./ranking";

test("ties share a position", () => {
  const ranked = withPositions([{ wins: 5 }, { wins: 5 }, { wins: 3 }, { wins: 1 }, { wins: 1 }]);
  expect(ranked.map((r) => r.position)).toEqual([1, 1, 2, 3, 3]);
});
