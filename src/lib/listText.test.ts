import { expect, test } from "bun:test";
import { buildListText } from "./listText";

test("numbers names and appends the link", () => {
  expect(buildListText("Jogo domingo 01/11", ["Rony", "Joel"], "https://x/lista/1")).toBe(
    "🏐 Jogo domingo 01/11\n1. Rony\n2. Joel\n\nConfirme aqui: https://x/lista/1"
  );
});

test("empty list still has title and link", () => {
  expect(buildListText("Jogo sábado", [], "https://x/lista/2")).toBe(
    "🏐 Jogo sábado\n\nConfirme aqui: https://x/lista/2"
  );
});
