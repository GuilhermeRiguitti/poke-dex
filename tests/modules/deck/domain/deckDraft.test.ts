import { describe, expect, it } from "vitest";
import {
  clearSlot,
  countFilled,
  draftFrom,
  draftToSlots,
  emptyDraft,
  firstFreeIndex,
  indexOfCard,
  placeInSlot,
  sameDraft,
  type DeckDraft,
} from "@/src/modules/deck/domain/deckDraft";
import { DECK_LIMIT } from "@/src/modules/deck/domain/rules";

// O rascunho POSICIONAL: a vaga é um endereço, não uma posição numa fila.
// Estes testes são a promessa que a tela faz — "soltou na 3, ficou na 3".

interface Carta {
  userPokemonId: string;
}

const c = (id: string): Carta => ({ userPokemonId: id });

/** Um rascunho legível: "a..c." vira [a, null, null, c, null, null]. */
const draft = (s: string): DeckDraft<Carta> =>
  Array.from({ length: DECK_LIMIT }, (_, i) => (s[i] && s[i] !== "." ? c(s[i]) : null));

/** O inverso, pra comparar sem escrever seis objetos em cada expect. */
const str = (d: DeckDraft<Carta>) => d.map((x) => x?.userPokemonId ?? ".").join("");

describe("emptyDraft", () => {
  it("são DECK_LIMIT buracos", () => {
    expect(emptyDraft()).toHaveLength(DECK_LIMIT);
    expect(countFilled(emptyDraft())).toBe(0);
  });
});

describe("draftFrom", () => {
  it("põe cada carta na posição que o banco guardou, não na ordem da query", () => {
    // Chegam fora de ordem de propósito: quem manda é o `order`.
    const d = draftFrom([
      { userPokemonId: "c", order: 3 },
      { userPokemonId: "a", order: 0 },
    ]);
    expect(str(d)).toBe("a..c..");
  });

  // O BURACO É DADO, não sujeira. Um time em 0 e 4 tem que continuar em 0 e 4 —
  // compactar aqui mudaria quem começa em campo sem ninguém pedir.
  it("preserva o buraco no meio", () => {
    expect(str(draftFrom([{ userPokemonId: "a", order: 0 }, { userPokemonId: "b", order: 4 }]))).toBe(
      "a...b."
    );
  });

  it("posição fora da faixa é ignorada em vez de estourar o array", () => {
    const d = draftFrom([
      { userPokemonId: "a", order: 0 },
      { userPokemonId: "x", order: DECK_LIMIT },
      { userPokemonId: "y", order: -1 },
    ]);
    expect(d).toHaveLength(DECK_LIMIT);
    expect(str(d)).toBe("a.....");
  });

  it("duas cartas na mesma posição: a primeira fica", () => {
    const d = draftFrom([
      { userPokemonId: "a", order: 2 },
      { userPokemonId: "b", order: 2 },
    ]);
    expect(str(d)).toBe("..a...");
  });
});

