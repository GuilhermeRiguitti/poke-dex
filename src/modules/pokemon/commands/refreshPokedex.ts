import { prisma } from "@/src/lib/prisma";
import { syncPokedex, type SyncPokedexSummary } from "./syncPokedex";

// Rotina de refresh do espelho da PokéAPI (CLAUDE.md consequência #4):
// re-sincroniza as espécies com `fetchedAt` mais antigo, em lote pequeno.
// Reaproveita o mesmo motor de cron do resolve-turns (Bearer CRON_SECRET → rota
// → command).
//
// A PAGINAÇÃO É O PRÓPRIO `fetchedAt`, e é isso que dispensa cursor: cada
// passada pega os N mais VELHOS e carimba `fetchedAt` neles, então a passada
// seguinte encontra outros N. Chamar a rota 6 vezes seguidas varre 6 lotes
// diferentes sem ninguém guardar "onde parei" — e, como não há estado, uma
// passada que falhar no meio só deixa aquelas espécies velhas pra próxima.
//
// Teto por passada porque a rota roda numa lambda: sincronizar tudo de uma vez
// estouraria o tempo (ver MAX_REFRESH_BATCH). Idempotente (upsert por apiId).
//
// QUANTO DEMORA UMA VOLTA COMPLETA = espécies ÷ (lote × passadas por mês), e o
// numerador é decisão de quem semeou (`npm run seed -- <de> <ate>`), não desta
// constante. Com as 1025 espelhadas e o agendamento de hoje (6 lotes de 50, 1×
// por mês) a volta leva ~3,4 meses — e isso SOBRA, porque dado de geração já
// lançada não muda.
//
// ⚠️ O que este cron NÃO serve pra fazer: PREENCHER campo novo. Quando o código
// passa a ler algo que o espelho nunca gravou (foi o caso do `Move.effect`, em
// 2026-08-12), esperar a volta do cron é esperar meses. Backfill é o seed, na
// faixa toda, rodado à mão.
const DEFAULT_REFRESH_BATCH = 20;

/**
 * TETO DURO do lote, e ele NÃO é gosto: cada espécie puxa a si + o species +
 * (às vezes) a cadeia de evolução + os moves dela, e tudo isso tem que caber
 * numa invocação de função da Vercel. O plano Hobby dá no máximo 60s
 * (`maxDuration` na rota) — a ~1s por espécie, 50 já usa a folga inteira.
 *
 * Passar disso não faz o refresh ser mais rápido: faz a função ser MORTA no
 * meio, e aí as espécies daquele lote nem `fetchedAt` novo recebem — a passada
 * seguinte pega as MESMAS, e o refresh trava num loop que nunca avança.
 */
export const MAX_REFRESH_BATCH = 50;

/** O lote pedido, preso na faixa que a lambda aguenta. Puro, tem teste. */
export function clampRefreshBatch(requested: number | null | undefined): number {
  if (typeof requested !== "number" || !Number.isFinite(requested)) return DEFAULT_REFRESH_BATCH;
  return Math.max(1, Math.min(MAX_REFRESH_BATCH, Math.floor(requested)));
}

export interface RefreshPokedexSummary extends SyncPokedexSummary {
  batch: number;
}

export interface RefreshPokedexOptions {
  /** quantas espécies (as mais antigas) re-sincronizar nesta passada. */
  batch?: number;
}

export async function refreshPokedex(
  { batch: requested }: RefreshPokedexOptions = {},
): Promise<RefreshPokedexSummary> {
  const batch = clampRefreshBatch(requested);
  const stalest = await prisma.pokemon.findMany({
    orderBy: { fetchedAt: "asc" },
    take: batch,
    select: { pokemonApiId: true },
  });

  const apiIds = stalest.map((p) => p.pokemonApiId);
  const summary = await syncPokedex(apiIds);

  return { ...summary, batch: apiIds.length };
}
