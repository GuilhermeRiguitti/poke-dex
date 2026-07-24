import { prisma } from "@/src/lib/prisma";
import {
  alreadyCheckedInToday,
  earnsReward,
  nextStreak,
  startOfUtcDay,
} from "../domain/streak";

export interface CheckInResult {
  /** true se HOJE contou (novo dia); false se já tinha contado ou perdeu a corrida */
  checkedIn: boolean;
  streak: number;
  awardedPack: boolean;
  extraPacks: number;
}

/**
 * Marca a presença diária do jogador: conta dias seguidos (loginStreak) e, a
 * cada 7 seguidos, concede 1 pacote-bônus (extraPacks). É a peça da Fase 3 que
 * ALIMENTA o extraPacks que o openPack já sabe gastar.
 *
 * Disparado por request (não há worker): o <DailyCheckIn> no layout de (game)
 * chama a rota uma vez por carga. Precisa ser IDEMPOTENTE por dia — duas abas /
 * dois refreshes no mesmo dia não podem contar duas vezes nem dar dois bônus.
 *
 * A trava é o mesmo padrão do resto do módulo (CLAUDE.md, regra 6): um único
 * `updateMany` condicionado a "ainda não fez check-in hoje". Quem perde a
 * corrida sai com count 0 e não escreve. O streak/bônus são computados da
 * leitura; sob READ COMMITTED, se dois requests disputam, o segundo reavalia o
 * WHERE contra a linha já atualizada (lastCheckIn viraria hoje) e no-opa.
 */
export async function checkInLogin(userId: string, now = new Date()): Promise<CheckInResult> {
  const state = await prisma.packState.upsert({
    where: { userId },
    create: { userId },
    update: {},
    select: { lastCheckIn: true, loginStreak: true, extraPacks: true },
  });

  // Caminho comum (já entrou hoje): nada a fazer, evita o updateMany à toa.
  if (alreadyCheckedInToday(state.lastCheckIn, now)) {
    return {
      checkedIn: false,
      streak: state.loginStreak,
      awardedPack: false,
      extraPacks: state.extraPacks,
    };
  }

  const streak = nextStreak(state.loginStreak, state.lastCheckIn, now);
  const award = earnsReward(streak);
  const todayStart = startOfUtcDay(now);

  const claim = await prisma.packState.updateMany({
    where: { userId, OR: [{ lastCheckIn: null }, { lastCheckIn: { lt: todayStart } }] },
    data: {
      lastCheckIn: now,
      loginStreak: streak,
      // +1 token de TM por check-in diário (a fonte de TM do MVP). Vai junto do
      // MESMO claim idempotente-por-dia, então refresh não farma token; um dia,
      // um token. Ver training/applyTM (o gasto).
      tmTokens: { increment: 1 },
      ...(award ? { extraPacks: { increment: 1 } } : {}),
    },
  });

  if (claim.count === 0) {
    // Outra aba/lambda já fez o check-in de hoje. Relê o estado real (a leitura
    // acima é anterior ao claim vencedor) e devolve sem creditar nada.
    const fresh = await prisma.packState.findUniqueOrThrow({
      where: { userId },
      select: { loginStreak: true, extraPacks: true },
    });
    return { checkedIn: false, streak: fresh.loginStreak, awardedPack: false, extraPacks: fresh.extraPacks };
  }

  return {
    checkedIn: true,
    streak,
    awardedPack: award,
    extraPacks: state.extraPacks + (award ? 1 : 0),
  };
}
