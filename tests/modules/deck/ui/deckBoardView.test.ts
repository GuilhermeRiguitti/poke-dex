import { describe, expect, it } from "vitest";
import {
  deckBoardView,
  dropTargetIndex,
  livePosition,
  slotShift,
} from "@/src/modules/deck/ui/deckBoardView";
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

  it("mais vagas do que o limite não estouram a fileira nem a contagem", () => {
    const cheio = Array.from({ length: DECK_LIMIT + 2 }, (_, i) =>
      vaga(`slot-${i}`, i, 4 + i)
    );
    const v = deckBoardView(board({ slots: cheio }));
    expect(v.slots).toHaveLength(DECK_LIMIT);
    // conta as vagas DESENHADAS — contar o que veio da query escreveria "8/6"
    expect(v.count).toBe(DECK_LIMIT);
  });

  it("a vaga preenchida leva o tipo que tinge a linha", () => {
    expect(deckBoardView(board()).slots[0].accentType).toBe("fire");
    expect(deckBoardView(board()).slots[1].accentType).toBeNull();
  });

  it("o rótulo de batalhar acompanha o time enchendo", () => {
    expect(deckBoardView({ id: null, slots: [] }).battleLabel).toBe("Deck vazio");
    expect(deckBoardView({ id: null, slots: [] }).full).toBe(false);

    expect(deckBoardView(board()).battleLabel).toBe("Batalhar · 1");

    const cheio = Array.from({ length: DECK_LIMIT }, (_, i) => vaga(`slot-${i}`, i, 4 + i));
    const v = deckBoardView(board({ slots: cheio }));
    expect(v.full).toBe(true);
    expect(v.battleLabel).toBe("Batalhar agora");
  });
});

// Três linhas de 40px começando em y=0: meios em 20, 60 e 100.
const MEIOS = [20, 60, 100];

describe("dropTargetIndex", () => {
  // O CASO QUE PEGOU O BUG: parada no lugar, a carta tem que continuar na vaga
  // dela. Contando o próprio meio (20 < 20 é falso, mas 20 < 20.1 não), qualquer
  // tremida do dedo já mandava ela pra vaga seguinte.
  it("parada no lugar, fica na mesma vaga", () => {
    expect(dropTargetIndex(MEIOS, 0, 20)).toBe(0);
    expect(dropTargetIndex(MEIOS, 1, 60)).toBe(1);
    expect(dropTargetIndex(MEIOS, 2, 100)).toBe(2);
  });

  it("desce uma vaga só depois de passar da metade da vizinha", () => {
    expect(dropTargetIndex(MEIOS, 0, 59)).toBe(0); // encostou, não passou
    expect(dropTargetIndex(MEIOS, 0, 61)).toBe(1); // passou
    expect(dropTargetIndex(MEIOS, 0, 101)).toBe(2);
  });

  it("subindo vale a mesma metade", () => {
    expect(dropTargetIndex(MEIOS, 2, 61)).toBe(2); // ainda abaixo do meio da 2ª
    expect(dropTargetIndex(MEIOS, 2, 59)).toBe(1);
    expect(dropTargetIndex(MEIOS, 2, 19)).toBe(0);
  });

  it("arrastar pra fora do painel prende na primeira e na última", () => {
    expect(dropTargetIndex(MEIOS, 1, -5000)).toBe(0);
    expect(dropTargetIndex(MEIOS, 1, 5000)).toBe(2);
  });

  it("lista vazia não estoura", () => {
    expect(dropTargetIndex([], 0, 42)).toBe(0);
  });
});

describe("slotShift", () => {
  it("quem está sendo arrastado não desliza (ele segue o dedo)", () => {
    expect(slotShift(1, 1, 3)).toBe(0);
  });

  it("descendo, quem está entre a vaga antiga e a nova sobe uma", () => {
    expect(slotShift(1, 0, 2)).toBe(-1);
    expect(slotShift(2, 0, 2)).toBe(-1); // o destino também abre espaço
    expect(slotShift(3, 0, 2)).toBe(0); // fora do caminho, fica parado
  });

  it("subindo, quem está no caminho desce uma", () => {
    expect(slotShift(1, 3, 1)).toBe(1);
    expect(slotShift(2, 3, 1)).toBe(1);
    expect(slotShift(0, 3, 1)).toBe(0);
  });

  it("sem movimento, ninguém desliza", () => {
    expect(slotShift(0, 2, 2)).toBe(0);
    expect(slotShift(3, 2, 2)).toBe(0);
  });
});

describe("livePosition", () => {
  // Arrastando a 1ª carta (índice 0) até a 3ª (índice 2): os números têm que
  // acompanhar. Sem isso a carta que subiu pro topo continua marcada "2" — o
  // número é justamente o que diz quem começa em campo.
  it("os quatro números batem com o que a tela mostra", () => {
    expect([0, 1, 2, 3].map((i) => livePosition(i, 0, 2))).toEqual([2, 0, 1, 3]);
  });

  it("a carta arrastada mostra o destino", () => {
    expect(livePosition(3, 3, 0)).toBe(0);
  });

  it("subindo, quem foi empurrado ganha uma posição", () => {
    expect([0, 1, 2, 3].map((i) => livePosition(i, 3, 1))).toEqual([0, 2, 3, 1]);
  });

  // Toda posição aparece uma vez só: dois "1" na tela seria a lista mentindo.
  it("nunca repete um número", () => {
    const posicoes = [0, 1, 2, 3].map((i) => livePosition(i, 1, 3));
    expect(new Set(posicoes).size).toBe(4);
  });
});
