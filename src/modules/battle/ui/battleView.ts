import type { RarityTier } from "@/src/modules/pokemon/domain/rarity";
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
  /** físico / especial / status — o ícone que explica o golpe sem texto */
  damageClass: "physical" | "special" | "status";
  /** precisão; null = nunca erra. A barra só mostra quando < 100. */
  accuracy: number | null;
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
  // ── o que a CARTA de reserva desenha ───────────────────────────────────
  /** "#0025" */
  dexNumber: string;
  level: number;
  types: string[];
  /** metal da moldura; vem calculada do servidor (ver toBattleDTO) */
  rarity: RarityTier;
  /** HP em número, pra carta dizer "42/110" — o hpPct é só a barra */
  currentHp: number;
  maxHp: number;
}

export type DuelLogKind = "round" | "switch" | "attack" | "hesitate";

/**
 * Uma linha do relatório de combate, já ESTRUTURADA — o componente não lê texto
 * pra decidir cor nem ícone (antes havia regex em cima da frase pronta, o que
 * quebrava sozinho ao mexer numa palavra).
 */
export interface DuelLogLine {
  key: string;
  kind: DuelLogKind;
  /** quem agiu — a etiqueta VOCÊ/OPONENTE. null na linha de rodada. */
  actor: "me" | "opp" | null;
  /** a ação SEM a etiqueta e SEM o nome próprio: "usou", "hesitou — turno perdido". */
  text: string;
  /** o golpe/pokémon que o verbo aponta — a tela desenha em destaque. */
  subject: string | null;
  /** dano do golpe, pra coluna da direita. null quando não houve dano. */
  damage: number | null;
  /** >1 super eficaz, <1 pouco eficaz, 0 imune. null fora de ataque. */
  effectiveness: number | null;
  isCrit: boolean;
  missed: boolean;
  /** o alvo caiu NESTE golpe */
  fainted: boolean;
}

/** O marcador (glifo + cor) que abre a linha do relatório. Puro, tem teste. */
export interface DuelLogMark {
  glyph: string;
  tone: "flare" | "bad" | "dim" | "energy" | "gold";
}

export function duelLogMark(line: DuelLogLine): DuelLogMark {
  if (line.kind === "round") return { glyph: "◆", tone: "dim" };
  if (line.kind === "switch") return { glyph: "⇄", tone: "energy" };
  if (line.kind === "hesitate") return { glyph: "…", tone: "dim" };
  if (line.missed) return { glyph: "✕", tone: "dim" };
  if (line.fainted) return { glyph: "☠", tone: "bad" };
  if (line.isCrit) return { glyph: "✦", tone: "gold" };
  const eff = line.effectiveness ?? 1;
  if (eff === 0) return { glyph: "○", tone: "dim" };
  if (eff > 1) return { glyph: "▲", tone: "bad" };
  if (eff < 1) return { glyph: "▼", tone: "dim" };
  return { glyph: "✦", tone: "flare" };
}

/**
 * O countdown do round como a tela desenha. Puro e testado: decidir quando o
 * tempo vira urgência é regra de apresentação, e o componente só costura.
 */
export interface TurnClockView {
  /** "1:12" — minutos:segundos, arredondando pra CIMA (ver turnClockView). */
  text: string;
  /** 0..100 — quanto da janela ainda resta; é a barra. */
  pct: number;
  urgency: "calm" | "warn" | "critical";
  /** o tempo acabou; o round resolve no próximo request */
  expired: boolean;
}

/** Abaixo disto o relógio muda de cor: 30s avisa, 10s aperta. */
const WARN_MS = 30_000;
const CRITICAL_MS = 10_000;

