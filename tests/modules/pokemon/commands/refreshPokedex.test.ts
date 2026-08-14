import { describe, expect, it } from "vitest";
import { MAX_REFRESH_BATCH, clampRefreshBatch } from "@/src/modules/pokemon/commands/refreshPokedex";

// O lote do refresh vem de FORA (query string do cron, que vive no Supabase e
// não no repo). O clamp é a única coisa que impede um agendamento errado de
// matar a função no meio do lote — e lote morto no meio não carimba
// `fetchedAt`, o que faz a passada seguinte pegar as MESMAS espécies e o cron
// travar num loop que nunca avança.

describe("clampRefreshBatch", () => {
  it("respeita o que foi pedido dentro da faixa", () => {
    expect(clampRefreshBatch(50)).toBe(50);
    expect(clampRefreshBatch(1)).toBe(1);
  });

  it("prende no teto da lambda — pedir 500 devolve o máximo, não um timeout", () => {
    expect(clampRefreshBatch(500)).toBe(MAX_REFRESH_BATCH);
    expect(clampRefreshBatch(171)).toBe(MAX_REFRESH_BATCH); // 1025 ÷ 6 lotes: não cabe
  });

  it("sem pedido (ou pedido inválido) cai no default", () => {
    expect(clampRefreshBatch(undefined)).toBe(20);
    expect(clampRefreshBatch(null)).toBe(20);
    expect(clampRefreshBatch(NaN)).toBe(20);
  });

  it("nunca devolve zero ou negativo — lote vazio seria disparo à toa", () => {
    expect(clampRefreshBatch(0)).toBe(1);
    expect(clampRefreshBatch(-10)).toBe(1);
    expect(clampRefreshBatch(2.9)).toBe(2);
  });
});
