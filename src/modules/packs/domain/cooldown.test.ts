import { describe, expect, it } from "vitest";
import { canOpenFree, FREE_PACK_INTERVAL_MS, nextFreePackAt } from "./cooldown";

const T0 = new Date("2026-07-14T12:00:00.000Z");
const now0 = T0.getTime();

describe("nextFreePackAt", () => {
  it("conta nova (nunca abriu) => null (pode abrir agora)", () => {
    expect(nextFreePackAt(null)).toBeNull();
  });
  it("soma 24h ao último pacote", () => {
    expect(nextFreePackAt(T0)!.getTime()).toBe(now0 + FREE_PACK_INTERVAL_MS);
  });
});

describe("canOpenFree", () => {
  it("nunca abriu => pode", () => {
    expect(canOpenFree(null, now0)).toBe(true);
  });
  it("abriu agora => NÃO pode (dentro da janela de 24h)", () => {
    expect(canOpenFree(T0, now0 + 1000)).toBe(false);
  });
  it("faltando 1s pra 24h => ainda NÃO pode", () => {
    expect(canOpenFree(T0, now0 + FREE_PACK_INTERVAL_MS - 1000)).toBe(false);
  });
  it("exatamente 24h depois => pode", () => {
    expect(canOpenFree(T0, now0 + FREE_PACK_INTERVAL_MS)).toBe(true);
  });
});
