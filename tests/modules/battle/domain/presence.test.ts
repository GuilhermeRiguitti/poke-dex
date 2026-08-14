import { describe, expect, it } from "vitest";
import {
  PRESENCE_HEARTBEAT_MS,
  PRESENCE_TIMEOUT_MS,
  absenceRemainingMs,
  absentOutcome,
  isAbsent,
  isPresent,
} from "@/src/modules/battle/domain/presence";

const NOW = new Date("2026-08-14T12:00:00.000Z");
const antes = (ms: number) => new Date(NOW.getTime() - ms);

describe("isAbsent", () => {
  it("quem carimbou agora está presente", () => {
    expect(isAbsent(NOW, antes(999_999), NOW)).toBe(false);
  });

  it("a borda exata do timeout ainda NÃO é ausência", () => {
    expect(isAbsent(antes(PRESENCE_TIMEOUT_MS), antes(999_999), NOW)).toBe(false);
    expect(isAbsent(antes(PRESENCE_TIMEOUT_MS + 1), antes(999_999), NOW)).toBe(true);
  });

  it("quem NUNCA carimbou é medido pelo piso, não desde a época", () => {
    // ⚠️ O caso mais perigoso: sem piso, `lastSeenAt` null viraria "ausente desde
    // 1970" e TODA partida nasceria abandonada no primeiro poll.
    const partidaNova = antes(5_000);
    expect(isAbsent(null, partidaNova, NOW)).toBe(false);

    const partidaVelha = antes(PRESENCE_TIMEOUT_MS + 1);
    expect(isAbsent(null, partidaVelha, NOW)).toBe(true);
  });

  it("o piso é ignorado quando existe carimbo", () => {
    // Partida antiga, mas o jogador acabou de dar sinal → presente.
    expect(isAbsent(antes(1_000), antes(999_999), NOW)).toBe(false);
  });
});

describe("absentOutcome", () => {
  const a = { userId: "alpha", absent: false };
  const b = { userId: "beta", absent: false };

  it("ninguém sumiu => segue o jogo", () => {
    expect(absentOutcome(a, b)).toBeNull();
  });

  it("um sumiu => o outro vence", () => {
    expect(absentOutcome({ ...a, absent: true }, b)).toEqual({
      finalStatus: "ABANDONED",
      winnerId: "beta",
    });
    expect(absentOutcome(a, { ...b, absent: true })).toEqual({
      finalStatus: "ABANDONED",
      winnerId: "alpha",
    });
  });

  it("os DOIS sumiram => sem vencedor", () => {
    // Coerente com o abandono mútuo por missedTurns. Premiar quem "saiu menos"
    // seria inventar um critério que o resto do jogo não tem.
    expect(absentOutcome({ ...a, absent: true }, { ...b, absent: true })).toEqual({
      finalStatus: "ABANDONED",
      winnerId: null,
    });
  });
});

describe("os dois limiares", () => {
  it("o de AVISAR vem antes do de ENCERRAR", () => {
    // Se a tela só dissesse "desconectado" no instante em que a partida acaba, o
    // aviso não avisaria nada.
    const doisSinaisPerdidos = antes(PRESENCE_HEARTBEAT_MS * 2 + 1);
    expect(isPresent(doisSinaisPerdidos, antes(999_999), NOW)).toBe(false);
    expect(isAbsent(doisSinaisPerdidos, antes(999_999), NOW)).toBe(false);
  });

  it("o heartbeat é bem mais curto que o timeout", () => {
    // Com 20s contra 60s, é preciso perder TRÊS batidas seguidas pra ser dado
    // como ausente. Igualar os dois faria um engasgo de rede custar a partida.
    expect(PRESENCE_HEARTBEAT_MS * 3).toBeLessThanOrEqual(PRESENCE_TIMEOUT_MS);
  });
});

describe("absenceRemainingMs", () => {
  it("conta o que falta pra derrota", () => {
    expect(absenceRemainingMs(antes(40_000), antes(999_999), NOW)).toBe(20_000);
  });

  it("nunca fica negativo", () => {
    expect(absenceRemainingMs(antes(999_999), antes(999_999), NOW)).toBe(0);
  });
});
