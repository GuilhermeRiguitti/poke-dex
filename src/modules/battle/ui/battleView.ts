import type { RarityTier } from "@/src/modules/pokemon/domain/rarity";
import type { MoveEffect } from "../domain/moveEffect";
import type { BattleDTO, BattleEventDTO, BattlePokemonDTO, BattleStatusDTO, MonConditionsDTO } from "./types";

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
  /** Quanta energia custa. A barra desenha isso como pips no botão. */
  energyCost: number;
  /**
   * POR QUE está desabilitada. `null` = está jogável.
   *
   * Existe porque os dois motivos exigem reações opostas do jogador: "sem PP" só
   * passa trocando de pokémon, "sem energia" passa sozinho no próximo round.
   * Mostrar as duas como um botão cinza igual faz o jogador achar que travou.
   */
  disabledReason: "pp" | "energy" | null;
  /**
   * O que a carta faz além de bater, em uma linha ("Paralisa · 90% acerto",
   * "Ataque +2"). `null` quando não faz nada — e aí a tela avisa que a carta é
   * inerte, em vez de deixar o jogador gastar o turno pra descobrir.
   */
  effectLabel: string | null;
}

// ── nomes em português das coisas de status ──────────────────────────────────
// Ficam aqui (e não no componente) porque batizar o que a tela mostra é regra de
// apresentação — a mesma razão de o resto deste arquivo existir.

const AILMENT_LABEL: Record<string, string> = {
  burn: "Queimado",
  poison: "Envenenado",
  paralysis: "Paralisado",
  sleep: "Dormindo",
  freeze: "Congelado",
  confusion: "Confuso",
  "leech-seed": "Semeado",
};

/** O verbo, pra descrever o que a CARTA faz (o rótulo acima é o estado). */
const AILMENT_VERB: Record<string, string> = {
  burn: "Queima",
  poison: "Envenena",
  paralysis: "Paralisa",
  sleep: "Faz dormir",
  freeze: "Congela",
  confusion: "Confunde",
  "leech-seed": "Planta semente",
};

const STAT_LABEL: Record<string, string> = {
  attack: "Ataque",
  defense: "Defesa",
  specialAttack: "Atq. Esp.",
  specialDefense: "Def. Esp.",
  speed: "Velocidade",
  accuracy: "Precisão",
  evasion: "Evasão",
};

/** Por que o combatente perdeu o turno — o texto do relatório. */
const BLOCK_LABEL: Record<string, string> = {
  sleep: "está dormindo",
  freeze: "está congelado",
  paralysis: "travou de paralisia",
  flinch: "recuou e perdeu o turno",
  confusion: "se acertou de confuso",
};

/** De onde veio o HP que entrou/saiu fora de um golpe. */
const TICK_LABEL: Record<string, string> = {
  burn: "sofreu com a queimadura",
  poison: "sofreu com o veneno",
  "leech-seed": "foi drenado pela semente",
  "leech-gain": "recuperou pela semente",
  drain: "drenou HP",
  recoil: "sofreu o recuo",
  heal: "se curou",
  status: "sofreu com o status",
};

export function ailmentLabel(ailment: string): string {
  return AILMENT_LABEL[ailment] ?? ailment;
}

export function statLabel(stat: string): string {
  return STAT_LABEL[stat] ?? stat;
}

/** "+2" / "−1" — o menos é o sinal tipográfico, não o hífen do teclado. */
function signed(value: number): string {
  return value > 0 ? `+${value}` : `−${Math.abs(value)}`;
}

/**
 * A carta em UMA linha: "Paralisa", "Ataque +2", "30% de queimar · Cura 50%".
 *
 * Existe porque sem ela o golpe de status é ilegível — a barra de comando
 * mostrava "STA / sem dano" e pronto, o que fazia toda carta de status parecer
 * lixo. Descrever o efeito É o que transforma essas cartas em jogada.
 */
