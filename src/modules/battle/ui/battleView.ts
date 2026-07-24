import type { BattleDTO, BattleEventDTO, BattlePokemonDTO, BattleStatusDTO } from "./types";

// Mapear o BattleDTO -> o que a mesa do duelo desenha é função PURA, mora aqui e
// tem teste (CLAUDE.md regra 4). Componente é costura. É duelo SIMULTÂNEO em
// TIME de 6: o meu ativo, o do oponente, minha barra de cartas, os dois times, e
// o estado da minha escolha do round (escolho carta / troco / troca forçada /
// aguardo / acabou).

export interface DuelCardView {
  slot: number; // cardSlot 0..5
  name: string;
  type: string;
  power: number | null;
  currentPp: number;
  maxPp: number;
  /** sem PP enquanto ainda há outra carta com PP → não jogável */
  disabled: boolean;
}

export interface DuelMonView {
  name: string;
  level: number;
  spriteUrl: string | null;
  types: string[];
  currentHp: number;
  maxHp: number;
  hpPct: number; // 0..100
  fainted: boolean;
}

/** Um pokémon do time, como a barra de party desenha. */
export interface PartyMemberView {
  slot: number;
  name: string;
  spriteUrl: string | null;
  hpPct: number;
  fainted: boolean;
  isActive: boolean;
  /** posso trocar pra ele agora? (vivo, não é o ativo, e o round permite trocar) */
  canSwitchTo: boolean;
}

export interface DuelLogLine {
  key: string;
  text: string;
}

// O modo da MINHA vez no round:
//  - choose:       round normal, escolho carta ou troca voluntária.
//  - forcedSwitch: meu ativo desmaiou (com reserva viva) — só escolho substituto.
//  - waiting:      já joguei, espero o turno resolver / o oponente.
//  - over:         a partida acabou.
export type DuelMode = "choose" | "forcedSwitch" | "waiting" | "over";

/**
 * A ÚLTIMA ação do duelo, já traduzida pro ponto de vista de quem olha
 * ("me"/"opp") — gatilho puro das animações da mesa. A UI compara o `turnNumber`
 * pra saber quando disparar (e não re-animar o que já viu).
 */
export interface DuelTurnFx {
  turnNumber: number;
  actor: "me" | "opp";
  kind: "attack" | "hesitate";
  cardName: string | null;
  /** quem toma o dano (oposto do actor). null em hesitate. */
  target: "me" | "opp" | null;
  damage: number;
  effectiveness: number;
  isCrit: boolean;
  missed: boolean;
  fainted: boolean;
}

export interface DuelView {
  me: DuelMonView;
  opp: DuelMonView;
  /** meu time inteiro (até 6), pra barra de party + troca. */
  myParty: PartyMemberView[];
  /** o time do oponente, só como marcadores (vivo/desmaiado) — sem revelar cartas. */
  oppParty: PartyMemberView[];
  cards: DuelCardView[];
  /** slots do MEU time pros quais posso trocar agora (vivos, não o ativo). */
  switchTargets: number[];
  mode: DuelMode;
  /** eu ainda posso escolher a carta deste round? (round normal, não escolhi) */
  canPlay: boolean;
  /** posso trocar de pokémon agora? (round normal com reserva viva, ou troca forçada) */
  canSwitch: boolean;
  /** já escolhi e o round não resolveu — estou esperando. */
  waitingOpponent: boolean;
  /** o oponente já escolheu (só QUEM, nunca O QUÊ — ver toBattleDTO). */
  opponentReady: boolean;
  round: number;
  status: BattleStatusDTO;
  isOver: boolean;
  iWon: boolean;
  /** partida encerrada sem vencedor (duplo nocaute do último / abandono mútuo). */
  isDraw: boolean;
  logLines: DuelLogLine[];
  /** null antes da 1ª ação; a UI ignora se o turnNumber não mudou. */
  fx: DuelTurnFx | null;
}

function activeMon(p: BattleDTO["participants"][number]): BattlePokemonDTO | undefined {
  return p.pokemons.find((m) => m.slot === p.activeSlot) ?? p.pokemons[0];
}

function hpPctOf(m: BattlePokemonDTO): number {
  return m.maxHp > 0 ? Math.round((m.currentHp / m.maxHp) * 100) : 0;
}

function toMonView(m: BattlePokemonDTO): DuelMonView {
  return {
    name: m.name,
    level: m.level,
    spriteUrl: m.spriteUrl,
    types: m.types,
    currentHp: m.currentHp,
    maxHp: m.maxHp,
    hpPct: hpPctOf(m),
    fainted: m.fainted,
  };
}

function effLabel(eff: number): string {
  if (eff === 0) return ", sem efeito";
  if (eff > 1) return ", super eficaz";
  if (eff > 0 && eff < 1) return ", pouco eficaz";
  return "";
}

function eventText(ev: BattleEventDTO, myUserId: string): string | null {
  if (ev.type === "roundStart") return `— Rodada ${ev.round} —`;
  const who = ev.userId === myUserId ? "Você" : "Oponente";
  if (ev.type === "switch") return `${who} enviou ${ev.toName}!`;
  if (ev.type === "hesitate") return `${who} hesitou (turno perdido).`;
  // attack
  if (ev.missed) return `${who} usou ${ev.cardName} — errou!`;
  const crit = ev.isCrit ? ", crítico" : "";
  const ko = ev.targetFainted ? " Nocaute!" : "";
  return `${who} usou ${ev.cardName} (${ev.damage} de dano${effLabel(ev.effectiveness)}${crit}).${ko}`;
}

