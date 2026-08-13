import { describe, expect, it } from "vitest";
import { hasEffect, isSelfDirected, parseMoveEffect } from "@/src/modules/battle/domain/moveEffect";

// A tradução do Json cru da PokéAPI (coluna Move.effect) pro efeito que o motor
// aplica. Os payloads abaixo são RECORTES REAIS de /move — a forma importa: se a
// API mudar de nome de campo, é aqui que tem que quebrar.

const swordsDance = {
  ailment: "none",
  ailmentChance: 0,
  category: "net-good-stats",
  critRate: 0,
  drain: 0,
  flinchChance: 0,
  healing: 0,
  minHits: null,
  maxHits: null,
  minTurns: null,
  maxTurns: null,
  statChance: 0,
  statChanges: [{ stat: "attack", change: 2 }],
  target: "user",
  effectChance: null,
};

const thunderWave = { ...swordsDance, ailment: "paralysis", category: "ailment", statChanges: [], target: "selected-pokemon" };
const growl = { ...swordsDance, statChanges: [{ stat: "attack", change: -1 }], target: "all-opponents" };
const ember = { ...swordsDance, ailment: "burn", ailmentChance: 10, category: "damage-ailment", target: "selected-pokemon", effectChance: 10 };
const absorb = { ...swordsDance, category: "damage-heal", drain: 50, target: "selected-pokemon" };
const recover = { ...swordsDance, category: "heal", healing: 50, statChanges: [] };
const doubleKick = { ...swordsDance, category: "damage", statChanges: [], minHits: 2, maxHits: 2, target: "selected-pokemon" };
const swagger = { ...swordsDance, ailment: "confusion", category: "swagger", statChanges: [{ stat: "attack", change: 2 }], target: "selected-pokemon", minTurns: 2, maxTurns: 5 };
const sandstorm = { ...swordsDance, category: "whole-field-effect", statChanges: [], target: "entire-field" };

describe("parseMoveEffect", () => {
  it("chance 0 num golpe de status quer dizer SEMPRE (thunder-wave paralisa 100% do que acerta)", () => {
    const e = parseMoveEffect(thunderWave)!;
    expect(e.ailment).toBe("paralysis");
    expect(e.ailmentChance).toBe(100);
  });

  it("mas num golpe de DANO a chance é a que a API deu (ember queima 10%)", () => {
    expect(parseMoveEffect(ember)!.ailmentChance).toBe(10);
  });

  it("golpe mirado no usuário sobe o estágio DELE (swords-dance)", () => {
    const e = parseMoveEffect(swordsDance)!;
    expect(e.stageTarget).toBe("self");
    expect(e.stageChanges).toEqual([{ stat: "attack", change: 2 }]);
    expect(e.stageChance).toBe(100);
    expect(isSelfDirected(e)).toBe(true);
  });

  it("golpe mirado no oponente baixa o estágio DELE (growl)", () => {
    const e = parseMoveEffect(growl)!;
    expect(e.stageTarget).toBe("foe");
    expect(isSelfDirected(e)).toBe(false);
  });

  it("swagger SOBE o ataque do OPONENTE — mudança positiva não quer dizer 'em mim'", () => {
    const e = parseMoveEffect(swagger)!;
    expect(e.stageTarget).toBe("foe");
    expect(e.ailment).toBe("confusion");
    expect(e.ailmentMinTurns).toBe(2);
  });

  it("traduz os nomes de stat da API (special-attack -> specialAttack)", () => {
    const e = parseMoveEffect({ ...swordsDance, statChanges: [{ stat: "special-attack", change: 1 }] })!;
    expect(e.stageChanges[0].stat).toBe("specialAttack");
  });

  it("dreno, cura e múltiplos acertos vêm do meta", () => {
    expect(parseMoveEffect(absorb)!.drainPct).toBe(50);
    expect(parseMoveEffect(recover)!.healPct).toBe(50);
    const kick = parseMoveEffect(doubleKick)!;
    expect([kick.minHits, kick.maxHits]).toEqual([2, 2]);
  });

  it("recuo é dreno NEGATIVO (take-down)", () => {
    expect(parseMoveEffect({ ...absorb, drain: -25 })!.drainPct).toBe(-25);
  });

  it("devolve null pro que o jogo não modela: clima, ailment desconhecido, dado ausente", () => {
    expect(parseMoveEffect(sandstorm)).toBeNull();
    expect(parseMoveEffect({ ...thunderWave, ailment: "nightmare" })).toBeNull();
    expect(parseMoveEffect(null)).toBeNull();
    expect(parseMoveEffect("lixo")).toBeNull();
    expect(parseMoveEffect({})).toBeNull();
  });

  it("hasEffect separa o que muda alguma coisa do que é inerte", () => {
    expect(hasEffect(parseMoveEffect(ember))).toBe(true);
    expect(hasEffect(null)).toBe(false);
  });
});