export function moveEffectLabel(effect: MoveEffect | null): string | null {
  if (!effect) return null;
  const partes: string[] = [];

  // A proteção vem PRIMEIRO: é o que a carta faz, não um efeito secundário. E
  // avisa da chance decrescente, senão o jogador acha que o escudo falhou por
  // azar quando na verdade ele já tinha usado no turno anterior.
  if (effect.protects) partes.push("Bloqueia o golpe deste turno (cai pela metade se repetir)");

  if (effect.ailment) {
    const verbo = AILMENT_VERB[effect.ailment] ?? effect.ailment;
    partes.push(effect.ailmentChance >= 100 ? verbo : `${effect.ailmentChance}% de ${verbo.toLowerCase()}`);
  }

  for (const { stat, change } of effect.stageChanges) {
    const alvo = effect.stageTarget === "self" ? "" : " do alvo";
    const chance = effect.stageChance >= 100 ? "" : `${effect.stageChance}% · `;
    partes.push(`${chance}${statLabel(stat)} ${signed(change)}${alvo}`);
  }

  if (effect.healPct > 0) partes.push(`Cura ${effect.healPct}% do HP`);
  if (effect.drainPct > 0) partes.push(`Drena ${effect.drainPct}% do dano`);
  if (effect.drainPct < 0) partes.push(`Recuo de ${Math.abs(effect.drainPct)}% do dano`);
  if (effect.maxHits > 1) {
    partes.push(
      effect.minHits === effect.maxHits ? `${effect.maxHits} acertos` : `${effect.minHits} a ${effect.maxHits} acertos`
    );
  }
  if (effect.critStage > 0) partes.push("Crítico fácil");

  return partes.length > 0 ? partes.join(" · ") : null;
}

/** Uma etiqueta de estado alterado, como a placa de HP desenha. */
export interface ConditionBadgeView {
  key: string;
  label: string;
  tone: "bad" | "warn" | "energy";
  /** o tooltip que explica a mecânica pra quem nunca jogou */
  title: string;
}

const CONDITION_HINT: Record<string, string> = {
  burn: "Queimadura: perde HP todo turno e bate metade com golpes físicos",
  poison: "Veneno: perde HP todo turno",
  paralysis: "Paralisia: metade da Velocidade e 25% de chance de travar",
  sleep: "Sono: não age até acordar",
  freeze: "Congelado: não age até descongelar (golpe de fogo derrete)",
  confusion: "Confusão: 1 em 3 de se acertar em vez de golpear",
  "leech-seed": "Semente: perde HP todo turno e o oponente recupera",
};

/**
 * As etiquetas de estado de um combatente. Pura e testada: decidir o que a
 * placa mostra é apresentação, e é ela que faz o jogador ENTENDER por que
 * tomou 8 de dano sem ninguém atacar.
 */
export function conditionBadges(conditions: MonConditionsDTO): ConditionBadgeView[] {
  const badges: ConditionBadgeView[] = [];

  if (conditions.status) {
    badges.push({
      key: conditions.status,
      label: ailmentLabel(conditions.status),
      tone: conditions.status === "sleep" || conditions.status === "freeze" ? "warn" : "bad",
      title: CONDITION_HINT[conditions.status] ?? "",
    });
  }
  if (conditions.confused) {
    badges.push({ key: "confusion", label: "Confuso", tone: "warn", title: CONDITION_HINT.confusion });
  }
  if (conditions.seeded) {
    badges.push({ key: "leech-seed", label: "Semeado", tone: "bad", title: CONDITION_HINT["leech-seed"] });
  }
  for (const { stat, stage } of conditions.stages) {
    badges.push({
      key: `stage-${stat}`,
      label: `${statLabel(stat)} ${signed(stage)}`,
      tone: stage > 0 ? "energy" : "bad",
      title: stage > 0 ? `${statLabel(stat)} aumentado em ${stage} estágio(s)` : `${statLabel(stat)} reduzido em ${Math.abs(stage)} estágio(s)`,
    });
  }

  return badges;
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
  /** status, confusão, semente e estágios — as etiquetas da placa de HP. */
  badges: ConditionBadgeView[];
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

export type DuelLogKind =
  | "round"
  | "switch"
  | "attack"
  | "hesitate"
  /** sumiu e não voltou — encerra a partida (≠ hesitar, que perde um turno) */
  | "abandoned"
  /** levantou o escudo (protect) */
  | "protect"
  /** pegou um status (ou ele não pegou) */
  | "ailment"
  /** estágio de atributo mudou */
  | "stage"
  /** perdeu o turno por causa de uma condição */
  | "blocked"
  /** o status passou: acordou, descongelou */
  | "recovered"
  /** HP que entrou ou saiu fora de um golpe (queimadura, semente, cura, dreno) */
  | "tick";

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
  /**
   * Se a linha é boa ou ruim PRA QUEM ELA FALA. As linhas de efeito não têm
   * dano nem efetividade pra deduzir cor (um "Ataque +2" e um "Ataque −2" são o
   * mesmo evento com sinais opostos), então quem monta a linha já diz o humor —
   * e o marcador só lê. Ausente nas linhas antigas, que decidem pelo dano.
   */
  mood?: "good" | "bad" | "neutral";
}

