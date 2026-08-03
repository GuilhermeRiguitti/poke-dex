import { Prisma } from "@prisma/client";
import { prisma } from "@/src/lib/prisma";
import { CARDS_PER_SLOT } from "@/src/modules/deck";
import { getUnlockedMoveIds } from "@/src/modules/pokedex";
import type { BattleMoveDef } from "../domain/types";
import { toBattleDTO } from "../queries/toBattleDTO";
import { tryResolveTurn } from "./resolveTurn";

// A jogada de um round: um GOLPE (MOVE) ou uma TROCA (SWITCH). `cardSlot` é o
// índice do golpe (0..5); `targetSlot` é o slot do pokémon alvo da troca (1..6).
export type SubmitActionInput = {
  round: number;
  type?: "MOVE" | "SWITCH" | "LEAD"; // ausente = MOVE (compat com o cliente antigo)
  cardSlot?: number;
  targetSlot?: number;
  /**
   * Os Move.id da barra escolhida pra quem ENTRA em campo (LEAD e SWITCH).
   *
   * A escolha de skills saiu do deck e virou decisão de batalha: você monta a
   * barra no instante em que põe o pokémon em jogo, sem ver o que o oponente
   * está fazendo. Ignorado num MOVE.
   */
  loadout?: string[];
};

type ParticipantWithMons = {
  userId: string;
  activeSlot: number;
  pokemons: { slot: number; fainted: boolean; moves: unknown; userPokemonId: string | null; level: number }[];
};

/** true se o ativo do participante desmaiou mas ainda há reserva viva → precisa trocar. */
function mustSwitch(p: ParticipantWithMons): boolean {
  const active = p.pokemons.find((m) => m.slot === p.activeSlot);
  return Boolean(active?.fainted) && p.pokemons.some((m) => !m.fainted);
}

// Registra a jogada de UM jogador no round (POST /api/battle/[id]/move).
//
// Simultâneo: não existe "é a sua vez" — os dois podem submeter a qualquer
// momento do round, e a jogada fica GUARDADA (segredo) até o outro submeter ou o
// tempo estourar. Por isso `tryResolveTurn` é chamado aqui: quem submete por
// ÚLTIMO é quem, no mesmo request, faz o turno resolver.
//
// TROCA FORÇADA (o ativo de alguém desmaiou): o jogo pausa até o dono do desmaio
// escolher o substituto. Nesse round só ELE joga (e só SWITCH); o oponente
// espera. Trocar de ideia é permitido enquanto o round não resolveu (upsert).
export async function submitAction(battleId: string, userId: string, body: SubmitActionInput) {
  const battle = await prisma.battle.findUnique({
    where: { id: battleId },
    include: { participants: { include: { pokemons: true } } },
  });
  if (!battle) return { error: "not_found" as const };
  if (battle.status !== "IN_PROGRESS") return { error: "finished" as const };

  const me = battle.participants.find((p) => p.userId === userId);
  if (!me) return { error: "forbidden" as const };

  if (body.round !== battle.round) {
    return { error: "stale_turn" as const, round: battle.round };
  }

  const type = body.type ?? "MOVE";

  // ROUND 0 = PREPARAÇÃO: só se monta a barra do líder. Nenhum golpe existe
  // ainda — é justamente a barra dele que está sendo escolhida.
  if (battle.round === 0) {
    if (type !== "LEAD") {
      return { error: "validation" as const, message: "Escolha as skills antes de começar" };
    }
    const escolha = await validarLoadout(me, me.activeSlot, body.loadout);
    if (!escolha.ok) return { error: "validation" as const, message: escolha.message };
    return persist(battleId, userId, battle.round, "LEAD", 0, escolha.loadout);
  }

  if (type === "LEAD") {
    return { error: "validation" as const, message: "A partida já começou" };
  }

  const iMustSwitch = mustSwitch(me);
  const someoneMustSwitch = battle.participants.some(mustSwitch);

  // Round de troca forçada: só o dono do desmaio joga, e só SWITCH.
  if (someoneMustSwitch) {
    if (!iMustSwitch) {
      return { error: "validation" as const, message: "Aguardando o oponente escolher um substituto" };
    }
    if (type !== "SWITCH") {
      return { error: "validation" as const, message: "Seu pokémon desmaiou — escolha um substituto" };
    }
    const target = validSwitchTarget(me, body.targetSlot);
    if (!target.ok) return { error: "validation" as const, message: target.message };
    const escolha = await validarLoadout(me, target.slot, body.loadout);
    if (!escolha.ok) return { error: "validation" as const, message: escolha.message };
    return persist(battleId, userId, battle.round, "SWITCH", target.slot, escolha.loadout);
  }

  // Round normal: MOVE (golpe) ou SWITCH (troca voluntária, gasta o turno).
  if (type === "SWITCH") {
    const target = validSwitchTarget(me, body.targetSlot);
    if (!target.ok) return { error: "validation" as const, message: target.message };
    const escolha = await validarLoadout(me, target.slot, body.loadout);
    if (!escolha.ok) return { error: "validation" as const, message: escolha.message };
    return persist(battleId, userId, battle.round, "SWITCH", target.slot, escolha.loadout);
  }

  const active = me.pokemons.find((p) => p.slot === me.activeSlot);
  if (!active || active.fainted) {
    return { error: "validation" as const, message: "Seu pokémon ativo desmaiou" };
  }

  const moves = (active.moves as unknown as BattleMoveDef[] | null) ?? [];
  const cardSlot = body.cardSlot;
  if (cardSlot == null || cardSlot < 0 || cardSlot >= moves.length) {
    return { error: "validation" as const, message: "Carta inválida" };
  }
  const card = moves[cardSlot];
  // PP zerado só é jogada válida quando NENHUMA carta tem PP (o engine usa
  // STRUGGLE). Enquanto sobrar outra com PP, o slot esgotado é recusado aqui.
  if (card.currentPp <= 0 && moves.some((m) => m.currentPp > 0)) {
    return { error: "validation" as const, message: "Essa carta está sem PP" };
  }

  return persist(battleId, userId, battle.round, "MOVE", cardSlot);
}

