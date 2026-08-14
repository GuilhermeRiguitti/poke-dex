// O que um golpe faz ALÉM de bater, já traduzido pra mecânica do nosso duelo.
//
// A PokéAPI dá isso pronto em `/move` (`meta` + `stat_changes` + `target` +
// `effect_chance`), e o espelho copia CRU na coluna `Move.effect` (ver
// lib/pokeapi.ts). Este arquivo é o outro lado: lê aquele Json e devolve um
// `MoveEffect` — o contrato que o motor entende. É a mesma divisão de
// `baseStats` (copiado cru) × `deriveStats` (interpreta).
//
// POR QUE A TRADUÇÃO MORA AQUI, e não no sync:
// as decisões abaixo são REGRA DE JOGO, não dado da API — quais status o jogo
// suporta, o que "chance 0" quer dizer, de quem é o stat que sobe. Deixá-las no
// sync congelaria a regra dentro de ~350 linhas do banco: mudar de ideia
// obrigaria a re-sincronizar tudo contra a PokéAPI. Aqui, muda o código e a
// próxima partida já joga diferente.
//
// Puro: sem Prisma, sem fetch, sem React.

/**
 * Os estados alterados que o jogo IMPLEMENTA. A API tem mais uns 15
 * (`infatuation`, `trap`, `nightmare`, `disable`…); o que não está aqui vira
 * `null` e o golpe fica sem efeito — mentir seria pior que não fazer nada.
 *
 * Os cinco primeiros são NÃO-VOLÁTEIS (um por vez, sobrevivem à troca); os dois
 * últimos são voláteis e a troca limpa. Ver conditions.ts.
 */
export type Ailment = "burn" | "poison" | "paralysis" | "sleep" | "freeze" | "confusion" | "leech-seed";

const AILMENTS = new Set<string>(["burn", "poison", "paralysis", "sleep", "freeze", "confusion", "leech-seed"]);

/** Os atributos que aceitam estágio. `accuracy`/`evasion` só existem em batalha. */
export type StageStat =
  | "attack"
  | "defense"
  | "specialAttack"
  | "specialDefense"
  | "speed"
  | "accuracy"
  | "evasion";

/** Nomes da API (snake-case) → as nossas chaves. `hp` não tem estágio. */
const STAT_BY_API_NAME: Record<string, StageStat> = {
  attack: "attack",
  defense: "defense",
  "special-attack": "specialAttack",
  "special-defense": "specialDefense",
  speed: "speed",
  accuracy: "accuracy",
  evasion: "evasion",
};

export interface StageChange {
  stat: StageStat;
  /** quantos estágios, com sinal (+2 = swords-dance, -1 = growl) */
  change: number;
}

/** O efeito de um golpe, pronto pro motor aplicar. Só o que o jogo sabe fazer. */
export interface MoveEffect {
  ailment: Ailment | null;
  /** 0..100 — já resolvido: num golpe de status puro isto é 100, não 0. */
  ailmentChance: number;
  /** turnos que o ailment dura, quando ele é temporário (sono, confusão). */
  ailmentMinTurns: number | null;
  ailmentMaxTurns: number | null;
  stageChanges: StageChange[];
  /** 0..100 — idem: no golpe de status puro é 100. */
  stageChance: number;
  /** de quem é o estágio que muda. */
  stageTarget: "self" | "foe";
  flinchChance: number;
  /** % do HP MÁXIMO curado no usuário (recover = 50). */
  healPct: number;
  /** % do DANO causado: >0 dreno (absorb = 50), <0 recuo (take-down = -25). */
  drainPct: number;
  /** estágios de crítico somados (razor-leaf = 1). */
  critStage: number;
  /** golpe de múltiplos acertos: [min, max] (double-kick = [2,2]). */
  minHits: number;
  maxHits: number;
  /**
   * PROTEÇÃO: anula o golpe que vier contra você NESTE turno.
   *
   * É a "mecânica reativa" do TODO, e o que a torna aceitável é ela ser
   * ESCOLHIDA ÀS CEGAS, como qualquer outra carta — a janela de reação do plano
   * antigo pressupunha turno alternado (ver a lista de "não reintroduzir" do
   * CLAUDE.md) e morreu junto com ele. Aqui não há reação a nada: você aposta
   * que o oponente vai atacar, e paga energia por essa aposta.
   */
  protects: boolean;
}

/** true se o efeito realmente MUDA alguma coisa — senão o golpe segue inerte. */
export function hasEffect(effect: MoveEffect | null | undefined): effect is MoveEffect {
  if (!effect) return false;
  return (
    effect.ailment !== null ||
    effect.stageChanges.length > 0 ||
    effect.flinchChance > 0 ||
    effect.healPct > 0 ||
    effect.drainPct !== 0 ||
    effect.critStage > 0 ||
    effect.maxHits > 1 ||
    effect.protects
  );
}

/**
 * Os golpes que PROTEGEM. É uma lista de NOMES, e não uma leitura do `meta`,
 * porque a API não dá o sinal: `protect`, `detect` e companhia vêm com
 * `meta.category = "unique"` — a mesma categoria de `substitute`, `transform` e
 * outra dúzia de coisas que não têm nada a ver. Ler "unique" como proteção
 * transformaria vários golpes em escudo por engano, que é pior que a lista.
 *
 * A lista é curta e estável: a família não cresce todo ano.
 */
const PROTECT_MOVES = new Set([
  "protect",
  "detect",
  "spiky-shield",
  "kings-shield",
  "baneful-bunker",
  "obstruct",
  "silk-trap",
  "burning-bulwark",
]);