export function turnClockView(remainingMs: number, timeoutMs: number): TurnClockView {
  const left = Math.max(0, Math.min(remainingMs, timeoutMs));
  // Arredonda pra CIMA: com floor o relógio marcaria "0:00" durante o último
  // segundo inteiro, e "acabou" é exatamente o que ele ainda NÃO pode dizer —
  // quem largar a carta nesse segundo ainda joga.
  const totalSeconds = Math.ceil(left / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return {
    text: `${minutes}:${String(seconds).padStart(2, "0")}`,
    pct: timeoutMs > 0 ? Math.round((left / timeoutMs) * 100) : 0,
    urgency: left <= CRITICAL_MS ? "critical" : left <= WARN_MS ? "warn" : "calm",
    expired: left <= 0,
  };
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

/**
 * O balão que aparece EM CIMA de quem sofreu a última ação ("EKANS −18 / SUPER
 * EFICAZ"). É a mesma DuelTurnFx traduzida em texto — pura e testada aqui,
 * porque decidir o que o balão diz é regra de apresentação, não costura.
 * Devolve null pro lado que não foi tocado no turno.
 */
export interface DuelCalloutView {
  /** de quem é a cabeça em que o balão está — a etiqueta pequena */
  name: string;
  /** "-18", "Errou", "Imune", "Hesitou" */
  value: string;
  /** "Crítico! · Super eficaz" — null quando não há nada a dizer */
  note: string | null;
  tone: "damage" | "crit" | "super" | "weak" | "none";
}

export function duelCalloutFor(
  fx: DuelTurnFx | null,
  side: "me" | "opp",
  name: string,
): DuelCalloutView | null {
  if (!fx) return null;
  const label = prettyName(name);

  // hesitar é do ATOR (ele perdeu o turno); o resto é de quem levou.
  if (fx.kind === "hesitate") {
    return fx.actor === side ? { name: label, value: "Hesitou", note: null, tone: "none" } : null;
  }
  if (fx.target !== side) return null;
  if (fx.missed) return { name: label, value: "Errou", note: null, tone: "none" };
  if (fx.effectiveness === 0) return { name: label, value: "Imune", note: null, tone: "none" };

  const notes: string[] = [];
  if (fx.isCrit) notes.push("Crítico!");
  if (fx.effectiveness > 1) notes.push("Super eficaz");
  else if (fx.effectiveness < 1) notes.push("Pouco eficaz");
  if (fx.fainted) notes.push("Nocaute!");

  return {
    name: label,
    value: `-${fx.damage}`,
    note: notes.length > 0 ? notes.join(" · ") : null,
    tone: fx.isCrit ? "crit" : fx.effectiveness > 1 ? "super" : fx.effectiveness < 1 ? "weak" : "damage",
  };
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
  /**
   * Quanto restava do round quando este DTO chegou, e a janela cheia. Quem faz
   * o número ANDAR é o useTurnClock (o tique é do cliente); daqui sai só o ponto
   * de partida, que é o do servidor.
   */
  turnEndsInMs: number;
  turnTimeoutMs: number;
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

function sideOf(userId: string, myUserId: string): "me" | "opp" {
  return userId === myUserId ? "me" : "opp";
}

function prettyName(name: string): string {
  return name.replace(/-/g, " ");
}

function eventLine(ev: BattleEventDTO, myUserId: string, key: string): DuelLogLine {
  const base = { key, subject: null, damage: null, effectiveness: null, isCrit: false, missed: false, fainted: false };
  if (ev.type === "roundStart") {
    return { ...base, kind: "round", actor: null, text: `Rodada ${ev.round}` };
  }
  const actor = sideOf(ev.userId, myUserId);
  if (ev.type === "switch") {
    return { ...base, kind: "switch", actor, text: "enviou", subject: prettyName(ev.toName) };
  }
  if (ev.type === "hesitate") {
    return { ...base, kind: "hesitate", actor, text: "hesitou — turno perdido" };
  }
  return {
    key,
    kind: "attack",
    actor,
    text: ev.missed ? "errou" : "usou",
    subject: prettyName(ev.cardName),
    damage: ev.missed || ev.damage <= 0 ? null : ev.damage,
    effectiveness: ev.effectiveness,
    isCrit: ev.isCrit,
    missed: ev.missed,
    fainted: ev.targetFainted,
  };
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
        dexNumber: `#${String(m.pokemonId).padStart(4, "0")}`,
        level: m.level,
        types: m.types,
        rarity: m.rarity,
        currentHp: m.currentHp,
        maxHp: m.maxHp,
      }));

  const someUsable = myMon.moves.some((mv) => mv.currentPp > 0);
  const cards: DuelCardView[] = myMon.moves.map((mv, i) => ({
    slot: i,
    name: mv.name,
    type: mv.type,
    power: mv.power,
    damageClass: mv.damageClass,
    accuracy: mv.accuracy,
    currentPp: mv.currentPp,
    maxPp: mv.maxPp,
    disabled: mv.currentPp <= 0 && someUsable,
  }));

  // turnLogs vêm desc por turnNumber; achata em ordem cronológica pro log.
  const logLines: DuelLogLine[] = [];
  for (const log of [...battle.turnLogs].sort((a, b) => a.turnNumber - b.turnNumber)) {
    log.events.forEach((ev, i) => {
      logLines.push(eventLine(ev, myUserId, `${log.turnNumber}-${i}`));
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
    turnEndsInMs: battle.turnEndsInMs,
    turnTimeoutMs: battle.turnTimeoutMs,
    status: battle.status,
    isOver,
    iWon: battle.winnerId === myUserId,
    isDraw: isOver && battle.winnerId === null,
    logLines,
    fx: selectLatestFx(battle, myUserId),
  };
}
