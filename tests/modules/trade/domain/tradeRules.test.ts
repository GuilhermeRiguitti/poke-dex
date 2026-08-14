import { describe, expect, it } from "vitest";
import { canOffer } from "@/src/modules/trade/domain/tradeRules";

const livre = { inDeck: false, inLiveBattle: false, alreadyOffered: false };

describe("canOffer", () => {
  it("libera a carta que não está presa em nada", () => {
    expect(canOffer(livre)).toBe("ok");
  });

  it("barra carta montada no time", () => {
    expect(canOffer({ ...livre, inDeck: true })).toBe("in_deck");
  });

  it("barra carta em partida em andamento", () => {
    // Se passasse, o XP do fim da partida seria creditado ao NOVO dono, que não
    // jogou — o BattlePokemon guarda o userPokemonId por valor, sem FK.
    expect(canOffer({ ...livre, inLiveBattle: true })).toBe("in_battle");
  });

  it("barra carta que já tem oferta viva", () => {
    expect(canOffer({ ...livre, alreadyOffered: true })).toBe("already_offered");
  });

  it("reclama primeiro do que o jogador resolve na hora", () => {
    // Tirar do deck é um clique; esperar a partida acabar não é. Com os dois
    // problemas juntos, apontar o deck dá o caminho mais curto pra oferta sair.
    expect(canOffer({ inDeck: true, inLiveBattle: true, alreadyOffered: false })).toBe("in_deck");
    // Mas "já ofertada" vem antes de tudo: não há o que consertar, já está feito.
    expect(canOffer({ inDeck: true, inLiveBattle: true, alreadyOffered: true })).toBe(
      "already_offered",
    );
  });
});
