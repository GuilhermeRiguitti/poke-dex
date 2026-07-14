/** O mínimo que dá pra decidir acesso: quem está na partida. */
interface BattleParticipants {
  participants: { userId: string }[];
}

/**
 * "Esse usuário está nessa partida?" — e nada além disso.
 *
 * PURA de propósito: recebe a partida JÁ LIDA em vez de fazer a própria query.
 *
 * Por que isso importa. getBattleState e getBattleStatus resolvem o turno, o
 * que ESCREVE no banco e, num cache miss da matriz de tipos, BATE NA POKÉAPI.
 * Antes elas resolviam o turno primeiro e checavam o participante depois: o 403
 * saía certo, mas a partida dos outros já tinha sido mexida e a chamada de rede
 * já tinha saído em nome dela.
 *
 * A primeira tentativa de correção deu a esta checagem uma query própria — só
 * que /status é polling de 2s dos DOIS jogadores, então virava um SELECT a mais
 * por poll, por jogador, num deploy serverless atrás de um pooler. Sendo pura,
 * ela reusa a MESMA leitura que a resolução do turno já ia fazer
 * (loadBattleForResolve): autorizar antes de escrever passou a custar zero
 * query.
 */
export function isParticipant(battle: BattleParticipants, userId: string): boolean {
  return battle.participants.some((p) => p.userId === userId);
}
