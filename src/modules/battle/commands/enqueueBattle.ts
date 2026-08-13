import type { Prisma } from "@prisma/client";
import { prisma } from "@/src/lib/prisma";
import { DECK_LIMIT, readDeckSlots } from "@/src/modules/deck";
import type { BattlePokemonState } from "../domain/types";
import { buildDuelSnapshot } from "./buildDuelSnapshot";
import { tryResolveTurn } from "./resolveTurn";

const MAX_MATCH_ATTEMPTS = 3;

function toPokemonCreateInput(
  state: BattlePokemonState,
  spriteUrl: string | null
): Prisma.BattlePokemonCreateWithoutParticipantInput {
  return {
    slot: state.slot,
    userPokemonId: state.userPokemonId ?? null,
    pokemonId: state.pokemonId,
    name: state.name,
    spriteUrl,
    types: state.types as unknown as Prisma.InputJsonValue,
    level: state.level,
    stats: state.stats as unknown as Prisma.InputJsonValue,
    maxHp: state.maxHp,
    currentHp: state.currentHp,
    fainted: state.fainted,
    moves: state.moves as unknown as Prisma.InputJsonValue,
    // Estado alterado inicial: limpo. Escrito na criação (e não deixado NULL)
    // pra a partida nova já nascer com a forma que o resolveTurn grava depois.
    conditions: (state.conditions ?? {}) as unknown as Prisma.InputJsonValue,
  };
}

