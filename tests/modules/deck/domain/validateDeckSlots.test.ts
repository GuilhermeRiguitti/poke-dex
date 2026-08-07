import { describe, expect, it } from "vitest";
import { validateDeckSlots } from "@/src/modules/deck/domain/validateDeckSlots";
import { DECK_LIMIT } from "@/src/modules/deck/domain/rules";

// A validação do time que vai ser GRAVADO. Roda nos dois lados: no cliente pra
// não gastar um request, no servidor porque é lá que a trava vale.
//
// Por isso ela recebe `unknown`: o corpo do PUT vem da rede, e a tela não é
// garantia de nada — dá pra chamar /api/deck com curl.

const time = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ userPokemonId: `up-${i}`, order: i }));

describe("validateDeckSlots — o que passa", () => {
  it("um time normal", () => {
    const r = validateDeckSlots(time(3));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.slots).toHaveLength(3);
  });

  it("o time cheio", () => {
    expect(validateDeckSlots(time(DECK_LIMIT)).ok).toBe(true);
  });

  // Esvaziar o deck é edição legítima — é como se desmonta o time pra montar
  // outro. Quem barra entrar em batalha sem pokémon é o matchmaking.
  it("time VAZIO", () => {
    const r = validateDeckSlots([]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.slots).toEqual([]);
  });

  // O rascunho tem buraco: carta na vaga 0 e na 4, o meio vazio. Recusar isso
  // obrigaria a compactar o time no save — mudando quem começa em campo.
  it("posições com buraco no meio", () => {
    const r = validateDeckSlots([
      { userPokemonId: "a", order: 0 },
      { userPokemonId: "b", order: 5 },
    ]);
    expect(r.ok).toBe(true);
  });

  it("só o que interessa sai do outro lado (campo a mais é descartado)", () => {
    const r = validateDeckSlots([{ userPokemonId: "a", order: 0, userId: "outro", admin: true }]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.slots[0]).toEqual({ userPokemonId: "a", order: 0 });
  });
});

describe("validateDeckSlots — quantidade", () => {
  it("mais que o limite é recusado", () => {
    const r = validateDeckSlots(time(DECK_LIMIT + 1));
    expect(r).toEqual({ ok: false, issue: "too_many" });
  });

  // O teto é checado ANTES de percorrer a lista: um array de 100 mil itens
  // vindo da rede não vira 100 mil iterações.
  it("uma lista gigante para na quantidade", () => {
    expect(validateDeckSlots(time(10_000))).toEqual({ ok: false, issue: "too_many" });
  });
});

describe("validateDeckSlots — repetidos", () => {
  // Bateria no @@unique([deckId, userPokemonId]) no meio do createMany: 500 em
  // vez de um aviso legível.
  it("o mesmo pokémon em duas vagas", () => {
    const r = validateDeckSlots([
      { userPokemonId: "a", order: 0 },
      { userPokemonId: "a", order: 1 },
    ]);
    expect(r).toEqual({ ok: false, issue: "duplicate_pokemon" });
  });

  // Bateria no @@unique([deckId, order]).
  it("duas cartas na mesma vaga", () => {
    const r = validateDeckSlots([
      { userPokemonId: "a", order: 2 },
      { userPokemonId: "b", order: 2 },
    ]);
    expect(r).toEqual({ ok: false, issue: "duplicate_order" });
  });
});

describe("validateDeckSlots — posição", () => {
  // O banco ACEITARIA order: 99 — e o deck ficaria com uma carta que nenhuma
  // tela desenha (a fileira só tem DECK_LIMIT vagas) e que o jogador não teria
  // como tirar.
  it("posição fora de 0..DECK_LIMIT-1", () => {
    expect(validateDeckSlots([{ userPokemonId: "a", order: DECK_LIMIT }])).toEqual({
      ok: false,
      issue: "bad_order",
    });
    expect(validateDeckSlots([{ userPokemonId: "a", order: -1 }])).toEqual({
      ok: false,
      issue: "bad_order",
    });
  });

  it("posição quebrada não é posição", () => {
    expect(validateDeckSlots([{ userPokemonId: "a", order: 1.5 }])).toEqual({
      ok: false,
      issue: "malformed",
    });
    expect(validateDeckSlots([{ userPokemonId: "a", order: NaN }])).toEqual({
      ok: false,
      issue: "malformed",
    });
  });
});

describe("validateDeckSlots — corpo torto", () => {
  it("o que nem é lista", () => {
    for (const lixo of [null, undefined, "abc", 42, {}, { slots: [] }]) {
      expect(validateDeckSlots(lixo)).toEqual({ ok: false, issue: "malformed" });
    }
  });

  it("item que não é objeto", () => {
    expect(validateDeckSlots(["a"])).toEqual({ ok: false, issue: "malformed" });
    expect(validateDeckSlots([null])).toEqual({ ok: false, issue: "malformed" });
  });

  it("id ausente, vazio ou do tipo errado", () => {
    expect(validateDeckSlots([{ order: 0 }])).toEqual({ ok: false, issue: "malformed" });
    expect(validateDeckSlots([{ userPokemonId: "", order: 0 }])).toEqual({
      ok: false,
      issue: "malformed",
    });
    expect(validateDeckSlots([{ userPokemonId: 7, order: 0 }])).toEqual({
      ok: false,
      issue: "malformed",
    });
  });

  it("order ausente", () => {
    expect(validateDeckSlots([{ userPokemonId: "a" }])).toEqual({ ok: false, issue: "malformed" });
  });
});