function sideOf(userId: string, myUserId: string): "me" | "opp" {
  return userId === myUserId ? "me" : "opp";
}

/**
 * A última ação jogável (attack/hesitate) entre todos os turnos, do ponto de
 * vista de `myUserId`. Turnos de só-troca não têm attack/hesitate — pulamos pro
 * anterior; o guard por turnNumber na mesa evita re-animar o que já foi visto.
 */
function selectLatestFx(battle: BattleDTO, myUserId: string): DuelTurnFx | null {
  const logsDesc = [...battle.turnLogs].sort((a, b) => b.turnNumber - a.turnNumber);
  for (const log of logsDesc) {
    const ev = [...log.events].reverse().find((e) => e.type === "attack" || e.type === "hesitate");
    if (!ev) continue;

    if (ev.type === "hesitate") {
      return {
        turnNumber: log.turnNumber,
        actor: sideOf(ev.userId, myUserId),
        kind: "hesitate",
        cardName: null,
        target: null,
        damage: 0,
        effectiveness: 1,
        isCrit: false,
        missed: false,
        fainted: false,
      };
    }

    const actor = sideOf(ev.userId, myUserId);
    return {
      turnNumber: log.turnNumber,
      actor,
      kind: "attack",
      cardName: ev.cardName,
      target: actor === "me" ? "opp" : "me",
      damage: ev.damage,
      effectiveness: ev.effectiveness,
      isCrit: ev.isCrit,
      missed: ev.missed,
      fainted: ev.targetFainted,
    };
  }
  return null;
}

/** BattleDTO -> DuelView, do ponto de vista de `myUserId`. null se eu não estou nela. */
export function selectDuelView(battle: BattleDTO, myUserId: string): DuelView | null {
  const me = battle.participants.find((p) => p.userId === myUserId);
  const opp = battle.participants.find((p) => p.userId !== myUserId);
  if (!me || !opp) return null;

  const myMon = activeMon(me);
  const oppMon = activeMon(opp);
  if (!myMon || !oppMon) return null;

  const isOver = battle.status !== "IN_PROGRESS";
  const iSubmitted = battle.submittedUserIds.includes(myUserId);
  const opponentReady = battle.submittedUserIds.some((id) => id !== myUserId);

  const myLiving = me.pokemons.filter((m) => !m.fainted);
  const iMustSwitch = myMon.fainted && myLiving.length > 0;
  // O oponente está escolhendo um substituto (ativo dele desmaiou, com reserva)?
  // Nesse caso EU não jogo — o round pausa pra ele, e a mesa mostra "aguardando".
  const oppMustSwitch = oppMon.fainted && opp.pokemons.some((m) => !m.fainted);

  const mode: DuelMode = isOver
    ? "over"
    : iSubmitted
      ? "waiting"
      : iMustSwitch
        ? "forcedSwitch"
        : oppMustSwitch
          ? "waiting"
          : "choose";

  // Posso trocar num round normal (ativo vivo) ou na troca forçada; nunca depois
  // de já ter jogado. Alvos: os vivos que não são o ativo.
  const canSwitch = (mode === "choose" || mode === "forcedSwitch");
  const switchTargets = me.pokemons
    .filter((m) => !m.fainted && m.slot !== me.activeSlot)
    .map((m) => m.slot);

  const toParty = (p: typeof me, reveal: boolean): PartyMemberView[] =>
    [...p.pokemons]
      .sort((a, b) => a.slot - b.slot)
      .map((m) => ({
        slot: m.slot,
        name: m.name,
        spriteUrl: m.spriteUrl,
        hpPct: hpPctOf(m),
        fainted: m.fainted,
        isActive: m.slot === p.activeSlot,
        canSwitchTo: reveal && canSwitch && !m.fainted && m.slot !== p.activeSlot,
      }));

  const someUsable = myMon.moves.some((mv) => mv.currentPp > 0);
  const cards: DuelCardView[] = myMon.moves.map((mv, i) => ({
    slot: i,
    name: mv.name,
    type: mv.type,
    power: mv.power,
    currentPp: mv.currentPp,
    maxPp: mv.maxPp,
    disabled: mv.currentPp <= 0 && someUsable,
  }));

  // turnLogs vêm desc por turnNumber; achata em ordem cronológica pro log.
  const logLines: DuelLogLine[] = [];
  for (const log of [...battle.turnLogs].sort((a, b) => a.turnNumber - b.turnNumber)) {
    log.events.forEach((ev, i) => {
      const text = eventText(ev, myUserId);
      if (text) logLines.push({ key: `${log.turnNumber}-${i}`, text });
    });
  }

  return {
    me: toMonView(myMon),
    opp: toMonView(oppMon),
    myParty: toParty(me, true),
    oppParty: toParty(opp, false),
    cards,
    switchTargets,
    mode,
    canPlay: mode === "choose",
    canSwitch: canSwitch && switchTargets.length > 0,
    waitingOpponent: !isOver && iSubmitted,
    opponentReady: !isOver && opponentReady,
    round: battle.round,
    status: battle.status,
    isOver,
    iWon: battle.winnerId === myUserId,
    isDraw: isOver && battle.winnerId === null,
    logLines,
    fx: selectLatestFx(battle, myUserId),
  };
}