// Entra na fila de matchmaking; pareia na hora se possível (POST /api/battle/queue)
export async function enqueueBattle(userId: string, deckId: string) {
  const slots = await readDeckSlots(userId, deckId, DECK_LIMIT);
  if (slots.length === 0) return { error: "empty_deck" as const };

  // Já estou numa partida em andamento? Então é pra lá que eu volto — não entro
  // na fila de novo.
  //
  // MAS: essa partida pode estar ZUMBI. Se os dois jogadores fecharam a aba,
  // ninguém faz polling, e sem polling nada resolve o turno pelo lado da Vercel
  // (não há worker — CLAUDE.md, regra 5). Ela fica IN_PROGRESS, e como este
  // check devolve ela, os DOIS ficam presos fora do matchmaking.
  //
  // Hoje existe backstop: o job `resolve-battle-turns` do pg_cron do Supabase
  // roda a cada 30s e chama resolveDueBattles, que encerra a zumbi sem ninguém
  // olhando. Mesmo assim este tryResolveTurn fica, por dois motivos:
  //  - LATÊNCIA: o jogador que voltou não espera o próximo tick pra destravar;
  //    resolve no próprio request e segue pra fila.
  //  - GARANTIA: o job é agendado FORA de migration (a URL é do ambiente — ver
  //    supabase/migrations/20260715022134), então um ambiente novo sobe sem ele.
  //
  // Encerrar é retroativo: tryResolveTurn conta as janelas de timeout vencidas
  // desde turnStartedAt, e uma partida abandonada há tempo suficiente morre aqui
  // em ABANDONED — sem esperar 3×90s.
  //
  // O UPDATE que isso gera dispara o trigger battle_broadcast_update: se o outro
  // jogador estiver com a aba aberta, ele recebe `battle_updated` no canal
  // battle:<id> e refaz o GET. O broadcast sai do banco; não há nada a chamar
  // daqui (REALTIME.md).
  const existingBattle = await prisma.battleParticipant.findFirst({
    where: { userId, battle: { status: "IN_PROGRESS" } },
    select: { battleId: true },
  });
  if (existingBattle) {
    const resolved = await tryResolveTurn(existingBattle.battleId);
    if (resolved?.status === "IN_PROGRESS") {
      return { matched: true as const, battleId: existingBattle.battleId };
    }
  }

  let opponent: { userId: string; deckId: string } | null = null;

  for (let attempt = 0; attempt < MAX_MATCH_ATTEMPTS && !opponent; attempt++) {
    opponent = await prisma.$transaction(async (tx) => {
      const candidate = await tx.matchmakingQueueEntry.findFirst({
        where: { userId: { not: userId } },
        orderBy: { enqueuedAt: "asc" },
      });
      if (!candidate) return null;

      const deleted = await tx.matchmakingQueueEntry.deleteMany({ where: { id: candidate.id } });
      if (deleted.count === 0) return null; // outro request já pegou esse candidato, tenta de novo

      return { userId: candidate.userId, deckId: candidate.deckId };
    });
  }

  if (!opponent) {
    await prisma.matchmakingQueueEntry.upsert({
      where: { userId },
      update: { deckId, enqueuedAt: new Date() },
      create: { userId, deckId },
    });
    return { matched: false as const, queued: true as const };
  }

  await prisma.matchmakingQueueEntry.deleteMany({ where: { userId } });

  // `allSettled`, e não `all`, porque IMPORTA de QUEM é o deck que falhou.
  //
  // Montar o snapshot pode lançar (deck sumiu, loadout sem carta). Antes, um
  // catch só devolvia o oponente pra fila em qualquer caso — e se o deck
  // quebrado fosse justamente o DELE, ele voltava pra fila com o mesmo defeito e
  // derrubava o pareamento do próximo jogador, e do próximo. Um único deck ruim
  // parado na fila travava o matchmaking de TODO MUNDO, e não há cron de faxina
  // que resolva isso (o pg_cron só resolve turno; ver ROTINAS.md §2).
  //
  // Regra: só volta pra fila quem tem deck jogável. Quem falhou fica de fora até
  // arrumar — o erro aparece pra ele no próprio POST quando tentar de novo.
  const [mine, theirs] = await Promise.allSettled([
    buildDuelSnapshot(userId, deckId),
    buildDuelSnapshot(opponent.userId, opponent.deckId),
  ]);

  if (mine.status === "rejected" || theirs.status === "rejected") {
    if (mine.status === "rejected") console.error("buildDuelSnapshot (jogador) falhou:", mine.reason);
    if (theirs.status === "rejected") console.error("buildDuelSnapshot (oponente) falhou:", theirs.reason);

    if (theirs.status === "fulfilled") {
      // O deck quebrado é o MEU: o oponente volta pra fila, sem prejuízo.
      await prisma.matchmakingQueueEntry.upsert({
        where: { userId: opponent.userId },
        update: { deckId: opponent.deckId, enqueuedAt: new Date() },
        create: { userId: opponent.userId, deckId: opponent.deckId },
      });
      return { error: "snapshot_failed" as const };
    }

    // O deck quebrado é o DELE (já saiu da fila lá em cima e NÃO volta). Se o meu
    // está ok, eu assumo o lugar na fila em vez de levar um erro por culpa alheia.
    if (mine.status === "fulfilled") {
      await prisma.matchmakingQueueEntry.upsert({
        where: { userId },
        update: { deckId, enqueuedAt: new Date() },
        create: { userId, deckId },
      });
      return { matched: false as const, queued: true as const };
    }
    return { error: "snapshot_failed" as const };
  }

  const teamA = mine.value;
  const teamB = theirs.value;

  // Nada de "quem começa": no simultâneo os dois já estão em turno a partir da
  // rodada 1, e a ordem de execução é decidida DENTRO de cada turno, pela carta
  // escolhida + Speed (domain/turnOrder.ts).
  const battle = await prisma.battle.create({
    data: {
      round: 1,
      participants: {
        create: [
          {
            userId,
            activeSlot: 1,
            pokemons: { create: teamA.map(({ state, spriteUrl }) => toPokemonCreateInput(state, spriteUrl)) },
          },
          {
            userId: opponent.userId,
            activeSlot: 1,
            pokemons: { create: teamB.map(({ state, spriteUrl }) => toPokemonCreateInput(state, spriteUrl)) },
          },
        ],
      },
    },
  });

  return { matched: true as const, battleId: battle.id, created: true as const };
}
