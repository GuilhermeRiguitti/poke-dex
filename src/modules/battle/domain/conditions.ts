// O ESTADO ALTERADO de um combatente: status (queimado, envenenado, dormindo…),
// os stat stages (-6..+6) e as condições voláteis (confusão, semente, flinch).
//
// É o que tira a batalha do "um bate, o outro bate": antes disto, a única coisa
// que mudava entre um turno e o próximo era o HP, e por isso a partida inteira
// era decidida no primeiro round (quem tem o número maior ganha). Com status e
// estágio, **o mesmo par de pokémon dá partidas diferentes** — e a jogada de
// hoje passa a valer por rodadas seguintes, que é o que faz existir uma aposta.
//
// Tudo aqui é PURO (sem Prisma, sem fetch, sem React) e recebe o `rng` de fora:
// o mesmo estado com a mesma sequência de rng dá sempre o mesmo resultado.
//
// AS DUAS FAMÍLIAS, e a diferença que decide o jogo:
//  - NÃO-VOLÁTIL (burn/poison/paralysis/sleep/freeze): **um por vez** e
//    **sobrevive à troca**. É dano de longo prazo — quem toma, carrega.
//  - VOLÁTIL (confusão, semente, flinch) + os STAGES: **a troca limpa**. É o que
//    dá resposta pra quem foi debuffado, ao preço de um turno e de um golpe na
//    cara de quem entra. Sem essa assimetria, trocar seria só fuga; com ela, é
//    escolha.

import type { Ailment, StageChange, StageStat } from "./moveEffect";
import type { BattlePokemonState } from "./types";

/** Os que ocupam o "slot único" de status e atravessam a troca. */
export type NonVolatileAilment = "burn" | "poison" | "paralysis" | "sleep" | "freeze";

const NON_VOLATILE = new Set<string>(["burn", "poison", "paralysis", "sleep", "freeze"]);

export function isNonVolatile(ailment: Ailment): ailment is NonVolatileAilment {
  return NON_VOLATILE.has(ailment);
}

export type StatStages = Record<StageStat, number>;

export interface MonConditions {
  /** o status não-volátil, ou null. Só UM por vez. */
  status: NonVolatileAilment | null;
  /**
   * turnos que ainda faltam pro sono passar. Só o sono usa contador: o
   * congelamento sorteia degelo a cada turno e os outros três não passam sozinhos.
   */
  sleepTurns: number;
  stages: StatStages;
  /** turnos restantes de confusão (0 = lúcido). */
  confusionTurns: number;
  /** semente drenadora plantada: perde HP todo fim de turno pro oponente. */
  seeded: boolean;
  /**
   * levou um golpe de recuo ANTES de agir neste turno → perde o turno. Dura só
   * o turno (o motor limpa no fim), mas mora aqui porque quem escreve é o golpe
   * do oponente, não a ação de quem hesita.
   */
  flinched: boolean;
  /**
   * Está protegido NESTE turno (protect e família). Volátil: nasce e morre
   * dentro do turno, e a troca limpa.
   */
  protected: boolean;
  /**
   * Quantas vezes seguidas protegeu. Não é estatística — é o que faz a proteção
   * ter custo: a chance cai pela metade a cada uso consecutivo, senão o jogador
   * com energia sobrando protegeria todo turno e o duelo empataria por
   * esgotamento de PP. Zera quando ele faz outra coisa.
   */
  protectStreak: number;
}

export const STAGE_STATS: StageStat[] = [
  "attack",
  "defense",
  "specialAttack",
  "specialDefense",
  "speed",
  "accuracy",
  "evasion",
];

export const MAX_STAGE = 6;

export function emptyStages(): StatStages {
  return { attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0, accuracy: 0, evasion: 0 };
}

export function emptyConditions(): MonConditions {
  return {
    status: null,
    sleepTurns: 0,
    stages: emptyStages(),
    confusionTurns: 0,
    seeded: false,
    flinched: false,
    protected: false,
    protectStreak: 0,
  };
}

/**
 * Lê a coluna Json `BattlePokemon.conditions` com desconfiança. `null` (partida
 * que começou antes desta fatia) e lixo viram estado LIMPO — é o que permite a
 * migration ser aditiva e anulável, sem backfill e sem trava no deploy.
 */