describe("placeInSlot", () => {
  // A REGRA QUE DÁ NOME À TELA. Antes, "montar" ia pra primeira vaga livre e o
  // jogador soltava na 3 pra ver a carta cair na 5.
  it("carta da coleção ocupa EXATAMENTE a vaga onde foi solta", () => {
    expect(str(placeInSlot(emptyDraft<Carta>(), 2, c("a")))).toBe("..a...");
    expect(str(placeInSlot(emptyDraft<Carta>(), DECK_LIMIT - 1, c("a")))).toBe(".....a");
  });

  it("vaga ocupada: a carta nova entra e a antiga sai do time", () => {
    expect(str(placeInSlot(draft("ab...."), 1, c("z")))).toBe("az....");
  });

  // TROCA, não empurra. Se empurrasse, arrastar a 3ª pra 1ª mexeria também na
  // 2ª — e a ordem importa (a vaga 0 começa em campo).
  it("carta que já está no time TROCA de vaga com a de destino", () => {
    expect(str(placeInSlot(draft("abc..."), 0, c("c")))).toBe("cba...");
  });

  it("trocar com uma vaga VAZIA deixa a de origem vazia", () => {
    expect(str(placeInSlot(draft("a....."), 4, c("a")))).toBe("....a.");
  });

  it("soltar na própria vaga não muda nada (nem a referência)", () => {
    const d = draft("abc...");
    expect(placeInSlot(d, 1, c("b"))).toBe(d);
  });

  it("índice fora da faixa devolve o rascunho intacto", () => {
    const d = draft("a.....");
    expect(placeInSlot(d, DECK_LIMIT, c("z"))).toBe(d);
    expect(placeInSlot(d, -1, c("z"))).toBe(d);
  });

  it("não modifica o rascunho original", () => {
    const d = draft("a.....");
    placeInSlot(d, 3, c("z"));
    expect(str(d)).toBe("a.....");
  });

  // O @@unique([deckId, userPokemonId]) do banco recusaria — mas o erro
  // apareceria só no save, depois do jogador ter montado o time todo.
  it("nunca deixa o mesmo pokémon em duas vagas", () => {
    const d = placeInSlot(draft("a.b..."), 4, c("a"));
    expect(str(d)).toBe("..b.a.");
    expect(d.filter((x) => x?.userPokemonId === "a")).toHaveLength(1);
  });
});

describe("clearSlot", () => {
  it("esvazia a vaga sem mexer nas outras", () => {
    expect(str(clearSlot(draft("abc..."), 1))).toBe("a.c...");
  });

  it("vaga já vazia devolve o rascunho intacto", () => {
    const d = draft("a.....");
    expect(clearSlot(d, 3)).toBe(d);
  });
});

describe("firstFreeIndex", () => {
  it("é o BURACO, não a contagem", () => {
    // O caminho do toque põe aqui. Com carta na 0 e na 2, a contagem (2)
    // apontaria pra uma vaga JÁ OCUPADA.
    expect(firstFreeIndex(draft("a.b..."))).toBe(1);
  });

  it("time cheio não tem vaga", () => {
    expect(firstFreeIndex(draft("abcdef"))).toBeNull();
  });

  it("time vazio começa na 0", () => {
    expect(firstFreeIndex(emptyDraft())).toBe(0);
  });
});

describe("indexOfCard", () => {
  it("acha a vaga da carta, ou null", () => {
    expect(indexOfCard(draft("a.b..."), "b")).toBe(2);
    expect(indexOfCard(draft("a.b..."), "z")).toBeNull();
  });
});

describe("draftToSlots", () => {
  // O QUE VAI PRO SERVIDOR. Manda `order` explícito justamente porque há
  // buraco: sem isso, salvar um time em 0 e 4 o compactaria pra 0 e 1.
  it("manda a POSIÇÃO de cada carta, pulando os buracos", () => {
    expect(draftToSlots(draft("a...b."))).toEqual([
      { userPokemonId: "a", order: 0 },
      { userPokemonId: "b", order: 4 },
    ]);
  });

  it("time vazio vira lista vazia (é como se esvazia o deck)", () => {
    expect(draftToSlots(emptyDraft())).toEqual([]);
  });
});

describe("sameDraft", () => {
  it("mesmo time nas mesmas vagas", () => {
    expect(sameDraft(draft("a.b..."), draft("a.b..."))).toBe(true);
  });

  // O que decide se há edição pendente segurando a batalha. Só a POSIÇÃO mudou,
  // e isso é mudança de verdade: a vaga 0 começa em campo.
  it("mesmo time em vagas diferentes NÃO é o mesmo deck", () => {
    expect(sameDraft(draft("ab...."), draft("ba...."))).toBe(false);
    expect(sameDraft(draft("a.b..."), draft("ab...."))).toBe(false);
  });

  it("time diferente", () => {
    expect(sameDraft(draft("a....."), draft("z....."))).toBe(false);
    expect(sameDraft(draft("a....."), emptyDraft())).toBe(false);
  });
});
