import { beforeEach, describe, expect, it, vi } from "vitest";
import { DECK_LIMIT } from "@/src/modules/deck/domain/rules";

// saveDeck grava o TIME INTEIRO de uma vez (PUT /api/deck). Substituiu
// addToDeck / removeFromDeck / reorderDeck, que eram um request por gesto.
//
// O que só quebra em produção, e é o que estes testes travam:
//  - o corpo vem da REDE. A tela não é garantia de nada (dá pra chamar com
//    curl), então time de 9, carta repetida e `order: 99` têm que morrer aqui.
//  - carta de OUTRO jogador não entra no meu time.
//  - toda recusa é SEM ESCRITA. Um save recusado no meio deixaria o jogador sem
//    deck — o delete já teria rodado e não há worker pra consertar (regra 5).

const tx = {
  deckSlot: { deleteMany: vi.fn(), createMany: vi.fn() },
};

const prismaMock = {
  userPokemon: { findMany: vi.fn() },
  pokemonMove: { findMany: vi.fn() },
  userPokemonMove: { findMany: vi.fn() },
  deck: { findFirst: vi.fn(), create: vi.fn() },
  $transaction: vi.fn(),
};

vi.mock("@/src/lib/prisma", () => ({ prisma: prismaMock }));

const boardMock = vi.fn();
vi.mock("@/src/modules/deck/queries/getDeckBoard", () => ({ getDeckBoardQuery: boardMock }));

const { saveDeck } = await import("@/src/modules/deck/commands/saveDeck");

/** Um time de `n` cartas, nas posições 0..n-1. */
const time = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ userPokemonId: `up-${i}`, order: i }));

/** As linhas que o banco devolve pras cartas de `time(n)`. */
const donoDe = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    id: `up-${i}`,
    level: 10,
    pokemonId: `sp-${i}`,
    pokemon: { name: `poke-${i}` },
  }));

beforeEach(() => {
  vi.clearAllMocks();

  prismaMock.userPokemon.findMany.mockResolvedValue(donoDe(3));
  // toda espécie tem golpe de level-up liberado
  prismaMock.pokemonMove.findMany.mockResolvedValue([
    { pokemonId: "sp-0" },
    { pokemonId: "sp-1" },
    { pokemonId: "sp-2" },
  ]);
  prismaMock.userPokemonMove.findMany.mockResolvedValue([]);
  prismaMock.deck.findFirst.mockResolvedValue({ id: "deck-1" });
  prismaMock.$transaction.mockImplementation((fn: (t: typeof tx) => unknown) => fn(tx));

  tx.deckSlot.deleteMany.mockResolvedValue({ count: 3 });
  tx.deckSlot.createMany.mockResolvedValue({ count: 3 });

  boardMock.mockResolvedValue({ id: "deck-1", slots: [] });
});

describe("saveDeck — o caminho feliz", () => {
  it("apaga o time antigo e grava o novo, na MESMA transação", async () => {
    const result = await saveDeck("alpha", time(3));

    expect(result.ok).toBe(true);
    expect(tx.deckSlot.deleteMany).toHaveBeenCalledWith({ where: { deckId: "deck-1" } });
    expect(tx.deckSlot.createMany).toHaveBeenCalledWith({
      data: [
        { deckId: "deck-1", userPokemonId: "up-0", order: 0 },
        { deckId: "deck-1", userPokemonId: "up-1", order: 1 },
        { deckId: "deck-1", userPokemonId: "up-2", order: 2 },
      ],
    });
  });

  // Apagar tudo e inserir de novo é o que dispensa as DUAS PASSADAS do antigo
  // reorderDeck (mandar todos pra `order` negativa antes de gravar a final,
  // senão o @@unique([deckId, order]) recusava no meio).
  it("grava a POSIÇÃO que veio, buraco incluído", async () => {
    prismaMock.userPokemon.findMany.mockResolvedValue(donoDe(2));

    await saveDeck("alpha", [
      { userPokemonId: "up-0", order: 0 },
      { userPokemonId: "up-1", order: 4 },
    ]);

    expect(tx.deckSlot.createMany).toHaveBeenCalledWith({
      data: [
        { deckId: "deck-1", userPokemonId: "up-0", order: 0 },
        { deckId: "deck-1", userPokemonId: "up-1", order: 4 },
      ],
    });
  });

  // Esvaziar o deck é edição legítima: apaga tudo e NÃO chama createMany com
  // lista vazia (o Prisma aceitaria, mas a intenção fica explícita).
  it("time vazio esvazia o deck", async () => {
    const result = await saveDeck("alpha", []);

    expect(result.ok).toBe(true);
    expect(tx.deckSlot.deleteMany).toHaveBeenCalledOnce();
    expect(tx.deckSlot.createMany).not.toHaveBeenCalled();
    // sem carta nenhuma, nem vale ir ao banco checar dono
    expect(prismaMock.userPokemon.findMany).not.toHaveBeenCalled();
  });

  it("devolve o deck GRAVADO, pra tela largar o rascunho", async () => {
    boardMock.mockResolvedValue({ id: "deck-1", slots: [{ userPokemonId: "up-0", order: 0 }] });

    const result = await saveDeck("alpha", time(3));

    expect(result).toEqual({
      ok: true,
      board: { id: "deck-1", slots: [{ userPokemonId: "up-0", order: 0 }] },
    });
  });

  it("sem deck ainda, cria um", async () => {
    prismaMock.deck.findFirst.mockResolvedValue(null);
    prismaMock.deck.create.mockResolvedValue({ id: "deck-novo" });

    await saveDeck("alpha", time(3));

    expect(prismaMock.deck.create).toHaveBeenCalledWith({
      data: { userId: "alpha" },
      select: { id: true },
    });
    expect(tx.deckSlot.deleteMany).toHaveBeenCalledWith({ where: { deckId: "deck-novo" } });
  });
});

