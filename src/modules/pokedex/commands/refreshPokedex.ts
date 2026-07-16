import { prisma } from "@/src/lib/prisma";
import { syncPokedex, type SyncPokedexSummary } from "./syncPokedex";

// Rotina de refresh do espelho da PokéAPI (PLANO_JOGO.md §7): re-sincroniza as
// espécies com `fetchedAt` mais antigo, em lote pequeno. Reaproveita o mesmo
// motor de cron que já subimos (Bearer CRON_SECRET → rota → command); o pg_cron
// do Supabase dispara 1×/dia — dado de geração já lançada quase não muda, então
// varrer devagar sobra.
//
// Teto por passada porque a rota roda numa lambda: sincronizar tudo de uma vez
// estouraria o tempo. A cada disparo pega os N mais velhos; ao longo dos dias a
// tabela inteira gira. Idempotente (o sync é upsert por apiId).

export const DEFAULT_REFRESH_BATCH = 50;

export interface RefreshPokedexSummary extends SyncPokedexSummary {
  batch: number;
}

export interface RefreshPokedexOptions {
  /** quantas espécies (as mais antigas) re-sincronizar nesta passada. */
  batch?: number;
}

export async function refreshPokedex(
  { batch = DEFAULT_REFRESH_BATCH }: RefreshPokedexOptions = {},
): Promise<RefreshPokedexSummary> {
  const stalest = await prisma.pokemon.findMany({
    orderBy: { fetchedAt: "asc" },
    take: batch,
    select: { pokemonApiId: true },
  });

  const apiIds = stalest.map((p) => p.pokemonApiId);
  const summary = await syncPokedex(apiIds);

  return { ...summary, batch: apiIds.length };
}
