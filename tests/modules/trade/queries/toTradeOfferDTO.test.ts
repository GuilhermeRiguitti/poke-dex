import { describe, expect, it } from "vitest";
import { toTradeOfferDTO } from "@/src/modules/trade/queries/toTradeOfferDTO";

// O mapper existe pra UMA coisa: o DTO da troca não pode carregar identidade de
// jogador. O jogo inteiro mantém o outro anônimo (nem na batalha o nome do
// oponente aparece) — se `fromUserId` vazasse aqui, a decisão de desenho da
// troca por código morreria calada.

const NOW = new Date("2026-08-14T12:00:00.000Z");

function linha(overrides: Record<string, unknown> = {}) {
  return {
    id: "offer-1",
    code: "A2B4C6D8",
    expiresAt: new Date(NOW.getTime() + 3 * 60 * 60 * 1000),
    userPokemon: {
      id: "up-1",
      level: 12,
      xp: 1728,
      pokemon: {
        pokemonApiId: 25,
        name: "pikachu",
        spriteUrl: "https://img/25.png",
        types: ["electric"],
        baseStats: { hp: 35, atk: 55, def: 40, spa: 50, spd: 50, spe: 90 },
        bst: 320,
        rarity: "common",
      },
    },
    // Campos que a linha crua carregaria se alguém trocasse o select por um
    // spread. NÃO podem sair no DTO.
    fromUserId: "user-doador-123",
    createdAt: NOW,
    ...overrides,
  } as Parameters<typeof toTradeOfferDTO>[0];
}

describe("toTradeOfferDTO", () => {
  it("não vaza a identidade de quem ofereceu", () => {
    const dto = toTradeOfferDTO(linha(), NOW);
    const json = JSON.stringify(dto);

    expect(json).not.toContain("fromUserId");
    expect(json).not.toContain("user-doador-123");
    expect(json).not.toContain("toUserId");
    // Nada que pareça email pode estar aqui — a troca não expõe contato.
    expect(json).not.toContain("@");
  });

  it("entrega o prazo RELATIVO, nunca a data absoluta", () => {
    const dto = toTradeOfferDTO(linha(), NOW);

    expect(dto.expiresInMs).toBe(3 * 60 * 60 * 1000);
    // O relógio do browser não é confiável; mandar `expiresAt` faria a tela
    // mentir sobre o prazo em qualquer fuso ou máquina atrasada.
    expect(JSON.stringify(dto)).not.toContain("expiresAt");
  });

  it("oferta já vencida vira 0, não número negativo", () => {
    const vencida = linha({ expiresAt: new Date(NOW.getTime() - 5000) });
    expect(toTradeOfferDTO(vencida, NOW).expiresInMs).toBe(0);
  });

  it("leva o código e a carta, que é o que a tela precisa", () => {
    const dto = toTradeOfferDTO(linha(), NOW);
    expect(dto.code).toBe("A2B4C6D8");
    expect(dto.card.userPokemonId).toBe("up-1");
    expect(dto.card.pokemon?.name).toBe("pikachu");
  });
});
