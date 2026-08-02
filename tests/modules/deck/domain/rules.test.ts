import { describe, expect, it } from "vitest";
import { DECK_LIMIT, firstFreeOrder, isDeckFull, moveSlot } from "@/src/modules/deck/domain/rules";

describe("isDeckFull", () => {
  it("é falso abaixo do limite e verdadeiro a partir dele", () => {
    expect(isDeckFull(DECK_LIMIT - 1)).toBe(false);
    expect(isDeckFull(DECK_LIMIT)).toBe(true);
  });

  // >= e não ===: se uma corrida antiga deixou 7 no deck, o botão continua
  // travado em vez de destravar e deixar entrar o 8º.
  it("continua cheio se de alguma forma passou do limite", () => {
    expect(isDeckFull(DECK_LIMIT + 1)).toBe(true);
  });
});

describe("firstFreeOrder", () => {
  it("no time vazio, é a posição 0", () => {
    expect(firstFreeOrder([])).toBe(0);
  });

  it("sem buraco, é logo depois do último", () => {
    expect(firstFreeOrder([0, 1, 2])).toBe(3);
  });

  // O bug que isto existe pra travar: tirar o loadout do MEIO deixa a sequência
  // furada, e a CONTAGEM (3) apontaria pro slot que já ocupa a posição 3 —
  // @@unique([deckId, order]) violada, 500 no POST de montar deck.
  it("com buraco no meio, é o buraco — não a contagem", () => {
    expect(firstFreeOrder([0, 1, 3])).toBe(2);
    expect(firstFreeOrder([1, 2, 3])).toBe(0);
    expect(firstFreeOrder([0, 1, 2, 3, 5])).toBe(4);
  });

  it("não inventa vaga além do limite", () => {
    expect(firstFreeOrder([...Array(DECK_LIMIT).keys()])).toBeNull();
  });

  // Dado torto (order fora de 0..5 vindo de uma corrida antiga) não pode virar
  // uma posição escrita por cima: null faz o command recusar.
  it("ignora posição fora da faixa do time", () => {
    expect(firstFreeOrder([0, 1, 2, 3, 4, 9])).toBe(5);
  });
});

describe("moveSlot", () => {
  const time = ["a", "b", "c", "d"];

  it("puxando pra cima, empurra quem estava no caminho pra baixo", () => {
    expect(moveSlot(time, 2, 0)).toEqual(["c", "a", "b", "d"]);
  });

  it("empurrando pra baixo, quem estava no caminho sobe", () => {
    expect(moveSlot(time, 0, 2)).toEqual(["b", "c", "a", "d"]);
  });

  // EMPURRA, não troca. Se fosse troca, 0->2 daria ["c","b","a","d"] — o "b"
  // ficaria parado, e na tela ele acabou de sair do lugar pra abrir espaço.
  it("não é troca de pares", () => {
    expect(moveSlot(time, 0, 2)).not.toEqual(["c", "b", "a", "d"]);
  });

  it("soltar no mesmo lugar não muda nada", () => {
    expect(moveSlot(time, 1, 1)).toEqual(time);
  });

  it("índice fora da lista devolve a lista intacta", () => {
    expect(moveSlot(time, 0, 9)).toEqual(time);
    expect(moveSlot(time, -1, 2)).toEqual(time);
  });

  it("não modifica a lista original", () => {
    const original = [...time];
    moveSlot(time, 0, 3);
    expect(time).toEqual(original);
  });
});
