import "server-only";

import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";

// Freio de frequência das rotas de escrita do APP (as do better-auth têm o freio
// nativo dele, que grava na MESMA tabela — ver o comentário do model RateLimit).
//
// Por que tabela e não memória: em serverless não existe processo entre
// requests, então `Map` global é zerado a cada lambda nova (CLAUDE.md
// consequência #1). Um rate limit que esquece não é rate limit.
//
// JANELA FIXA, não deslizante. A janela desliza só quando expira inteira: dentro
// dela o contador sobe até o teto e trava. É mais frouxo que uma janela
// deslizante na virada (dá pra emendar dois lotes em cima da fronteira), e isso
// é aceito de propósito — o alvo aqui é o script em loop, não o atacante que
// cronometra a virada. O que uma janela deslizante custaria é guardar N
// timestamps por chave em vez de um contador, e aí a tabela cresce com o tráfego.

/** Epoch ms. Coluna definida pelo better-auth, por isso BigInt e não DateTime. */
function nowMs(now: Date): bigint {
  return BigInt(now.getTime());
}

export interface RateLimitResult {
  /** false = pedido recusado; a rota devolve 429. */
  ok: boolean;
  /** Quanto falta pra janela virar, em segundos (vai no header Retry-After). */
  retryAfterSec: number;
}

/**
 * Consome 1 do orçamento de `key`. Chame ANTES de fazer o trabalho da rota.
 *
 * Concorrência (CLAUDE.md regra 6): dois requests do mesmo usuário caem em
 * lambdas diferentes ao mesmo tempo. O incremento é atômico no banco
 * (`update ... count: { increment: 1 }`), então nenhum dos dois lê-e-escreve um
 * valor velho. A corrida que sobra é a de CRIAR a linha — fechada pelo
 * `@unique(key)` no `upsert`: o segundo a chegar cai no ramo de update.
 *
 * Fail-OPEN de propósito: se o banco cair, a rota passa em vez de travar o jogo
 * inteiro. O freio é contra abuso, não é controle de acesso — quem protege dado
 * é a sessão e o `where` escopado por dono, e esses não têm exceção nenhuma.
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: Date = new Date(),
): Promise<RateLimitResult> {
  const ts = nowMs(now);

  try {
    // Abre a linha se não existe; se existe, o update é atômico. `count: 1` no
    // create já conta ESTE pedido.
    const row = await prisma.rateLimit.upsert({
      where: { key },
      create: { key, count: 1, lastRequest: ts },
      update: { count: { increment: 1 } },
      select: { count: true, lastRequest: true },
    });

    const elapsed = Number(ts - row.lastRequest);

    // Janela vencida: reabre zerando. O `where` repete `lastRequest` pra virar
    // claim — se outra lambda já reabriu, esta não zera por cima (o que faria o
    // contador do outro sumir e o teto virar o dobro).
    if (elapsed >= windowMs) {
      // Quem perde este claim (count 0) não escreve nada: o vencedor já abriu a
      // janela nova e contou o pedido dele. Este entra na mesma janela e passa —
      // é 1 pedido a mais no orçamento, não um furo no teto.
      await prisma.rateLimit.updateMany({
        where: { key, lastRequest: row.lastRequest },
        data: { count: 1, lastRequest: ts },
      });
      return { ok: true, retryAfterSec: 0 };
    }

    if (row.count > limit) {
      return { ok: false, retryAfterSec: Math.ceil((windowMs - elapsed) / 1000) };
    }

    return { ok: true, retryAfterSec: 0 };
  } catch {
    // Ver "fail-OPEN" acima.
    return { ok: true, retryAfterSec: 0 };
  }
}

/** Tetos por rota. Ficam juntos pra dar pra ler o orçamento inteiro de uma vez. */
export const RATE_LIMITS = {
  /** Salvar o time inteiro: o jogador arrasta bastante, mas não 30× por minuto. */
  deckSave: { limit: 30, windowMs: 60_000 },
  /** Entrar na fila: cada tentativa monta 2 snapshots de duelo. */
  battleQueue: { limit: 20, windowMs: 60_000 },
  /** Ensinar TM: já é limitado por token, o freio é contra o loop. */
  teachTm: { limit: 20, windowMs: 60_000 },
  /** Check-in: por desenho acontece 1× por dia. */
  checkIn: { limit: 10, windowMs: 60_000 },
  /** Abrir pacote: já tem cooldown de 24h; o freio é contra o loop. */
  openPack: { limit: 20, windowMs: 60_000 },
  /** Soltar carta: destrutivo, e ninguém solta 30 por minuto na mão. */
  removeCard: { limit: 30, windowMs: 60_000 },
  /** Token de realtime: 1 por entrada em partida. */
  realtimeToken: { limit: 30, windowMs: 60_000 },
  /** Criar oferta de troca: o jogador oferece uma carta de cada vez. */
  tradeOffer: { limit: 20, windowMs: 60_000 },
  /**
   * ACEITAR troca é o único teto que existe por SEGURANÇA, não por cortesia:
   * é a única rota do jogo onde acertar um valor que você não tem dá um prêmio.
   * 10 tentativas a cada 10 min contra 6,5×10¹¹ códigos possíveis torna a força
   * bruta absurda — varrer 1% do espaço levaria mais de mil anos por conta.
   */
  tradeAccept: { limit: 10, windowMs: 10 * 60_000 },
  /** Cruzar: já é 1 por dia UTC; o freio é contra o loop de tentativa. */
  breed: { limit: 20, windowMs: 60_000 },
  /** Resgatar quest: são 3 por dia; o freio é contra o loop. */
  questClaim: { limit: 20, windowMs: 60_000 },
} as const;

/**
 * Casca de rota: devolve a resposta 429 pronta, ou `null` pra seguir.
 *
 * ⚠️ NÃO use isto no `GET /api/battle/[id]/status`. Aquele endpoint é o MOTOR do
 * jogo — 2 jogadores × 1 request a cada 2s — e é ele que resolve o turno
 * (CLAUDE.md consequência #1). Pôr teto ali é travar a partida, não conter abuso.
 */
export async function enforceRateLimit(
  scope: keyof typeof RATE_LIMITS,
  userId: string,
  now: Date = new Date(),
): Promise<NextResponse | null> {
  const { limit, windowMs } = RATE_LIMITS[scope];
  // Prefixo `app:` separa das chaves que o better-auth grava na MESMA tabela.
  const result = await checkRateLimit(`app:${scope}:${userId}`, limit, windowMs, now);
  if (result.ok) return null;

  return NextResponse.json(
    { error: "rate_limited" },
    { status: 429, headers: { "Retry-After": String(result.retryAfterSec) } },
  );
}