export function normalizeConditions(raw: unknown): MonConditions {
  const base = emptyConditions();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return base;
  const r = raw as Partial<MonConditions> & { stages?: Partial<StatStages> };

  const status = typeof r.status === "string" && NON_VOLATILE.has(r.status) ? (r.status as NonVolatileAilment) : null;
  const stages = emptyStages();
  for (const key of STAGE_STATS) {
    const value = r.stages?.[key];
    if (typeof value === "number" && Number.isFinite(value)) stages[key] = clampStage(value);
  }

  return {
    status,
    sleepTurns: typeof r.sleepTurns === "number" && r.sleepTurns > 0 ? Math.floor(r.sleepTurns) : 0,
    stages,
    confusionTurns: typeof r.confusionTurns === "number" && r.confusionTurns > 0 ? Math.floor(r.confusionTurns) : 0,
    seeded: r.seeded === true,
    flinched: r.flinched === true,
    protected: r.protected === true,
    protectStreak: Math.max(0, Math.floor(Number(r.protectStreak) || 0)),
  };
}

function clampStage(value: number): number {
  return Math.max(-MAX_STAGE, Math.min(MAX_STAGE, Math.round(value)));
}

/** As condições de um combatente, sempre normalizadas (o motor nunca lê o cru). */
export function conditionsOf(mon: BattlePokemonState): MonConditions {
  if (!mon.conditions) mon.conditions = emptyConditions();
  return mon.conditions;
}

// ── multiplicadores ──────────────────────────────────────────────────────────

/**
 * A tabela da série para ataque/defesa/velocidade: +n multiplica por (2+n)/2 e
 * -n divide por (2+n)/2. +6 é ×4, -6 é ÷4.
 */
export function stageMultiplier(stage: number): number {
  const s = clampStage(stage);
  return s >= 0 ? (2 + s) / 2 : 2 / (2 - s);
}

/**
 * Precisão e evasão usam a OUTRA tabela da série — base 3, não 2 (+1 é ×4/3, e
 * não ×1.5). Um estágio de precisão pesar igual a um de ataque deixaria
 * sand-attack forte demais.
 */
export function accuracyStageMultiplier(stage: number): number {
  const s = clampStage(stage);
  return s >= 0 ? (3 + s) / 3 : 3 / (3 - s);
}

/** O atributo com o estágio já aplicado. Queimadura corta o Ataque pela metade. */
export function effectiveStat(mon: BattlePokemonState, stat: "attack" | "defense" | "specialAttack" | "specialDefense"): number {
  const c = conditionsOf(mon);
  const base = mon.stats[stat] * stageMultiplier(c.stages[stat]);
  const burned = stat === "attack" && c.status === "burn";
  return Math.max(1, Math.floor(burned ? base / 2 : base));
}

/** A Velocidade que decide a ordem do turno: estágio + paralisia (metade). */
export function effectiveSpeed(mon: BattlePokemonState): number {
  const c = conditionsOf(mon);
  const base = mon.stats.speed * stageMultiplier(c.stages.speed);
  return Math.max(1, Math.floor(c.status === "paralysis" ? base / 2 : base));
}

/** Multiplicador de acerto vindo dos estágios: precisão do atacante ÷ evasão do alvo. */
export function accuracyFactor(attacker: BattlePokemonState, defender: BattlePokemonState): number {
  const a = conditionsOf(attacker).stages.accuracy;
  const e = conditionsOf(defender).stages.evasion;
  return accuracyStageMultiplier(clampStage(a - e));
}

// ── imunidades (fiéis à série) ───────────────────────────────────────────────

/**
 * Quem NÃO pega cada status por causa do tipo. É o que dá identidade aos tipos
 * fora do dano: um pokémon de fogo não queima, um elétrico não paralisa. Sem
 * isso, "queimar o oponente" seria sempre a jogada certa, contra qualquer time.
 */
const AILMENT_TYPE_IMMUNITY: Record<NonVolatileAilment, string[]> = {
  burn: ["fire"],
  poison: ["poison", "steel"],
  paralysis: ["electric"],
  freeze: ["ice"],
  sleep: [],
};

export type AilmentBlock = "immune" | "already" | null;

/**
 * Por que o status NÃO pega: imunidade de tipo, ou já existe um status ali.
 * `null` = pega. Devolver o MOTIVO (e não um booleano) é o que deixa o log
 * dizer "não teve efeito" pelo motivo certo.
 */