export function isProtectMove(moveName: string | undefined): boolean {
  return moveName !== undefined && PROTECT_MOVES.has(moveName);
}

/** O golpe muda alguma coisa em quem USA (e por isso não precisa acertar ninguém). */
export function isSelfDirected(effect: MoveEffect): boolean {
  return effect.healPct > 0 || (effect.stageChanges.length > 0 && effect.stageTarget === "self");
}

// ── a leitura do Json cru ────────────────────────────────────────────────────

interface RawEffect {
  ailment?: unknown;
  ailmentChance?: unknown;
  category?: unknown;
  critRate?: unknown;
  drain?: unknown;
  flinchChance?: unknown;
  healing?: unknown;
  minHits?: unknown;
  maxHits?: unknown;
  minTurns?: unknown;
  maxTurns?: unknown;
  statChance?: unknown;
  statChanges?: unknown;
  target?: unknown;
  effectChance?: unknown;
}

function num(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function optionalNum(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * De quem é o estágio que muda. A API não diz direto — `target` é sobre o
 * GOLPE, não sobre o estágio (ancient-power mira o oponente e sobe os stats de
 * quem usou). A ordem abaixo é o que acerta os três casos que existem:
 *
 *  1. golpe mirado no próprio usuário (swords-dance) → self;
 *  2. categoria `damage+raise` (ancient-power) → self, mesmo mirando o oponente;
 *  3. o resto → foe. Inclui `swagger`, que SOBE o ataque do oponente (+2) junto
 *     com a confusão — por isso a regra não pode ser "mudança positiva = self".
 */
function resolveStageTarget(target: string, category: string): "self" | "foe" {
  if (target.startsWith("user")) return "self";
  if (category === "damage+raise") return "self";
  return "foe";
}

/**
 * Traduz a coluna `Move.effect` (Json cru da PokéAPI) pro efeito que o motor
 * aplica. Devolve `null` quando não há nada que este jogo saiba fazer — golpe
 * sem dado (linha semeada antes desta fatia), ailment não suportado, ou
 * categoria que a gente não modela (clima, barreira, troca forçada).
 *
 * A conversão de CHANCE é a única sutileza: a API usa 0 para "é o efeito
 * principal do golpe, sempre acontece" (thunder-wave tem `ailment_chance: 0` e
 * paralisa 100% das vezes que acerta) e um número só quando é efeito
 * SECUNDÁRIO de um golpe de dano (ember, 10). Ler o 0 ao pé da letra deixaria
 * metade dos golpes de status inertes de novo — que é exatamente o bug que esta
 * fatia veio consertar.
 */
export function parseMoveEffect(raw: unknown, moveName?: string): MoveEffect | null {
  const protects = isProtectMove(moveName);

  // A proteção é a ÚNICA coisa aqui que não vem do Json: ela é decidida pelo
  // NOME, porque a API não a distingue (ver PROTECT_MOVES). Então ela precisa
  // sobreviver mesmo quando `Move.effect` está null — que é o caso de todo golpe
  // semeado antes da fatia dos efeitos.
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return protects ? { ...EMPTY_EFFECT, protects: true } : null;
  }
  const r = raw as RawEffect;

  const category = typeof r.category === "string" ? r.category : "damage";
  const target = typeof r.target === "string" ? r.target : "selected-pokemon";
  const effectChance = optionalNum(r.effectChance);

  const ailmentName = typeof r.ailment === "string" ? r.ailment : "none";
  const ailment = AILMENTS.has(ailmentName) ? (ailmentName as Ailment) : null;

  const stageChanges: StageChange[] = Array.isArray(r.statChanges)
    ? r.statChanges
        .map((s) => {
          const entry = s as { stat?: unknown; change?: unknown };
          const stat = typeof entry.stat === "string" ? STAT_BY_API_NAME[entry.stat] : undefined;
          const change = num(entry.change);
          return stat && change !== 0 ? { stat, change } : null;
        })
        .filter((c): c is StageChange => c !== null)
    : [];

  // 0 = "sempre" (efeito principal); qualquer outro número = chance secundária.
  const chanceOf = (own: number) => (own > 0 ? own : (effectChance ?? 0) > 0 ? (effectChance as number) : 100);

  const effect: MoveEffect = {
    ailment,
    ailmentChance: ailment ? chanceOf(num(r.ailmentChance)) : 0,
    ailmentMinTurns: optionalNum(r.minTurns),
    ailmentMaxTurns: optionalNum(r.maxTurns),
    stageChanges,
    stageChance: stageChanges.length > 0 ? chanceOf(num(r.statChance)) : 0,
    stageTarget: resolveStageTarget(target, category),
    flinchChance: num(r.flinchChance),
    healPct: Math.max(0, num(r.healing)),
    drainPct: num(r.drain),
    critStage: Math.max(0, num(r.critRate)),
    minHits: Math.max(1, num(r.minHits, 1)),
    maxHits: Math.max(1, num(r.maxHits, 1)),
    protects,
  };

  return hasEffect(effect) ? effect : null;
}

/** Um efeito que não faz nada — a base pra montar um só com proteção. */
const EMPTY_EFFECT: MoveEffect = {
  ailment: null,
  ailmentChance: 0,
  ailmentMinTurns: null,
  ailmentMaxTurns: null,
  stageChanges: [],
  stageChance: 0,
  stageTarget: "foe",
  flinchChance: 0,
  healPct: 0,
  drainPct: 0,
  critStage: 0,
  minHits: 1,
  maxHits: 1,
  protects: false,
};
