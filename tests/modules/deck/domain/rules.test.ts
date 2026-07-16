import { describe, expect, it } from "vitest";
import { DECK_LIMIT, canToggleIntoDeck, isDeckFull } from "@/src/modules/deck/domain/rules";

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

describe("canToggleIntoDeck", () => {
  it("deixa entrar enquanto houver vaga", () => {
    expect(canToggleIntoDeck(0, false)).toBe(true);
    expect(canToggleIntoDeck(DECK_LIMIT - 1, false)).toBe(true);
  });

  it("barra quem está de fora quando o deck está cheio", () => {
    expect(canToggleIntoDeck(DECK_LIMIT, false)).toBe(false);
  });

  // O caso que a implementação ingênua (só `!isDeckFull`) erra: com o deck
  // cheio, TODOS os botões ficariam desabilitados — inclusive os dos 6 que já
  // estão no deck. O jogador não conseguiria mais TIRAR ninguém, e ficaria
  // preso num time que não pode editar.
  it("deixa quem já está no deck sair, mesmo com o deck cheio", () => {
    expect(canToggleIntoDeck(DECK_LIMIT, true)).toBe(true);
  });
});