export function ailmentBlockedBy(target: BattlePokemonState, ailment: Ailment): AilmentBlock {
  const c = conditionsOf(target);

  if (ailment === "confusion") return c.confusionTurns > 0 ? "already" : null;
  if (ailment === "leech-seed") {
    // Semente não pega em quem é do tipo grama — a mesma regra da série.
    if (target.types.includes("grass")) return "immune";
    return c.seeded ? "already" : null;
  }

  if (c.status) return "already"; // o slot não-volátil é UM só
  if (AILMENT_TYPE_IMMUNITY[ailment as NonVolatileAilment]?.some((t) => target.types.includes(t))) return "immune";
  return null;
}

// ── aplicação ────────────────────────────────────────────────────────────────

/** Sorteia inteiro em [min, max]. */
function rollBetween(min: number, max: number, rng: () => number): number {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  return lo + Math.floor(rng() * (hi - lo + 1));
}

/**
 * Quantos turnos o sono dura. A API manda a faixa do jogo original (2..4), mas
 * aqui a partida é curta e o turno leva até 90s de relógio real: 4 turnos sem
 * jogar é o oponente assistindo. Teto de 3, piso de 1.
 */
export const SLEEP_MIN_TURNS = 1;
export const SLEEP_MAX_TURNS = 3;
export const CONFUSION_MIN_TURNS = 1;
export const CONFUSION_MAX_TURNS = 4;

export interface AppliedAilment {
  ailment: Ailment;
  turns: number;
}

/**
 * Aplica o status no alvo. Quem checa se PODE é o motor (`ailmentBlockedBy`),
 * porque só ele sabe o que fazer com o "não teve efeito" no log.
 */
export function applyAilment(target: BattlePokemonState, ailment: Ailment, effect: { ailmentMinTurns: number | null; ailmentMaxTurns: number | null }, rng: () => number): AppliedAilment {
  const c = conditionsOf(target);

  if (ailment === "confusion") {
    const turns = rollBetween(
      Math.max(CONFUSION_MIN_TURNS, effect.ailmentMinTurns ?? CONFUSION_MIN_TURNS),
      Math.min(CONFUSION_MAX_TURNS, effect.ailmentMaxTurns ?? CONFUSION_MAX_TURNS),
      rng
    );
    c.confusionTurns = turns;
    return { ailment, turns };
  }

  if (ailment === "leech-seed") {
    c.seeded = true;
    return { ailment, turns: 0 };
  }

  c.status = ailment as NonVolatileAilment;
  if (ailment === "sleep") {
    c.sleepTurns = rollBetween(
      Math.max(SLEEP_MIN_TURNS, effect.ailmentMinTurns ?? SLEEP_MIN_TURNS),
      Math.min(SLEEP_MAX_TURNS, effect.ailmentMaxTurns ?? SLEEP_MAX_TURNS),
      rng
    );
    return { ailment, turns: c.sleepTurns };
  }
  return { ailment, turns: 0 };
}

export interface AppliedStage {
  stat: StageStat;
  /** quanto MUDOU de fato (0 = já estava no teto/piso). */
  delta: number;
  /** o estágio depois da mudança. */
  stage: number;
}

/**
 * Mexe nos estágios e devolve o que MUDOU DE FATO. O delta 0 (já estava em ±6)
 * é informação: é o que faz o log dizer "não sobe mais" em vez de fingir que
 * subiu — e é o que impede o loop de spammar buff pra sempre.
 */
export function applyStageChanges(target: BattlePokemonState, changes: StageChange[]): AppliedStage[] {
  const c = conditionsOf(target);
  return changes.map(({ stat, change }) => {
    const antes = c.stages[stat];
    const depois = clampStage(antes + change);
    c.stages[stat] = depois;
    return { stat, delta: depois - antes, stage: depois };
  });
}

// ── o turno ──────────────────────────────────────────────────────────────────

/** Por que um combatente não conseguiu agir (ou `null`: agiu normal). */
export type BlockReason = "sleep" | "freeze" | "paralysis" | "flinch" | "confusion";

export interface ActionGate {
  /** null = age normalmente. */
  blockedBy: BlockReason | null;
  /** a confusão bateu nele mesmo — o motor aplica o dano. */
  hitSelf: boolean;
  /** acordou/descongelou ANTES de agir (o log conta, e ele age no mesmo turno). */
  recovered: NonVolatileAilment | null;
}

