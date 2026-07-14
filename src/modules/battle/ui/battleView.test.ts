import { describe, expect, it } from "vitest";
import { resolveMySide, toLogLines, toScore, toTableMoves } from "./battleView";
import type { BattleMoveDTO, BattlePokemonDTO, TurnLogDTO } from "./types";

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

// ─────────────────────────────────────────────────────────────────────────
// toTableMoves: o botão do golpe precisa refletir o PP, que agora é um limite
// real (o engine gasta, e submitMove recusa slot zerado). A regra do
// `exhausted` tem que ser a MESMA do servidor, senão a tela oferece uma jogada
// que a API vai rejeitar.
// ─────────────────────────────────────────────────────────────────────────
function move(name: string, currentPp: number, maxPp = 10): BattleMoveDTO {
  return {
    id: 1,
    name,
    type: "normal",
    power: 80,
    accuracy: 100,
    damageClass: "physical",
    priority: 0,
    maxPp,
    currentPp,
  };
}

function monWithMoves(moves: BattleMoveDTO[]): BattlePokemonDTO {
  return { ...pokemon(1, false), moves };
}

describe("toTableMoves — PP", () => {
  it("leva currentPp/maxPp pra mesa", () => {
    const [table] = toTableMoves(monWithMoves([move("tackle", 7, 10)]));
    expect(table).toMatchObject({ name: "tackle", currentPp: 7, maxPp: 10 });
  });

  it("golpe zerado com outro golpe disponível => exhausted (a API recusaria)", () => {
    const [zerado, cheio] = toTableMoves(monWithMoves([move("zerado", 0), move("cheio", 5)]));
    expect(zerado.exhausted).toBe(true);
    expect(cheio.exhausted).toBe(false);
  });

  it("TODOS os golpes zerados => nenhum exhausted (o engine cai no struggle)", () => {
    // Desabilitar tudo aqui deixaria o jogador sem ação nenhuma e ele perderia
    // por abandono em 3 turnos — o oposto do que o struggle existe pra evitar.
    const moves = toTableMoves(monWithMoves([move("a", 0), move("b", 0)]));
    expect(moves.every((m) => !m.exhausted)).toBe(true);
  });
});