type LoadoutOk = { ok: true; loadout: string[] | undefined };
type LoadoutErro = { ok: false; message: string };

/**
 * Valida a barra de skills escolhida pra quem vai ENTRAR em campo.
 *
 * É a mesma trava que o deck tinha, movida pra cá junto com a escolha: a carta
 * precisa estar DESBLOQUEADA pra aquele pokémon. O POST é público — sem isso um
 * `curl` entraria em campo com hyper-beam num pokémon nv.5.
 *
 * O nível usado é o **congelado no snapshot da partida**, não o atual do
 * UserPokemon: subir de nível no meio da partida (ganhando outra batalha em
 * outra aba) não pode destravar golpe pra partida que já está rolando — o
 * snapshot existe justamente pra isolar isso.
 *
 * Barra ausente é válida e significa "mantém a que ele já tem" — é o que o
 * timeout faz.
 */
async function validarLoadout(
  me: ParticipantWithMons,
  slot: number,
  loadout: string[] | undefined
): Promise<LoadoutOk | LoadoutErro> {
  if (loadout == null) return { ok: true, loadout: undefined };

  const escolhidas = [...new Set(loadout)];
  if (escolhidas.length === 0) return { ok: false, message: "Escolha ao menos uma skill" };
  if (escolhidas.length > CARDS_PER_SLOT) {
    return { ok: false, message: `No máximo ${CARDS_PER_SLOT} skills` };
  }

  const mon = me.pokemons.find((p) => p.slot === slot);
  if (!mon) return { ok: false, message: "Pokémon inválido" };
  if (!mon.userPokemonId) return { ok: true, loadout: undefined }; // snapshot órfão: mantém a barra

  const up = await prisma.userPokemon.findUnique({
    where: { id: mon.userPokemonId },
    select: { pokemonId: true },
  });
  if (!up) return { ok: true, loadout: undefined }; // soltou da coleção no meio da partida

  const unlocked = await getUnlockedMoveIds({
    userPokemonId: mon.userPokemonId,
    pokemonId: up.pokemonId,
    level: mon.level,
  });
  if (!escolhidas.every((id) => unlocked.has(id))) {
    return { ok: false, message: "Skill não liberada para esse pokémon" };
  }

  return { ok: true, loadout: escolhidas };
}

/** Valida o alvo de uma troca: existe, está vivo e não é o próprio ativo. */
function validSwitchTarget(
  me: ParticipantWithMons,
  targetSlot: number | undefined
): { ok: true; slot: number } | { ok: false; message: string } {
  if (targetSlot == null) return { ok: false, message: "Escolha um pokémon" };
  const target = me.pokemons.find((p) => p.slot === targetSlot);
  if (!target) return { ok: false, message: "Pokémon inválido" };
  if (target.fainted) return { ok: false, message: "Esse pokémon está desmaiado" };
  if (target.slot === me.activeSlot) return { ok: false, message: "Esse pokémon já está em campo" };
  return { ok: true, slot: targetSlot };
}

/** Grava a jogada (upsert do segredo) e tenta resolver o turno. */
async function persist(
  battleId: string,
  userId: string,
  round: number,
  type: "MOVE" | "SWITCH" | "LEAD",
  cardSlot: number,
  loadout?: string[]
) {
  // Limpar a barra no update (e não "deixa como estava"): trocar de ideia de
  // SWITCH pra MOVE tem que apagar a barra escolhida junto, senão o motor
  // aplicaria a barra de uma troca que o jogador desistiu de fazer.
  //
  // `Prisma.DbNull` e não `null`: em coluna Json anulável, `null` cru é ambíguo
  // (JSON null vs SQL NULL) e o Prisma recusa em tipo.
  const dados = { type, cardSlot, loadout: loadout ?? Prisma.DbNull };

  await prisma.battleAction.upsert({
    where: { battleId_round_userId: { battleId, round, userId } },
    update: dados,
    create: { battleId, userId, round, ...dados },
  });

  const resolved = await tryResolveTurn(battleId);
  if (!resolved) return { error: "not_found" as const };

  // Mesmo DTO que readBattleState devolve: a resposta do POST não pode vazar a
  // jogada que o oponente já escolheu neste round. Ver toBattleDTO.
  return { battle: toBattleDTO(resolved) };
}
