import type { DuelSide } from "./duelTypes";

// Iniciativa (PLANO_JOGO.md §3.1): no começo de cada RODADA, quem tem Speed
// efetivo maior age primeiro. O Speed volta a ser decisão de build, não
// decoração — no alternado ingênuo quem joga em 2º sempre tem mais informação;
// alternar quem começa por Speed é parte da cura desse desequilíbrio.
//
// Desempate DETERMINÍSTICO por userId (localeCompare), igual ao critério que o
// modelo antigo já usa pra rotular os lados (resolveTurn.ts): a ordem precisa
// ser reconstruível igual nas duas lambdas concorrentes e no client, então NÃO
// pode depender de rng nem da ordem de retorno do Prisma.

/** Ordem de iniciativa da rodada: [primeiro, segundo] por Speed, desempate por id. */
export function computeInitiative(a: DuelSide, b: DuelSide): [string, string] {
  const speedA = a.active.stats.speed;
  const speedB = b.active.stats.speed;
  if (speedA !== speedB) {
    return speedA > speedB ? [a.userId, b.userId] : [b.userId, a.userId];
  }
  // Speed empatado: menor userId (ordem lexicográfica) começa. Estável.
  return a.userId.localeCompare(b.userId) <= 0 ? [a.userId, b.userId] : [b.userId, a.userId];
}
