import { describe, expect, it } from "vitest";
import { DECK_LIMIT, isDeckFull } from "@/src/modules/deck/domain/rules";

describe("isDeckFull", () => {
  it("é falso abaixo do limite e verdadeiro a partir dele", () => {
    expect(isDeckFull(DECK_LIMIT - 1)).toBe(false);
    expect(isDeckFull(DECK_LIMIT)).toBe(true);
  });

  // >= e não ===: se uma corrida antiga deixou 7 no deck, o botão continua
  // travado em vez de destravar e deixar entrar o 8º.
  it("continua cheio se de alguma forma passou do limite", () => {
    expect(isDeckFull(DECK_LIMIT + 1)).toBe(true);
  });
});
