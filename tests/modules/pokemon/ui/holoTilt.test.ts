import { describe, expect, it } from "vitest";
import { computeHoloTilt, HOLO_REST } from "@/src/layout/holoTilt";

describe("computeHoloTilt", () => {
  it("no centro não inclina e põe o brilho no meio", () => {
    expect(computeHoloTilt(0.5, 0.5, 12)).toEqual(HOLO_REST);
  });

  it("canto superior direito: rotateY no máximo positivo, rotateX no máximo positivo", () => {
    const t = computeHoloTilt(1, 0, 12);
    expect(t.rotateY).toBe(12);
    expect(t.rotateX).toBe(12);
    expect(t.glareX).toBe(100);
    expect(t.glareY).toBe(0);
  });

  it("canto inferior esquerdo: rotações no máximo negativo", () => {
    const t = computeHoloTilt(0, 1, 12);
    expect(t.rotateY).toBe(-12);
    expect(t.rotateX).toBe(-12);
    expect(t.glareX).toBe(0);
    expect(t.glareY).toBe(100);
  });

  it("a amplitude escala com maxDeg", () => {
    expect(computeHoloTilt(1, 0.5, 8).rotateY).toBe(8);
    expect(computeHoloTilt(1, 0.5, 20).rotateY).toBe(20);
  });

  it("grampeia o ponteiro que sai da carta (0..1)", () => {
    const over = computeHoloTilt(1.4, -0.3, 12);
    expect(over.rotateY).toBe(12); // como se fosse 1
    expect(over.rotateX).toBe(12); // como se fosse 0
    expect(over.glareX).toBe(100);
    expect(over.glareY).toBe(0);
  });

  it("NaN cai no centro em vez de propagar", () => {
    expect(computeHoloTilt(NaN, NaN, 12)).toEqual(HOLO_REST);
  });
});
