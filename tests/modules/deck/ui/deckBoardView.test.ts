import { describe, expect, it } from "vitest";
import { deckBoardView } from "@/src/modules/deck/ui/deckBoardView";
import { DECK_LIMIT } from "@/src/modules/deck/domain/rules";
import type { DeckBoardDTO } from "@/src/modules/deck/ui/types";

const BASE_STATS = { hp: 39, atk: 52, def: 43, spa: 60, spd: 50, spe: 65 };

const vaga = (id: string, order: number, pokemonId: number) => ({
  id,
  order,
  pokemonId,
  name: "charmander",
  iconUrl: "i.png",
  level: 10,
  types: ["fire"],
  rarity: "common" as const,
  baseStats: BASE_STATS,
});

const board = (over: Partial<DeckBoardDTO> = {}): DeckBoardDTO => ({
  id: "d1",
  slots: [vaga("slot-1", 0, 4)],
  ...over,
});

describe("deckBoardView", () => {
  it("completa até DECK_LIMIT vagas", () => {
    expect(deckBoardView(board()).slots).toHaveLength(DECK_LIMIT);
  });

  it("sem deck nenhum, são DECK_LIMIT vagas vazias", () => {
    const v = deckBoardView({ id: null, slots: [] });
    expect(v.slots).toHaveLength(DECK_LIMIT);
    expect(v.slots.every((s) => s.pokemonId === null)).toBe(true);
    expect(v.count).toBe(0);
  });

  it("a vaga preenchida leva o id do slot — é o que o X manda pro DELETE", () => {
    const v = deckBoardView(board());
    expect(v.slots[0].id).toBe("slot-1");
    expect(v.slots[0].dexNumber).toBe("#0004");
    expect(v.count).toBe(1);
  });

  it("vaga vazia não tem id", () => {
    expect(deckBoardView(board()).slots[1].id).toBeNull();
  });

  // O bug que originou a separação: o deck se resolve SOZINHO, a partir da
  // query dele. Não existe mais cruzamento com a listagem da coleção, então
  // filtro e paginação não têm como esvaziar uma vaga montada.
  it("desenha a vaga sem depender de nada da coleção", () => {
    const v = deckBoardView(board({ slots: [vaga("slot-1", 0, 6)] }));
    expect(v.slots[0].pokemonId).toBe(6);
    expect(v.slots[0].name).toBe("charmander");
    expect(v.slots[0].baseStats).toEqual(BASE_STATS);
  });

  it("mais vagas do que o limite não estouram a fileira", () => {
    const cheio = Array.from({ length: DECK_LIMIT + 2 }, (_, i) =>
      vaga(`slot-${i}`, i, 4 + i)
    );
    expect(deckBoardView(board({ slots: cheio })).slots).toHaveLength(DECK_LIMIT);
  });
});
