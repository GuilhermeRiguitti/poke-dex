import { describe, expect, it } from "vitest";
import {
  expiryLabel,
  formatTradeCode,
  toTradeOfferView,
  tradeErrorLabel,
} from "@/src/modules/trade/ui/tradeView";
import { isValidCodeShape, normalizeTradeCode } from "@/src/modules/trade/domain/tradeCode";

describe("formatTradeCode", () => {
  it("quebra em blocos de 4 só pra leitura", () => {
    expect(formatTradeCode("A2B4C6D8")).toBe("A2B4-C6D8");
  });

  it("o hífen que ele adiciona é desfeito pela normalização do domínio", () => {
    // Se essas duas funções divergirem, o jogador que copia o código da tela
    // recebe "código inválido" — o pior erro possível nesta feature.
    const bonito = formatTradeCode("A2B4C6D8");
    expect(isValidCodeShape(normalizeTradeCode(bonito))).toBe(true);
    expect(normalizeTradeCode(bonito)).toBe("A2B4C6D8");
  });
});

describe("expiryLabel", () => {
  it("mostra horas quando falta mais de uma", () => {
    expect(expiryLabel(3 * 60 * 60 * 1000)).toBe("expira em 3 h");
  });

  it("mostra minutos abaixo de uma hora", () => {
    expect(expiryLabel(25 * 60 * 1000)).toBe("expira em 25 min");
  });

  it("nunca mostra '0 min' — arredonda pra 1 enquanto ainda dá tempo", () => {
    expect(expiryLabel(30 * 1000)).toBe("expira em 1 min");
  });

  it("zero e negativo viram 'expirando'", () => {
    expect(expiryLabel(0)).toBe("expirando");
    expect(expiryLabel(-1)).toBe("expirando");
  });
});

describe("toTradeOfferView", () => {
  const offer = {
    id: "offer-1",
    code: "A2B4C6D8",
    expiresInMs: 3 * 60 * 60 * 1000,
    card: {
      userPokemonId: "up-1",
      pokemonId: 25,
      level: 12,
      xp: 1728,
      bst: 320,
      rarity: "common" as const,
      baseStats: { hp: 35, atk: 55, def: 40, spa: 50, spd: 50, spe: 90 },
      pokemon: {
        id: 25,
        name: "pikachu",
        artworkUrl: "https://img/25.png",
        iconUrl: "https://img/25.png",
        types: ["electric"],
      },
    },
  };

  it("guarda o código CRU separado do bonito — é o cru que vai pro clipboard", () => {
    const view = toTradeOfferView(offer);
    expect(view.displayCode).toBe("A2B4-C6D8");
    expect(view.rawCode).toBe("A2B4C6D8");
  });

  it("marca como 'expirando logo' abaixo de 1h, pra tela poder destacar", () => {
    expect(toTradeOfferView(offer).expiringSoon).toBe(false);
    expect(toTradeOfferView({ ...offer, expiresInMs: 59 * 60 * 1000 }).expiringSoon).toBe(true);
  });

  it("aguenta espécie ausente sem quebrar a tela", () => {
    const view = toTradeOfferView({ ...offer, card: { ...offer.card, pokemon: null } });
    expect(view.name).toBe("?");
    expect(view.spriteUrl).toBeNull();
  });
});

describe("tradeErrorLabel", () => {
  it("mantém 'código inválido' igualmente vago pra vencido e já aceito", () => {
    // O servidor não distingue de propósito; se a UI distinguisse, desfaria no
    // cliente exatamente o que o servidor escondeu.
    expect(tradeErrorLabel("invalid_code")).toBe("Código inválido ou expirado.");
    expect(tradeErrorLabel("qualquer_coisa_nova")).toBe("Código inválido ou expirado.");
  });

  it("explica o que o jogador consegue resolver", () => {
    expect(tradeErrorLabel("in_deck")).toContain("time");
    expect(tradeErrorLabel("in_battle")).toContain("partida");
  });
});
