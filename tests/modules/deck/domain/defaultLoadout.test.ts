import { describe, expect, it } from "vitest";
import { defaultLoadout } from "@/src/modules/deck/domain/defaultLoadout";
import { CARDS_PER_SLOT } from "@/src/modules/deck/domain/rules";

// A barra que o servidor monta quando o jogador arrasta a carta pro deck e não
// escolhe nada. Se ela sair ruim, o pokémon entra na batalha inútil — e o
// jogador não pediu nada, então não tem nem como saber que foi escolha nossa.

const m = (moveId: string, power: number | null, levelLearnedAt = 1) => ({
  moveId,
  power,
  levelLearnedAt,
});

describe("defaultLoadout", () => {
  // O CASO QUE IMPORTA: "as primeiras desbloqueadas" seriam tackle e growl. O
  // deck montado por arrasto tem que sair jogável, não cronológico.
  it("pega os golpes mais FORTES, não os primeiros aprendidos", () => {
    const escolhido = defaultLoadout([
      m("tackle", 40, 1),
      m("growl", null, 1),
      m("flamethrower", 90, 38),
      m("fire-blast", 110, 46),
    ]);

    expect(escolhido.slice(0, 2)).toEqual(["fire-blast", "flamethrower"]);
  });

  it("não passa do teto de cartas por vaga", () => {
    const muitos = Array.from({ length: 12 }, (_, i) => m(`golpe-${i}`, 10 + i));
    expect(defaultLoadout(muitos)).toHaveLength(CARDS_PER_SLOT);
  });

  it("com menos golpes que o teto, leva todos", () => {
    expect(defaultLoadout([m("ember", 40), m("scratch", 40)])).toHaveLength(2);
  });

  // Status vai pro fim da fila, mas não pode ser descartado: um pokémon novo
  // pode não ter 6 golpes de dano, e a barra ficaria com buraco.
  it("golpe de status entra quando sobra vaga", () => {
    const escolhido = defaultLoadout([m("leer", null), m("ember", 40), m("growl", null)]);

    expect(escolhido).toHaveLength(3);
    expect(escolhido[0]).toBe("ember");
  });

  it("empatando no poder, o aprendido mais tarde vem antes", () => {
    expect(defaultLoadout([m("velho", 60, 5), m("novo", 60, 40)])[0]).toBe("novo");
  });

  // Determinismo: sem o desempate por id, a ordem em que o banco devolveu as
  // linhas mudaria a barra montada, e nenhum teste conseguiria travar isso.
  it("empate total sai sempre na mesma ordem, venha como vier do banco", () => {
    const a = defaultLoadout([m("zeta", 50, 3), m("alfa", 50, 3)]);
    const b = defaultLoadout([m("alfa", 50, 3), m("zeta", 50, 3)]);

    expect(a).toEqual(["alfa", "zeta"]);
    expect(a).toEqual(b);
  });

  it("não modifica a lista recebida", () => {
    const lista = [m("a", 10), m("b", 90)];
    const copia = [...lista];
    defaultLoadout(lista);
    expect(lista).toEqual(copia);
  });

  it("sem nada desbloqueado, devolve lista vazia", () => {
    expect(defaultLoadout([])).toEqual([]);
  });
});
