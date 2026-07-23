import { describe, expect, it } from "vitest";
import {
  isUnlockedAt,
  pickLearnEntry,
  pickVersionGroup,
  VERSION_GROUP_PREFERENCE,
  type LearnDetail,
} from "@/src/modules/pokedex/domain/learnset";

// Estes dados imitam a forma do `version_group_details` da PokéAPI: o mesmo
// move aparece várias vezes, uma por jogo, com nível e método diferentes.
const detail = (versionGroup: string, learnMethod: string, levelLearnedAt = 0): LearnDetail => ({
  versionGroup,
  learnMethod,
  levelLearnedAt,
});

describe("pickVersionGroup", () => {
  it("escolhe o jogo MAIS RECENTE em que a espécie aprende algo por level-up", () => {
    const details = [
      detail("red-blue", "level-up", 1),
      detail("x-y", "level-up", 5),
      detail("sword-shield", "level-up", 3),
    ];
    expect(pickVersionGroup(details)).toBe("sword-shield");
  });

  it("IGNORA jogo em que a espécie só tem TM (senão o pokémon nasceria sem nada a destravar)", () => {
    const details = [detail("scarlet-violet", "machine"), detail("x-y", "level-up", 5)];
    expect(pickVersionGroup(details)).toBe("x-y");
  });

  it("devolve null quando não há level-up em jogo nenhum", () => {
    expect(pickVersionGroup([detail("x-y", "machine"), detail("x-y", "egg")])).toBeNull();
    expect(pickVersionGroup([])).toBeNull();
  });

  it("não trava num version group desconhecido (jogo novo que a lista ainda não tem)", () => {
    const picked = pickVersionGroup([detail("jogo-do-futuro", "level-up", 1)]);
    expect(picked).toBe("jogo-do-futuro");
    expect(VERSION_GROUP_PREFERENCE).not.toContain("jogo-do-futuro");
  });
});

describe("pickLearnEntry", () => {
  it("prefere level-up quando o move também é TM no mesmo jogo", () => {
    const details = [detail("x-y", "machine"), detail("x-y", "level-up", 22)];
    expect(pickLearnEntry(details, "x-y")).toEqual({
      levelLearnedAt: 22,
      learnMethod: "level-up",
      versionGroup: "x-y",
    });
  });

  it("empatado o método, fica com o menor nível", () => {
    const details = [detail("x-y", "level-up", 30), detail("x-y", "level-up", 12)];
    expect(pickLearnEntry(details, "x-y")?.levelLearnedAt).toBe(12);
  });

  it("ignora entradas de OUTRO jogo (é isso que impede o learnset de virar salada de gerações)", () => {
    const details = [detail("red-blue", "level-up", 1), detail("x-y", "level-up", 40)];
    expect(pickLearnEntry(details, "x-y")?.levelLearnedAt).toBe(40);
    expect(pickLearnEntry(details, "sword-shield")).toBeNull();
  });
});

describe("isUnlockedAt", () => {
  it("libera level-up no nível exigido, e não antes", () => {
    const entry = { learnMethod: "level-up", levelLearnedAt: 22 };
    expect(isUnlockedAt(entry, 21)).toBe(false);
    expect(isUnlockedAt(entry, 22)).toBe(true);
    expect(isUnlockedAt(entry, 60)).toBe(true);
  });

  it("NÃO libera TM/ovo/tutor — só level-up vira carta hoje", () => {
    expect(isUnlockedAt({ learnMethod: "machine", levelLearnedAt: 0 }, 100)).toBe(false);
    expect(isUnlockedAt({ learnMethod: "egg", levelLearnedAt: 0 }, 100)).toBe(false);
    expect(isUnlockedAt({ learnMethod: "tutor", levelLearnedAt: 0 }, 100)).toBe(false);
  });
});
