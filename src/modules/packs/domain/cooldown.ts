// Regras do cooldown do pacote diário. PURAS: sem Prisma, sem fetch, sem React.

/** Um pacote grátis a cada 24h. */
export const FREE_PACK_INTERVAL_MS = 24 * 60 * 60 * 1000;

/**
 * Quando o próximo pacote grátis fica disponível. `null` = pode abrir AGORA
 * (nunca abriu, ou o intervalo já venceu não entra aqui — ver canOpenFree).
 *
 * `lastFreePackAt` null (conta nova, nunca abriu) devolve null de propósito: o
 * primeiro pacote está disponível de cara, então a conta nasce jogável sem
 * precisar de um "pacote inicial" separado.
 */
export function nextFreePackAt(lastFreePackAt: Date | null): Date | null {
  if (!lastFreePackAt) return null;
  return new Date(lastFreePackAt.getTime() + FREE_PACK_INTERVAL_MS);
}

/** O pacote grátis já pode ser aberto? */
export function canOpenFree(lastFreePackAt: Date | null, now = Date.now()): boolean {
  const next = nextFreePackAt(lastFreePackAt);
  return next === null || next.getTime() <= now;
}
