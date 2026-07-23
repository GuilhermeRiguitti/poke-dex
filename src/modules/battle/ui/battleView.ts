import type { BattleDTO, BattleEventDTO, BattlePokemonDTO, BattleStatusDTO } from "./types";

// Mapear o BattleDTO -> o que a mesa do duelo desenha é função PURA, mora aqui e
// tem teste (CLAUDE.md regra 4). Componente é costura. É 1×1 SIMULTÂNEO: o meu
// pokémon, o do oponente, minha barra de cartas — e o estado da escolha do
// round (ainda escolho / já escolhi e espero / o turno resolveu).

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

export interface DuelLogLine {
  key: string;
  text: string;
}

/**
 * A ÚLTIMA ação do duelo, já traduzida pro ponto de vista de quem olha
 * ("me"/"opp") — é o gatilho puro das animações da mesa. A UI compara o
 * `turnNumber` pra saber quando disparar (e não re-animar o que já viu).
 * Regra 4: a decisão de "quem lunga, quem treme, qual número flutua" é função
 * pura e mora aqui; o componente só costura o efeito.
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
  cards: DuelCardView[];
  /** eu ainda posso escolher a carta deste round? (não escolhi e a partida corre) */
  canPlay: boolean;
  /** já escolhi e o round não resolveu — estou esperando o oponente. */
  waitingOpponent: boolean;
  /** o oponente já escolheu (só QUEM, nunca O QUÊ — ver toBattleDTO). */
  opponentReady: boolean;
  round: number;
  status: BattleStatusDTO;
  isOver: boolean;
  iWon: boolean;
  logLines: DuelLogLine[];
  /** null antes da 1ª ação; a UI ignora se o turnNumber não mudou. */
  fx: DuelTurnFx | null;
}

function activeMon(p: BattleDTO["participants"][number]): BattlePokemonDTO | undefined {
  return p.pokemons.find((m) => m.slot === p.activeSlot) ?? p.pokemons[0];
}

function toMonView(m: BattlePokemonDTO): DuelMonView {
  const hpPct = m.maxHp > 0 ? Math.round((m.currentHp / m.maxHp) * 100) : 0;
  return {
    name: m.name,
    level: m.level,
    spriteUrl: m.spriteUrl,
    types: m.types,
    currentHp: m.currentHp,
    maxHp: m.maxHp,
    hpPct,
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
 * vista de `myUserId`. Um turno pode carregar `roundStart` + a ação; pegamos a
 * ação. Devolve null enquanto nada aconteceu (mesa recém-aberta).
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

  const isOver = battle.status !== "IN_PROGRESS";
  const iSubmitted = battle.submittedUserIds.includes(myUserId);
  const opponentReady = battle.submittedUserIds.some((id) => id !== myUserId);

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
    cards,
    canPlay: !isOver && !iSubmitted,
    waitingOpponent: !isOver && iSubmitted,
    opponentReady: !isOver && opponentReady,
    round: battle.round,
    status: battle.status,
    isOver,
    iWon: battle.winnerId === myUserId,
    logLines,
    fx: selectLatestFx(battle, myUserId),
  };
}
