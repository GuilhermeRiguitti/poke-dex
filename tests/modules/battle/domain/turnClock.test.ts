import { describe, expect, it } from "vitest";
import {
  MAX_MISSES,
  TURN_TIMEOUT_MS,
  expiredTurnWindows,
  nextMisses,
  remainingTurnMs,
} from "@/src/modules/battle/domain/turnClock";

// O relógio do turno é a MESMA conta pros dois lados: o servidor decide com ela
// se o round venceu, e a tela desenha o countdown com ela. Por isso ela é pura e
// vive no domain — duas cópias da duração seriam duas verdades, e a divergência
// só apareceria na hora em que o jogador perde o turno.

describe("expiredTurnWindows", () => {
  it("conta uma janela por período vencido, não uma só", () => {
    const now = Date.now();
    expect(expiredTurnWindows(new Date(now), now)).toBe(0);
    expect(expiredTurnWindows(new Date(now - TURN_TIMEOUT_MS - 1), now)).toBe(1);
    expect(expiredTurnWindows(new Date(now - TURN_TIMEOUT_MS * 3), now)).toBe(3);
    expect(expiredTurnWindows(new Date(now + 10_000), now)).toBe(0); // relógio torto
  });
});

describe("nextMisses", () => {
  it("quem jogou abaixa a falta; quem faltou sobe pelo número de janelas", () => {
    expect(nextMisses(2, true, 0)).toBe(1);
    expect(nextMisses(0, true, 0)).toBe(0); // nunca negativo
    expect(nextMisses(0, false, 1)).toBe(1);
    expect(nextMisses(0, false, 0)).toBe(1); // sem janela vencida ainda conta 1
  });

  it("não passa de MAX_MISSES por mais tempo que tenha passado", () => {
    expect(nextMisses(0, false, 40)).toBe(MAX_MISSES);
  });
});

describe("remainingTurnMs", () => {
  it("devolve o que sobra da janela", () => {
    const now = Date.now();
    expect(remainingTurnMs(new Date(now), now)).toBe(TURN_TIMEOUT_MS);
    expect(remainingTurnMs(new Date(now - 30_000), now)).toBe(TURN_TIMEOUT_MS - 30_000);
  });

  it("nunca passa de zero quando o tempo já venceu", () => {
    const now = Date.now();
    expect(remainingTurnMs(new Date(now - TURN_TIMEOUT_MS), now)).toBe(0);
    expect(remainingTurnMs(new Date(now - TURN_TIMEOUT_MS * 40), now)).toBe(0);
  });

  it("não promete mais tempo que a janela quando o relógio do banco está à frente", () => {
    // Se isso vazasse, a tela mostraria um tempo que o servidor não honra — e o
    // jogador levaria falta com o relógio ainda andando.
    const now = Date.now();
    expect(remainingTurnMs(new Date(now + 60_000), now)).toBe(TURN_TIMEOUT_MS);
  });
});
