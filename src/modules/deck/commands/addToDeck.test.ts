import { beforeEach, describe, expect, it, vi } from "vitest";

// addToDeck é a ponte entre a regra do deck (máximo 6) e o banco. A regra pura
// já tem teste (domain/rules.test.ts); o que falta cobrir é o que SÓ quebra em
// produção: o jogador clica "+ Deck" em dois cards ao mesmo tempo (ou dá
// duplo-clique) e duas lambdas chegam aqui juntas.
//
// O que estes testes travam: quem NÃO pode entrar no deck não escreve NADA.

const tx = {
  deckCard: { findUnique: vi.fn(), count: vi.fn(), upsert: vi.fn() },
};

const prismaMock = {
  userCard: { findUnique: vi.fn() },
  deck: { findFirst: vi.fn(), create: vi.fn() },
  $transaction: vi.fn(),
};

vi.mock("@/src/lib/prisma", () => ({ prisma: prismaMock }));

const { addToDeck } = await import("./addToDeck");
const { DECK_LIMIT } = await import("../domain/rules");

beforeEach(() => {
  vi.clearAllMocks();

  prismaMock.userCard.findUnique.mockResolvedValue({ id: "uc-1", userId: "alpha" });
  prismaMock.deck.findFirst.mockResolvedValue({ id: "deck-1" });
  prismaMock.$transaction.mockImplementation((fn: (t: typeof tx) => unknown) => fn(tx));

  tx.deckCard.findUnique.mockResolvedValue(null); // não está no deck
  tx.deckCard.count.mockResolvedValue(0);
  tx.deckCard.upsert.mockResolvedValue({
    id: "dc-1",
    userCardId: "uc-1",
    userCard: { pokemonId: 25 },
  });
});

describe("addToDeck", () => {
  it("põe o pokémon no deck quando há vaga", async () => {
    const result = await addToDeck("alpha", "uc-1");

    expect(result).toEqual({
      ok: true,
      card: { id: "dc-1", userCardId: "uc-1", pokemonId: 25 },
    });
    expect(tx.deckCard.upsert).toHaveBeenCalledOnce();
  });

  // O CASO QUE IMPORTA: deck cheio. Não basta devolver erro — não pode SOBRAR
  // escrita nenhuma. Se o upsert rodasse "mesmo assim", o deck iria a 7.
  it("com o deck cheio, recusa e NÃO escreve nada", async () => {
    tx.deckCard.count.mockResolvedValue(DECK_LIMIT);

    const result = await addToDeck("alpha", "uc-1");

    expect(result).toEqual({ ok: false, error: "deck_full" });
    expect(tx.deckCard.upsert).not.toHaveBeenCalled();
  });

  // A contagem tem que rodar DENTRO da transação, junto com o insert. Se ela
  // rodasse fora, duas lambdas concorrentes leriam "5" ao mesmo tempo e as
  // DUAS inseririam — deck com 7. Este teste prova que o count e o upsert veem
  // o mesmo `tx`, e não o client solto.
  it("checa o limite e insere dentro da MESMA transação", async () => {
    await addToDeck("alpha", "uc-1");

    expect(prismaMock.$transaction).toHaveBeenCalledOnce();
    expect(tx.deckCard.count).toHaveBeenCalled();
    expect(tx.deckCard.upsert).toHaveBeenCalled();
  });

  // Duplo-clique no MESMO card com o deck já cheio: ele JÁ está no deck, então
  // não está entrando ninguém novo — o limite não se aplica, e o upsert (na
  // constraint @unique) não cria uma segunda linha.
  it("um card que já está no deck não esbarra no limite", async () => {
    tx.deckCard.findUnique.mockResolvedValue({ id: "dc-1" });
    tx.deckCard.count.mockResolvedValue(DECK_LIMIT);

    const result = await addToDeck("alpha", "uc-1");

    expect(result.ok).toBe(true);
    expect(tx.deckCard.count).not.toHaveBeenCalled();
  });

  // Um userCardId de OUTRO jogador tem que dar a mesma resposta que um id que
  // não existe — e, de novo, não pode escrever nada.
  it("recusa o card de outro dono sem escrever nada", async () => {
    prismaMock.userCard.findUnique.mockResolvedValue({ id: "uc-1", userId: "beta" });

    const result = await addToDeck("alpha", "uc-1");

    expect(result).toEqual({ ok: false, error: "not_found" });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(tx.deckCard.upsert).not.toHaveBeenCalled();
  });

  it("recusa um card inexistente sem escrever nada", async () => {
    prismaMock.userCard.findUnique.mockResolvedValue(null);

    const result = await addToDeck("alpha", "uc-1");

    expect(result).toEqual({ ok: false, error: "not_found" });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});