describe("saveDeck — a validação de forma (a mesma do cliente)", () => {
  it("time maior que o limite é recusado SEM ESCREVER", async () => {
    const result = await saveDeck("alpha", time(DECK_LIMIT + 1));

    expect(result).toEqual({ ok: false, error: "invalid_slots", issue: "too_many" });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("o mesmo pokémon em duas vagas é recusado SEM ESCREVER", async () => {
    const result = await saveDeck("alpha", [
      { userPokemonId: "up-0", order: 0 },
      { userPokemonId: "up-0", order: 1 },
    ]);

    expect(result).toEqual({ ok: false, error: "invalid_slots", issue: "duplicate_pokemon" });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("duas cartas na mesma vaga é recusado SEM ESCREVER", async () => {
    const result = await saveDeck("alpha", [
      { userPokemonId: "up-0", order: 2 },
      { userPokemonId: "up-1", order: 2 },
    ]);

    expect(result).toEqual({ ok: false, error: "invalid_slots", issue: "duplicate_order" });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("posição fora da faixa é recusada SEM ESCREVER", async () => {
    const result = await saveDeck("alpha", [{ userPokemonId: "up-0", order: DECK_LIMIT }]);

    expect(result).toEqual({ ok: false, error: "invalid_slots", issue: "bad_order" });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("corpo torto morre antes de tocar no banco", async () => {
    for (const lixo of [null, undefined, "abc", { slots: [] }, [{ userPokemonId: 1, order: 0 }]]) {
      const result = await saveDeck("alpha", lixo);
      expect(result).toEqual({ ok: false, error: "invalid_slots", issue: "malformed" });
    }
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});

describe("saveDeck — o que depende do banco", () => {
  // A trava de DONO. O id de outro jogador responde igual a inexistente — não
  // vira oráculo de "esse id existe".
  it("carta que não é do jogador derruba o save inteiro, SEM ESCREVER", async () => {
    // pediu 3, o banco só reconhece 2 como dele
    prismaMock.userPokemon.findMany.mockResolvedValue(donoDe(2));

    const result = await saveDeck("alpha", time(3));

    expect(result).toEqual({ ok: false, error: "not_found" });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("filtra por userId no próprio findMany, não depois", async () => {
    await saveDeck("alpha", time(3));

    expect(prismaMock.userPokemon.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ["up-0", "up-1", "up-2"] }, userId: "alpha" } })
    );
  });

  // Pokémon sem NENHUMA skill liberada entra em campo sem ação possível, e o
  // buildDuelSnapshot lança lá no matchmaking, sem pista do porquê.
  it("pokémon sem golpe liberado é recusado, com o NOME, SEM ESCREVER", async () => {
    prismaMock.pokemonMove.findMany.mockResolvedValue([{ pokemonId: "sp-0" }, { pokemonId: "sp-2" }]);

    const result = await saveDeck("alpha", time(3));

    expect(result).toEqual({ ok: false, error: "invalid_cards", names: ["poke-1"] });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  // A união é (level-up destravado ∪ concedido). Sem o segundo lado, um pokémon
  // que só sabe uma TM ensinada seria recusado.
  it("golpe CONCEDIDO (TM) conta como liberado", async () => {
    prismaMock.pokemonMove.findMany.mockResolvedValue([{ pokemonId: "sp-0" }, { pokemonId: "sp-2" }]);
    prismaMock.userPokemonMove.findMany.mockResolvedValue([{ userPokemonId: "up-1" }]);

    const result = await saveDeck("alpha", time(3));

    expect(result.ok).toBe(true);
  });

  it("mais de um sem golpe: todos os nomes voltam", async () => {
    prismaMock.pokemonMove.findMany.mockResolvedValue([{ pokemonId: "sp-1" }]);

    const result = await saveDeck("alpha", time(3));

    expect(result).toEqual({ ok: false, error: "invalid_cards", names: ["poke-0", "poke-2"] });
  });

  // Duas queries pro time inteiro, não duas por pokémon: 6 cartas não podem
  // virar 12 idas ao banco numa lambda fria.
  it("checa o time todo em duas queries, qualquer que seja o tamanho", async () => {
    prismaMock.userPokemon.findMany.mockResolvedValue(donoDe(DECK_LIMIT));
    prismaMock.pokemonMove.findMany.mockResolvedValue(
      Array.from({ length: DECK_LIMIT }, (_, i) => ({ pokemonId: `sp-${i}` }))
    );

    await saveDeck("alpha", time(DECK_LIMIT));

    expect(prismaMock.pokemonMove.findMany).toHaveBeenCalledOnce();
    expect(prismaMock.userPokemonMove.findMany).toHaveBeenCalledOnce();
  });
});
