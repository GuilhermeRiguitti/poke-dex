import { describe, expect, it } from "vitest";
import { applyForcedSwitch, applyLeadLoadout, equipOnEntry } from "@/src/modules/battle/domain/duelEngine";
import type { BattleMoveDef, BattlePokemonState } from "@/src/modules/battle/domain/types";
import type { DuelState } from "@/src/modules/battle/domain/duelTypes";

// A escolha de skills virou decisão de BATALHA: quem entra em campo entra com a
// barra que o jogador montou naquele momento. O que não pode dar errado:
//  - entrar sem golpe nenhum (o pokémon ficaria travado em campo);
//  - reentrar com PP cheio (trocar viraria recarga infinita).

const golpe = (id: number, name: string, currentPp = 10): BattleMoveDef => ({
  id,
  name,
  type: "normal",
  power: 60,
  accuracy: 100,
  damageClass: "physical",
  priority: 0,
  maxPp: 10,
  currentPp,
});

const mon = (slot: number, moves: BattleMoveDef[], fainted = false): BattlePokemonState => ({
  slot,
  userPokemonId: `up-${slot}`,
  pokemonId: slot,
  name: `mon-${slot}`,
  types: ["normal"],
  level: 20,
  stats: { hp: 50, attack: 50, defense: 50, specialAttack: 50, specialDefense: 50, speed: 50 },
  maxHp: 50,
  currentHp: fainted ? 0 : 50,
  fainted,
  moves,
});

describe("equipOnEntry", () => {
  it("monta a barra escolhida", () => {
    const m = mon(1, [golpe(1, "tackle")]);
    equipOnEntry(m, [golpe(2, "ember"), golpe(3, "gust")]);

    expect(m.moves.map((x) => x.name)).toEqual(["ember", "gust"]);
  });

  // O CASO QUE IMPORTA: sem escolha (auto-promover no timeout) o pokémon NÃO
  // pode ficar sem golpe — em campo sem ação ele acumularia falta até perder por
  // abandono.
  it("sem escolha, mantém a barra que já tinha", () => {
    const m = mon(1, [golpe(1, "tackle")]);
    equipOnEntry(m, undefined);
    equipOnEntry(m, []);

    expect(m.moves.map((x) => x.name)).toEqual(["tackle"]);
  });

  // Reentrar com PP cheio faria da troca uma recarga: sai, volta, e o golpe
  // gasto está inteiro de novo.
  it("preserva o PP já gasto de um golpe que ele mantém", () => {
    const m = mon(1, [golpe(7, "ember", 2)]);
    equipOnEntry(m, [golpe(7, "ember", 10)]);

    expect(m.moves[0].currentPp).toBe(2);
  });

  it("golpe novo na barra entra com o PP cheio", () => {
    const m = mon(1, [golpe(7, "ember", 2)]);
    equipOnEntry(m, [golpe(9, "gust", 10)]);

    expect(m.moves[0].currentPp).toBe(10);
  });
});

const estado = (): DuelState => ({
  round: 0,
  sideA: { userId: "alpha", activeSlot: 1, team: [mon(1, [golpe(1, "tackle")]), mon(2, [golpe(1, "tackle")])] },
  sideB: { userId: "beta", activeSlot: 1, team: [mon(1, [golpe(1, "tackle")])] },
});

describe("applyLeadLoadout (round 0)", () => {
  it("monta a barra de quem abre a partida e passa pro round 1", () => {
    const r = applyLeadLoadout({ state: estado(), movesA: [golpe(5, "flamethrower")] });

    expect(r.state.round).toBe(1);
    expect(r.state.sideA.team[0].moves.map((m) => m.name)).toEqual(["flamethrower"]);
    expect(r.finished).toBe(false);
  });

  it("quem não escolheu começa com a barra do snapshot", () => {
    const r = applyLeadLoadout({ state: estado() });

    expect(r.state.sideB.team[0].moves.map((m) => m.name)).toEqual(["tackle"]);
  });

  it("não mexe em quem está na reserva", () => {
    const r = applyLeadLoadout({ state: estado(), movesA: [golpe(5, "flamethrower")] });

    expect(r.state.sideA.team[1].moves.map((m) => m.name)).toEqual(["tackle"]);
  });
});

describe("applyForcedSwitch com barra escolhida", () => {
  const caido = (): DuelState => ({
    round: 3,
    sideA: {
      userId: "alpha",
      activeSlot: 1,
      team: [mon(1, [golpe(1, "tackle")], true), mon(2, [golpe(1, "tackle")])],
    },
    sideB: { userId: "beta", activeSlot: 1, team: [mon(1, [golpe(1, "tackle")])] },
  });

  it("o substituto escolhido entra com a barra escolhida", () => {
    const r = applyForcedSwitch({
      state: caido(),
      choiceA: 2,
      choiceB: null,
      movesA: [golpe(5, "flamethrower")],
    });

    expect(r.state.sideA.activeSlot).toBe(2);
    expect(r.state.sideA.team[1].moves.map((m) => m.name)).toEqual(["flamethrower"]);
  });

  // O CASO QUE IMPORTA: se o motor auto-promoveu OUTRO pokémon (escolha inválida
  // ou vencida), a barra escolhida era pra outro bicho. Aplicá-la aqui poria
  // golpe alheio na carta errada.
  it("escolha inválida: auto-promove SEM aplicar a barra do outro", () => {
    const r = applyForcedSwitch({
      state: caido(),
      choiceA: 99, // slot que não existe
      choiceB: null,
      movesA: [golpe(5, "flamethrower")],
    });

    expect(r.state.sideA.activeSlot).toBe(2); // auto-promoveu o 1º vivo
    expect(r.state.sideA.team[1].moves.map((m) => m.name)).toEqual(["tackle"]);
  });
});
