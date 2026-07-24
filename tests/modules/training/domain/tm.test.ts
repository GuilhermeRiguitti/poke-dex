import { describe, expect, it } from "vitest";
import { checkTmTeachable } from "@/src/modules/training/domain/tm";

// Regra pura de "pode ensinar por TM?", antes de gastar token.
describe("checkTmTeachable", () => {
  it("libera um golpe de máquina ainda não concedido", () => {
    expect(checkTmTeachable("machine", false)).toBe("ok");
  });

  it("recusa golpe que a espécie aprende por OUTRO método (level-up/egg/tutor)", () => {
    expect(checkTmTeachable("level-up", false)).toBe("not_machine_move");
    expect(checkTmTeachable("egg", false)).toBe("not_machine_move");
    expect(checkTmTeachable("tutor", false)).toBe("not_machine_move");
  });

  it("recusa golpe que a espécie nem conhece (learnMethod null)", () => {
    expect(checkTmTeachable(null, false)).toBe("not_machine_move");
  });

  it("já concedido → already_known (o command usa isso pra NÃO cobrar token)", () => {
    expect(checkTmTeachable("machine", true)).toBe("already_known");
  });
});