/** Chance de descongelar por turno, e de travar com paralisia — valores da série. */
const THAW_CHANCE = 0.2;
const PARALYSIS_BLOCK_CHANCE = 0.25;
const CONFUSION_SELF_HIT_CHANCE = 1 / 3;

/**
 * O portão ANTES do golpe: dá pra agir, e o que acontece se não dá.
 *
 * A ordem é a da série, e ela importa: sono/congelamento primeiro (são a
 * condição mais dura), depois o recuo (flinch), depois paralisia, e a confusão
 * por último — quem está confuso ainda "tenta" agir, e só a confusão pode
 * resultar em dano no próprio dono.
 *
 * O rng SÓ é consumido por quem tem alguma condição: um pokémon limpo passa por
 * aqui sem rolar nada (é o que mantém os testes de turno determinísticos).
 */
export function actionGate(mon: BattlePokemonState, rng: () => number): ActionGate {
  const c = conditionsOf(mon);
  const gate: ActionGate = { blockedBy: null, hitSelf: false, recovered: null };

  if (c.status === "sleep") {
    if (c.sleepTurns > 0) {
      c.sleepTurns -= 1;
      if (c.sleepTurns <= 0) c.status = null; // acorda pro PRÓXIMO turno
      gate.blockedBy = "sleep";
      return gate;
    }
    c.status = null;
    gate.recovered = "sleep";
  }

  if (c.status === "freeze") {
    if (rng() < THAW_CHANCE) {
      c.status = null;
      gate.recovered = "freeze";
    } else {
      gate.blockedBy = "freeze";
      return gate;
    }
  }

  if (c.flinched) {
    gate.blockedBy = "flinch";
    return gate;
  }

  if (c.status === "paralysis" && rng() < PARALYSIS_BLOCK_CHANCE) {
    gate.blockedBy = "paralysis";
    return gate;
  }

  if (c.confusionTurns > 0) {
    c.confusionTurns -= 1;
    if (rng() < CONFUSION_SELF_HIT_CHANCE) {
      gate.blockedBy = "confusion";
      gate.hitSelf = true;
      return gate;
    }
  }

  return gate;
}

// ── fim de turno ─────────────────────────────────────────────────────────────

/** Fração do HP MÁXIMO perdida por turno. Os denominadores são os da série. */
const BURN_FRACTION = 1 / 16;
const POISON_FRACTION = 1 / 8;
export const LEECH_FRACTION = 1 / 8;

/** Pelo menos 1 de dano: com HP baixo, 1/16 arredondaria pra 0 e o veneno viraria enfeite. */
function fractionOf(maxHp: number, fraction: number): number {
  return Math.max(1, Math.floor(maxHp * fraction));
}

/** O estrago que o status cobra no fim do turno (0 se não há status de dano). */
export function residualDamage(mon: BattlePokemonState): number {
  const c = conditionsOf(mon);
  if (c.status === "burn") return fractionOf(mon.maxHp, BURN_FRACTION);
  if (c.status === "poison") return fractionOf(mon.maxHp, POISON_FRACTION);
  return 0;
}

/** O que a semente drena por turno de quem está plantado. */
export function leechDamage(mon: BattlePokemonState): number {
  return conditionsOf(mon).seeded ? fractionOf(mon.maxHp, LEECH_FRACTION) : 0;
}

/**
 * O que a TROCA leva embora: estágios, confusão, semente e recuo. O status
 * não-volátil FICA — é a assimetria que dá peso à queimadura e ao veneno (deles
 * não se foge trocando) e que ainda assim deixa a troca ser a resposta a um
 * debuff. Também é o que se limpa quando o pokémon desmaia e outro entra.
 */
export function clearVolatiles(mon: BattlePokemonState): void {
  const c = conditionsOf(mon);
  c.stages = emptyStages();
  c.confusionTurns = 0;
  c.seeded = false;
  c.flinched = false;
  c.protected = false;
  // A SEQUÊNCIA também zera na troca. É consistente com o resto (trocar limpa o
  // volátil), e sem isso dava pra burlar a chance decrescente: protege, troca,
  // volta, e a proteção estaria cheia de novo.
  c.protectStreak = 0;
}

/**
 * A chance de a proteção pegar, dado quantas vezes seguidas já pegou.
 * 100% → 50% → 25% → … É o que impede a proteção de virar a jogada padrão de
 * quem tem energia sobrando.
 */
export function protectChance(streak: number): number {
  return 100 / Math.pow(2, Math.max(0, streak));
}
