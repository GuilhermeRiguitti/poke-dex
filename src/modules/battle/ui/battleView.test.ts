import { describe, expect, it } from "vitest";
import { resolveMySide, toLogLines, toScore } from "./battleView";
import type { BattlePokemonDTO, TurnLogDTO } from "./types";

// Essas regras moravam dentro do componente da página, então só dava pra
// conferir olhando a tela. Agora são funções puras.

function pokemon(slot: number, fainted: boolean): BattlePokemonDTO {
  return {
    id: `p${slot}`,
    slot,
    pokemonId: slot,
    name: `mon${slot}`,
    spriteUrl: null,
    types: ["normal"],
    maxHp: 100,
    currentHp: fainted ? 0 : 100,
    fainted,
    moves: [],
  };
}

describe("resolveMySide", () => {
  const participants = [{ userId: "zeta" }, { userId: "alpha" }];

  it("dá o lado A pro menor userId, independente da ordem que o Prisma devolveu", () => {
    expect(resolveMySide(participants, "alpha")).toBe("A");
    expect(resolveMySide(participants, "zeta")).toBe("B");
    expect(resolveMySide([...participants].reverse(), "alpha")).toBe("A");
  });
});

describe("toScore", () => {
  it("conta só os pokémons vivos de cada lado", () => {
    const me = [pokemon(1, false), pokemon(2, true), pokemon(3, false)];
    const opponent = [pokemon(1, true), pokemon(2, true)];

    expect(toScore(me, opponent)).toEqual({
      myAlive: 2,
      myTotal: 3,
      oppAlive: 0,
      oppTotal: 2,
    });
  });
});

describe("toLogLines", () => {
  const turnLogs: TurnLogDTO[] = [
    {
      turnNumber: 2,
      events: [
        {
          type: "attack",
          side: "A",
          moveName: "flame-thrower",
          damage: 42,
          effectiveness: 2,
          isCrit: true,
          missed: false,
          targetFainted: true,
        },
        { type: "noAction", side: "B" },
      ],
    },
    {
      turnNumber: 1,
      events: [{ type: "switch", side: "B", toSlot: 2, pokemonName: "onix" }],
    },
  ];

  it("mostra o turno mais recente primeiro", () => {
    const lines = toLogLines(turnLogs, "A");
    expect(lines[0].text).toBe("— TURNO 02 —");
    expect(lines.at(-1)?.text).toContain("ONIX");
  });

  it("rotula o dono do evento a partir do MEU lado", () => {
    // Mesmo evento (side: "A"), rótulo diferente dependendo de quem está olhando.
    expect(toLogLines(turnLogs, "A")[1].text.startsWith("Você")).toBe(true);
    expect(toLogLines(turnLogs, "B")[1].text.startsWith("Inimigo")).toBe(true);
  });

  it("junta crit, efetividade e KO na mesma linha, e pinta de dourado no crit", () => {
    const [, attack] = toLogLines(turnLogs, "A");
    expect(attack.text).toBe("Você: FLAME THROWER 42 crit super KO!");
    expect(attack.tone).toBe("gold");
  });

  it("marca quem não agiu", () => {
    const noAction = toLogLines(turnLogs, "A")[2];
    expect(noAction.text).toBe("Inimigo: sem ação");
    expect(noAction.tone).toBe("inkDim");
  });
});