/** O marcador (glifo + cor) que abre a linha do relatório. Puro, tem teste. */
export interface DuelLogMark {
  glyph: string;
  tone: "flare" | "bad" | "dim" | "energy" | "gold";
}

/** O glifo de cada tipo de linha de efeito; o tom vem do `mood`. */
const EFFECT_GLYPH: Partial<Record<DuelLogKind, string>> = {
  ailment: "☣",
  stage: "⇅",
  blocked: "✋",
  recovered: "✚",
  tick: "•",
};

export function duelLogMark(line: DuelLogLine): DuelLogMark {
  if (line.kind === "round") return { glyph: "◆", tone: "dim" };
  if (line.kind === "switch") return { glyph: "⇄", tone: "energy" };
  if (line.kind === "hesitate") return { glyph: "…", tone: "dim" };
  if (line.kind === "abandoned") return { glyph: "⏻", tone: "bad" };
  if (line.kind === "protect") return { glyph: "⛊", tone: "energy" };

  const glyph = EFFECT_GLYPH[line.kind];
  if (glyph) {
    const tone = line.mood === "good" ? "energy" : line.mood === "bad" ? "bad" : "dim";
    return { glyph: line.kind === "stage" && line.mood === "good" ? "▲" : line.kind === "stage" ? "▽" : glyph, tone };
  }

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
  /**
   * Quanto falta pro oponente perder por sumiço, em ms. `null` = ele está aí.
   * Existe pra tela poder dizer "oponente desconectado — vitória em Xs" em vez
   * de a partida simplesmente acabar sozinha do nada.
   */
  oppAbsentMs: number | null;
  /** minha energia agora — a barra de recurso da rodada. */
  myEnergy: number;
  /** a do oponente (pública, como o HP e o status). */
  oppEnergy: number;
  /** teto do acúmulo, pra a barra saber quantos pips desenhar. */
  energyMax: number;
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
    badges: conditionBadges(m.conditions),
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

  // ── as linhas de EFEITO são chaveadas por quem SOFREU, não por quem agiu ──
  if (ev.type === "ailment") {
    const alvo = sideOf(ev.targetUserId, myUserId);
    if (ev.blocked) {
      const porque = ev.blocked === "immune" ? "não foi afetado" : "já está com um status";
      return { ...base, kind: "ailment", actor: alvo, text: porque, mood: "neutral" };
    }
    return { ...base, kind: "ailment", actor: alvo, text: "ficou", subject: ailmentLabel(ev.ailment), mood: "bad" };
  }
  if (ev.type === "stage") {
    const alvo = sideOf(ev.targetUserId, myUserId);
    if (ev.delta === 0) {
      return { ...base, kind: "stage", actor: alvo, text: `não muda mais o ${statLabel(ev.stat)}`, mood: "neutral" };
    }
    return {
      ...base,
      kind: "stage",
      actor: alvo,
      text: ev.delta > 0 ? "aumentou" : "reduziu",
      subject: `${statLabel(ev.stat)} ${signed(ev.stage)}`,
      mood: ev.delta > 0 ? "good" : "bad",
    };
  }
  if (ev.type === "blocked") {
    return {
      ...base,
      kind: "blocked",
      actor: sideOf(ev.targetUserId, myUserId),
      text: BLOCK_LABEL[ev.reason] ?? "perdeu o turno",
      damage: ev.selfDamage && ev.selfDamage > 0 ? ev.selfDamage : null,
      mood: "bad",
    };
  }
  if (ev.type === "recovered") {
    const verbo = ev.ailment === "sleep" ? "acordou" : ev.ailment === "freeze" ? "descongelou" : "se recuperou";
    return { ...base, kind: "recovered", actor: sideOf(ev.targetUserId, myUserId), text: verbo, mood: "good" };
  }
  if (ev.type === "tick") {
    const ganhou = ev.hp > 0;
    return {
      ...base,
      kind: "tick",
      actor: sideOf(ev.targetUserId, myUserId),
      text: TICK_LABEL[ev.source] ?? (ganhou ? "recuperou HP" : "perdeu HP"),
      subject: ganhou ? `+${ev.hp} HP` : null,
      damage: ganhou ? null : Math.abs(ev.hp),
      mood: ganhou ? "good" : "bad",
    };
  }

  const actor = sideOf(ev.userId, myUserId);
  if (ev.type === "switch") {
    return { ...base, kind: "switch", actor, text: "enviou", subject: prettyName(ev.toName) };
  }
  if (ev.type === "hesitate") {
    return { ...base, kind: "hesitate", actor, text: "hesitou — turno perdido" };
  }
  if (ev.type === "abandoned") {
    return { ...base, kind: "abandoned", actor, text: "saiu da partida" };
  }
  if (ev.type === "protect") {
    return {
      ...base,
      kind: "protect",
      actor,
      text: ev.held ? "levantou o escudo" : "tentou o escudo — falhou",
    };
  }
  return {
    key,
    kind: "attack",
    actor,
    text: ev.missed ? "errou" : "usou",
    subject: prettyName(ev.cardName) + (ev.hits && ev.hits > 1 ? ` (${ev.hits}×)` : ""),
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

  const myEnergy = me.energy;
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
  // "Dá pra pagar alguma?" tem que considerar PP JUNTO: uma carta barata mas
  // sem PP não é alternativa. Sem isso, ficar sem energia com só uma carta
  // zerada na mão desabilitaria a barra inteira em vez de cair no struggle.
  const someAffordable = myMon.moves.some((mv) => mv.currentPp > 0 && mv.energyCost <= myEnergy);
  const cards: DuelCardView[] = myMon.moves.map((mv, i) => {
    const semPp = mv.currentPp <= 0 && someUsable;
    const semEnergia = mv.energyCost > myEnergy && someAffordable;
    return {
      slot: i,
      name: mv.name,
      type: mv.type,
      power: mv.power,
      damageClass: mv.damageClass,
      accuracy: mv.accuracy,
      currentPp: mv.currentPp,
      maxPp: mv.maxPp,
      energyCost: mv.energyCost,
      disabled: semPp || semEnergia,
      // Os dois motivos são DIFERENTES na tela de propósito: sem isso, o jogador
      // vê a carta apagada, não entende por quê, e conclui que o jogo travou.
      // "Sem PP" some ao trocar de pokémon; "sem energia" passa sozinho no
      // próximo round.
      disabledReason: semPp ? ("pp" as const) : semEnergia ? ("energy" as const) : null,
      effectLabel: moveEffectLabel(mv.effect),
    };
  });

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
    // Aviso de desconexão do OPONENTE. O meu não interessa: se eu sumi, não há
    // ninguém pra ler a tela.
    oppAbsentMs: opp.present ? null : opp.absentForMs,
    myEnergy,
    // A do oponente é pública, como o HP e o status: sem ver o recurso dele não
    // dá pra ler a ameaça, e "ele tem 3, o golpe grande vem agora" é justamente
    // a leitura que a mecânica cria.
    oppEnergy: opp.energy,
    energyMax: me.energyMax,
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
