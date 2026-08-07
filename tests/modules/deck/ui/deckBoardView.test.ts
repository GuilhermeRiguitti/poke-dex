import { describe, expect, it } from "vitest";
import { deckBoardView } from "@/src/modules/deck/ui/deckBoardView";
import { draftFrom, emptyDraft, type DeckDraft } from "@/src/modules/deck/domain/deckDraft";
import { DECK_LIMIT } from "@/src/modules/deck/domain/rules";
import type { DeckCardDTO } from "@/src/modules/deck/ui/types";

const BASE_STATS = { hp: 39, atk: 52, def: 43, spa: 60, spd: 50, spe: 65 };

const carta = (id: string, pokemonId: number): DeckCardDTO => ({
  userPokemonId: id,
  pokemonId,
  name: "charmander",
  iconUrl: "i.png",
  level: 10,
  types: ["fire"],
  rarity: "common",
  baseStats: BASE_STATS,
});

/** O rascunho como a tela o tem. `order` posiciona — é o mesmo caminho da page. */
const rascunho = (...slots: { card: DeckCardDTO; order: number }[]): DeckDraft<DeckCardDTO> =>
  draftFrom(slots.map(({ card, order }) => ({ ...card, order })));

/** Estado padrão: deck salvo, ninguém editando. */
const PARADO = { editing: false, dirty: false };

describe("deckBoardView — a fileira", () => {
  it("são sempre DECK_LIMIT vagas", () => {
    expect(deckBoardView(emptyDraft(), PARADO).slots).toHaveLength(DECK_LIMIT);
  });

  it("sem deck nenhum, são DECK_LIMIT vagas vazias", () => {
    const v = deckBoardView(emptyDraft(), PARADO);
    expect(v.slots.every((s) => s.pokemonId === null)).toBe(true);
    expect(v.count).toBe(0);
  });

  // O CORAÇÃO DA MUDANÇA: a vaga é um ENDEREÇO. Uma carta na posição 3 é
  // desenhada na 3, com as vagas 0..2 vazias — antes a fileira era compactada e
  // ela apareceria no topo.
  it("a carta fica na vaga onde foi posta, com buraco antes", () => {
    const v = deckBoardView(rascunho({ card: carta("up-1", 4), order: 3 }), PARADO);

    expect(v.slots[0].userPokemonId).toBeNull();
    expect(v.slots[3].userPokemonId).toBe("up-1");
    expect(v.slots[3].numero).toBe(4);
    expect(v.slots[3].dexNumber).toBe("#0004");
    expect(v.count).toBe(1);
  });

  it("o buraco no meio continua buraco", () => {
    const v = deckBoardView(
      rascunho({ card: carta("up-1", 4), order: 0 }, { card: carta("up-2", 7), order: 4 }),
      PARADO
    );
    expect(v.slots.map((s) => s.userPokemonId)).toEqual(["up-1", null, null, null, "up-2", null]);
    expect(v.count).toBe(2);
  });

  // Só a vaga 0 começa em campo — é o que o número em destaque diz.
  it("só a primeira vaga é a de campo", () => {
    const v = deckBoardView(emptyDraft(), PARADO);
    expect(v.slots.map((s) => s.emCampo)).toEqual([true, false, false, false, false, false]);
  });

  it("a vaga preenchida leva o tipo que tinge a linha; a vazia não tem nenhum", () => {
    const v = deckBoardView(rascunho({ card: carta("up-1", 4), order: 0 }), PARADO);
    expect(v.slots[0].accentType).toBe("fire");
    expect(v.slots[1].accentType).toBeNull();
  });

  it("a vaga desenha a carta inteira, sem consultar a coleção", () => {
    const v = deckBoardView(rascunho({ card: carta("up-1", 6), order: 0 }), PARADO);
    expect(v.slots[0].name).toBe("charmander");
    expect(v.slots[0].baseStats).toEqual(BASE_STATS);
    expect(v.slots[0].level).toBe(10);
  });

  it("rascunho maior que o limite não estoura a fileira nem a contagem", () => {
    const grande = Array.from({ length: DECK_LIMIT + 2 }, (_, i) => carta(`up-${i}`, 4 + i));
    const v = deckBoardView(grande, PARADO);
    expect(v.slots).toHaveLength(DECK_LIMIT);
    // conta as vagas DESENHADAS — contar o rascunho escreveria "8/6"
    expect(v.count).toBe(DECK_LIMIT);
    expect(v.full).toBe(true);
  });
});

describe("deckBoardView — a trava da batalha", () => {
  const cheio = Array.from({ length: DECK_LIMIT }, (_, i) => carta(`up-${i}`, 4 + i));

  it("deck salvo e com time: dá pra batalhar", () => {
    const v = deckBoardView(cheio, PARADO);
    expect(v.canBattle).toBe(true);
    expect(v.battleBlockedReason).toBeNull();
    expect(v.battleLabel).toBe("Batalhar agora");
  });

  it("deck vazio não batalha", () => {
    const v = deckBoardView(emptyDraft(), PARADO);
    expect(v.canBattle).toBe(false);
    expect(v.battleBlockedReason).toBe("Monte um time para batalhar");
  });

  // A REGRA QUE O JOGO PEDE: em edição não se entra em batalha. O que a batalha
  // usa é o time GRAVADO — lutar com o time antigo enquanto a tela mostra outro
  // seria uma derrota sem explicação possível.
  it("EM EDIÇÃO não batalha, mesmo com o time cheio", () => {
    const v = deckBoardView(cheio, { editing: true, dirty: true });
    expect(v.canBattle).toBe(false);
    expect(v.battleBlockedReason).toBe("Salve o time para batalhar");
  });

  it("em edição SEM mudança pendente, o aviso é outro — mas ainda não batalha", () => {
    const v = deckBoardView(cheio, { editing: true, dirty: false });
    expect(v.canBattle).toBe(false);
    expect(v.battleBlockedReason).toBe("Termine a edição para batalhar");
  });

  it("o rótulo acompanha o time enchendo", () => {
    expect(deckBoardView(emptyDraft(), PARADO).battleLabel).toBe("Deck vazio");
    expect(deckBoardView(emptyDraft(), PARADO).full).toBe(false);
    expect(deckBoardView(rascunho({ card: carta("up-1", 4), order: 0 }), PARADO).battleLabel).toBe(
      "Batalhar · 1"
    );
  });
});
