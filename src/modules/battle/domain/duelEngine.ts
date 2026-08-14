import { orderForTurn, type OrderInput } from "./turnOrder";
import { calculateDamage, confusionSelfDamage, rollAccuracy } from "./damage";
import { effectivenessMultiplier, TypeEffectivenessMap } from "./typeChart";
import {
  actionGate,
  ailmentBlockedBy,
  applyAilment,
  applyStageChanges,
  clearVolatiles,
  conditionsOf,
  leechDamage,
  residualDamage,
  protectChance,
} from "./conditions";
import { hasEffect, isSelfDirected, type MoveEffect } from "./moveEffect";
import { ENERGY_START, energyCostOf, hasAffordableCard, regenEnergy } from "./energy";
import type { BattleMoveDef, BattlePokemonState } from "./types";
import {
  activeOf,
  hasLivingMon,
  needsForcedSwitch,
  type DuelAction,
  type DuelEvent,
  type DuelSide,
  type DuelState,
} from "./duelTypes";

/**
 * Carta de último recurso, quando NENHUMA carta do ativo tem PP. Sem isso, um
 * pokémon sem PP não teria ação nenhuma e ficaria travado (acumulando falta por
 * não jogar = derrota por abandono). Não vem da PokéAPI: os valores são nossos
 * (o struggle real tem recuo, que este sistema não modela). maxPp/currentPp 0 e
 * é um objeto COMPARTILHADO — quem usa não pode decrementá-lo (viraria -1 e
 * vazaria entre partidas), por isso a guarda `currentPp > 0` antes de gastar.
 */
const STRUGGLE: BattleMoveDef = {
  id: 0,
  name: "struggle",
  type: "normal",
  power: 50,
  accuracy: null, // sempre acerta
  damageClass: "physical",
  priority: 0,
  maxPp: 0,
  currentPp: 0,
};

// Motor PURO do duelo SIMULTÂNEO em TIME. Recebe um DuelState + as DUAS jogadas
// do round e devolve o novo estado. Sem banco, sem rede, sem Math.random direto
// (rng injetado): determinístico e testável. A orquestração (Prisma, trava
// otimista, transação) fica na camada de command, como sempre.
//
// O turno é uma unidade indivisível. Diferença pro 1×1 puro: uma jogada pode ser
// TROCA (SWITCH), que resolve ANTES dos ataques; e desmaiar NÃO acaba a partida
// enquanto o lado tiver reserva viva — só zerar o time é derrota.

/** true se o pokémon ainda tem ao menos uma carta com PP. */
function hasUsableCard(mon: BattlePokemonState): boolean {
  return mon.moves.some((m) => m.currentPp > 0);
}

function cloneState(state: DuelState): DuelState {
  return JSON.parse(JSON.stringify(state)) as DuelState;
}

export interface ResolveRoundParams {
  state: DuelState;
  /** as jogadas do round; a ordem entre elas não importa (são casadas por userId). */
  actionA: DuelAction;
  actionB: DuelAction;
  typeChart: TypeEffectivenessMap;
  rng: () => number;
}

export interface DuelResult {
  state: DuelState;
  events: DuelEvent[];
  winnerId: string | null;
  finished: boolean;
}

/** Monta o estado inicial do duelo: rodada 1, os dois lados intactos. */
export function startDuel(sideA: DuelSide, sideB: DuelSide): DuelState {
  return { round: 1, sideA, sideB };
}

/** Tudo que UM golpe precisa saber pra sair: quem bate, em quem, e onde anotar. */
interface AttackContext {
  attacker: BattlePokemonState;
  defender: BattlePokemonState;
  attackerUserId: string;
  defenderUserId: string;
  typeChart: TypeEffectivenessMap;
  rng: () => number;
  events: DuelEvent[];
  /**
   * O LADO de quem ataca — o motor debita a energia aqui. Vem o lado inteiro, e
   * não um número, porque o débito tem que sobreviver ao retorno da função (o
   * estado já é um clone; mutá-lo é como o resto do motor trabalha).
   */
  attackerSide: DuelSide;
}

/** Tira HP de alguém e marca o desmaio. Devolve quanto saiu de fato. */
function damageMon(mon: BattlePokemonState, amount: number): number {
  const dealt = Math.min(mon.currentHp, Math.max(0, amount));
  mon.currentHp -= dealt;
  if (mon.currentHp === 0) mon.fainted = true;
  return dealt;
}

/** Devolve HP a alguém, sem passar do máximo. Devolve quanto entrou de fato. */
function healMon(mon: BattlePokemonState, amount: number): number {
  const healed = Math.min(mon.maxHp - mon.currentHp, Math.max(0, amount));
  mon.currentHp += healed;
  return healed;
}

/** Percentual do HP máximo, nunca menos de 1 — meio ponto de cura seria zero. */
function pctOfMaxHp(mon: BattlePokemonState, pct: number): number {
  return Math.max(1, Math.floor((mon.maxHp * pct) / 100));
}

/**
 * Quantas vezes um golpe de múltiplos acertos bate. A PokéAPI dá a faixa
 * (double-kick 2..2, fury-swipes 2..5); só sorteia quando a faixa é aberta, pra
 * não consumir rng em golpe normal.
 */
function rollHits(effect: MoveEffect | null | undefined, rng: () => number): number {
  if (!effect || effect.maxHits <= 1) return 1;
  if (effect.maxHits === effect.minHits) return effect.minHits;
  return effect.minHits + Math.floor(rng() * (effect.maxHits - effect.minHits + 1));
}

/**
 * O golpe precisa ACERTAR alguém? Sim quando ele encosta no oponente (status,
 * debuff); não quando só mexe em quem usa (swords-dance, recover) — aí não há
 * alvo pra desviar, e na série esses golpes não erram.
 */
function targetsFoe(effect: MoveEffect | null | undefined): boolean {
  if (!hasEffect(effect)) return false;
  return effect.ailment !== null || effect.flinchChance > 0 || !isSelfDirected(effect);
}

/**
 * Aplica o que o golpe faz ALÉM do dano: status, estágio de atributo, recuo,
 * dreno/recuo de HP e cura. Só é chamado quando o golpe CONECTOU — ember não
 * queima quando erra, senão errar deixaria de ser punição.
 */
function applyMoveEffect(ctx: AttackContext, card: BattleMoveDef, damageDealt: number): void {
  const { attacker, defender, attackerUserId, defenderUserId, rng, events } = ctx;
  const effect = card.effect;
  if (!hasEffect(effect)) return;

  // DRENO / RECUO — proporcional ao dano causado (absorb devolve 50%,
  // take-down cobra 25%). Vem antes do status: se o recuo derruba quem usou, o
  // log conta o desmaio no lugar certo.
  if (effect.drainPct !== 0 && damageDealt > 0) {
    const amount = Math.max(1, Math.floor((damageDealt * Math.abs(effect.drainPct)) / 100));
    if (effect.drainPct > 0) {
      const healed = healMon(attacker, amount);
      if (healed > 0) {
        events.push({ type: "tick", targetUserId: attackerUserId, monName: attacker.name, source: "drain", hp: healed });
      }
    } else {
      const lost = damageMon(attacker, amount);
      events.push({
        type: "tick",
        targetUserId: attackerUserId,
        monName: attacker.name,
        source: "recoil",
        hp: -lost,
        fainted: attacker.fainted || undefined,
      });
    }
  }

  // CURA no próprio usuário (recover, roost).
  if (effect.healPct > 0) {
    const healed = healMon(attacker, pctOfMaxHp(attacker, effect.healPct));
    events.push({ type: "tick", targetUserId: attackerUserId, monName: attacker.name, source: "heal", hp: healed });
  }

  // ESTÁGIO DE ATRIBUTO. Alvo desmaiado não recebe debuff (o próximo entra limpo).
  if (effect.stageChanges.length > 0) {
    const naSorte = effect.stageChance >= 100 || rng() * 100 < effect.stageChance;
    const alvo = effect.stageTarget === "self" ? attacker : defender;
    const alvoUserId = effect.stageTarget === "self" ? attackerUserId : defenderUserId;
    if (naSorte && !alvo.fainted) {
      for (const applied of applyStageChanges(alvo, effect.stageChanges)) {
        events.push({
          type: "stage",
          targetUserId: alvoUserId,
          monName: alvo.name,
          stat: applied.stat,
          delta: applied.delta,
          stage: applied.stage,
        });
      }
    }
  }

  // STATUS. Só no oponente: os golpes que se auto-adormecem (rest) são categoria
  // que o jogo não modela, então não há caso de status em quem usa.
  if (effect.ailment && !defender.fainted) {
    const naSorte = effect.ailmentChance >= 100 || rng() * 100 < effect.ailmentChance;
    if (naSorte) {
      const blocked = ailmentBlockedBy(defender, effect.ailment);
      if (blocked) {
        // Só vira linha de log quando o golpe EXISTIA pra isso (thunder-wave num
        // elétrico). Num efeito secundário de 10% ninguém precisa saber.
        if (effect.ailmentChance >= 100) {
          events.push({
            type: "ailment",
            targetUserId: defenderUserId,
            monName: defender.name,
            ailment: effect.ailment,
            blocked,
          });
        }
      } else {
        applyAilment(defender, effect.ailment, effect, rng);
        events.push({
          type: "ailment",
          targetUserId: defenderUserId,
          monName: defender.name,
          ailment: effect.ailment,
        });
      }
    }
  }

  // RECUO (flinch): quem ainda não agiu neste turno perde o turno. Só vale se
  // quem usou for MAIS RÁPIDO — é o prêmio da Velocidade no turno simultâneo.
  if (effect.flinchChance > 0 && !defender.fainted && rng() * 100 < effect.flinchChance) {
    conditionsOf(defender).flinched = true;
  }
}

/**
 * Executa o golpe de um lado. Devolve true se o alvo desmaiou.
 *
 * Não age quem já foi nocauteado neste mesmo turno (o golpe que veio primeiro
 * matou). Quem trocou/hesitou nem chega aqui (não está na lista de atacantes).
 */
function executeAttack(ctx: AttackContext, cardSlot: number): boolean {
  const { attacker, defender, attackerUserId, typeChart, rng, events } = ctx;
  if (attacker.fainted) return false; // nocauteado antes de agir: perdeu o turno

  // O PORTÃO DAS CONDIÇÕES, antes de qualquer carta: dormindo, congelado,
  // paralisado, confuso ou recuado, o turno acaba aqui — e SEM gastar PP, como
  // na série. O rng só é tocado por quem tem alguma condição.
  const gate = actionGate(attacker, rng);
  if (gate.recovered) {
    events.push({
      type: "recovered",
      targetUserId: attackerUserId,
      monName: attacker.name,
      ailment: gate.recovered,
    });
  }
  if (gate.blockedBy) {
    const selfDamage = gate.hitSelf ? damageMon(attacker, confusionSelfDamage(attacker, rng)) : undefined;
    events.push({
      type: "blocked",
      targetUserId: attackerUserId,
      monName: attacker.name,
      reason: gate.blockedBy,
      selfDamage,
    });
    return false;
  }

  const chosen = attacker.moves[cardSlot];

  // PP: carta sem PP com OUTRA disponível é jogada inválida (o command já
  // barra; isto é a rede de baixo) → passa em branco. NENHUMA carta com PP →
  // STRUGGLE, senão o jogador ficaria travado.
  let card = chosen;
  if (!card || (card.currentPp <= 0 && hasUsableCard(attacker))) {
    events.push({ type: "hesitate", userId: attackerUserId });
    return false;
  }
  if (card.currentPp <= 0) card = STRUGGLE;

  // ENERGIA: o segundo limitador, com a MESMA forma do PP — inválida com outra
  // pagável vira hesitação (a rede de baixo do que o submitAction já barra);
  // NENHUMA pagável cai em STRUGGLE, que custa 0. Sem esse segundo ramo, ficar
  // sem energia viraria derrota por abandono sem o jogador ter errado nada.
  const energiaAntes = ctx.attackerSide.energy ?? ENERGY_START;
  let custo = card === STRUGGLE ? 0 : energyCostOf(card);
  if (custo > energiaAntes) {
    if (hasAffordableCard(attacker.moves, energiaAntes)) {
      events.push({ type: "hesitate", userId: attackerUserId });
      return false;
    }
    card = STRUGGLE;
    custo = 0;
  }

  // PP e energia saem no USO, antes de rolar acerto (errar cobra igual, como o
  // PP sempre cobrou). `card` é do estado clonado; STRUGGLE é compartilhado e
  // tem PP 0 — a guarda evita decrementá-lo pra -1 e vazar entre partidas.
  if (card.currentPp > 0) card.currentPp -= 1;
  ctx.attackerSide.energy = energiaAntes - custo;

  // A carta de proteção já resolveu lá em cima (1.5). Aqui ela só consome o
  // turno: não bate, não rola precisão, não aplica efeito.
  if (card.effect?.protects) return true;

  // ESCUDO DO ALVO: PP e energia já saíram (o golpe foi usado), mas nada
  // acontece com quem está protegido. Cobrar o custo é o que dá sentido à
  // aposta — protect só vale a pena porque o oponente PERDE o turno junto.
  if (conditionsOf(defender).protected) {
    events.push({
      type: "blocked",
      targetUserId: ctx.defenderUserId,
      monName: defender.name,
      reason: "protected",
    });
    return true;
  }

  const effectiveness = effectivenessMultiplier(typeChart, card.type, defender.types);
  const result = calculateDamage({ attacker, defender, move: card, effectiveness, rng });

  let damageDealt = damageMon(defender, result.damage);
  let hits = 1;

  // MÚLTIPLOS ACERTOS: a precisão é rolada UMA vez (a do primeiro golpe); os
  // acertos seguintes só rolam crítico e variância — como na série.
  if (!result.missed && result.damage > 0) {
    const total = rollHits(card.effect, rng);
    const semPrecisao: BattleMoveDef = { ...card, accuracy: null };
    while (hits < total && !defender.fainted) {
      const extra = calculateDamage({ attacker, defender, move: semPrecisao, effectiveness, rng });
      damageDealt += damageMon(defender, extra.damage);
      hits += 1;
    }
  }

  // Golpe de fogo descongela o alvo — senão o congelamento viraria sentença, e
  // é justamente o fogo que a série usa pra dar a saída.
  if (damageDealt > 0 && card.type === "fire" && conditionsOf(defender).status === "freeze") {
    conditionsOf(defender).status = null;
    events.push({
      type: "recovered",
      targetUserId: ctx.defenderUserId,
      monName: defender.name,
      ailment: "freeze",
    });
  }

  // A precisão do golpe de STATUS é rolada aqui (o calculateDamage devolve cedo
  // pra quem não tem poder e nunca chega a rolar nada). Só quem mira o oponente
  // pode errar; o que mexe em quem usa não tem alvo pra desviar.
  const statusMissed = !card.power && targetsFoe(card.effect) && !rollAccuracy(card, attacker, defender, rng);

  events.push({
    type: "attack",
    userId: attackerUserId,
    cardName: card.name,
    damage: damageDealt,
    effectiveness: result.effectiveness,
    isCrit: result.isCrit,
    missed: result.missed || statusMissed,
    targetFainted: defender.fainted,
    hits: hits > 1 ? hits : undefined,
  });

  // "Conectou" = tem direito a efeito. Golpe de dano precisa ter acertado e não
  // ser imune; golpe de status precisa não ter errado.
  const connected = card.power ? !result.missed && result.effectiveness !== 0 : !statusMissed;
  if (connected) applyMoveEffect(ctx, card, damageDealt);

  return defender.fainted;
}

/**
 * Aplica uma TROCA voluntária de um lado: o ativo sai, o pokémon do slot alvo
 * entra. Emite o evento. Troca inválida (alvo inexistente, desmaiado, ou é o
 * próprio ativo) é ignorada — o command já valida; isto é a rede de baixo.
 */
function applyVoluntarySwitch(
  side: DuelSide,
  targetSlot: number,
  events: DuelEvent[],
  moves?: BattleMoveDef[]
): void {
  const from = activeOf(side);
  const target = side.team.find((m) => m.slot === targetSlot);
  if (!target || target.fainted || target.slot === side.activeSlot) return;
  // Quem SAI de campo perde estágios, confusão e semente — o status
  // não-volátil (queimadura, veneno...) vai junto com ele. É essa assimetria
  // que faz a troca ser resposta a um debuff sem ser fuga de tudo.
  clearVolatiles(from);
  side.activeSlot = targetSlot;
  equipOnEntry(target, moves);
  events.push({ type: "switch", userId: side.userId, fromName: from.name, toName: target.name });
}

/**
 * Monta a barra de skills de quem ENTRA em campo.
 *
 * A escolha é do jogador e chega junto com a troca. Só troca a barra se veio
 * escolha: no auto-promover por timeout não vem nada, e aí o pokémon entra com a
 * barra que já tinha — nunca em campo sem golpe nenhum.
 *
 * O PP é o do momento da ENTRADA, não zerado: quem volta pra reserva e retorna
 * mantém o que gastou. Reentrar com PP cheio faria da troca uma recarga infinita.
 */
export function equipOnEntry(mon: BattlePokemonState, moves?: BattleMoveDef[]): void {
  if (!moves || moves.length === 0) return;

  const ppAnterior = new Map(mon.moves.map((m) => [m.id, m.currentPp]));
  mon.moves = moves.map((m) => ({ ...m, currentPp: ppAnterior.get(m.id) ?? m.currentPp }));
}

/**
 * O fecho do turno: o preço do status.
 *
 * Queimadura e veneno tiram um pedaço fixo do HP máximo, e a semente passa esse
 * pedaço pro pokémon do outro lado. Depois disso o RECUO do turno é apagado —
 * flinch dura um turno só, e só quem ainda não tinha agido chega a sentir.
 *
 * Roda no round NORMAL e nele só. O round de troca forçada é uma pausa (só o
 * dono do desmaio joga) e o round 0 é preparação: cobrar status ali faria a
 * queimadura tirar HP duas vezes na mesma rodada de jogo.
 *
 * Ordem fixa (sideA depois sideB) de propósito: as duas lambdas concorrentes
 * têm que reconstruir exatamente o mesmo log, e `orderedSides` já ordena por
 * userId antes de chegar aqui.
 */
function applyEndOfTurn(state: DuelState, events: DuelEvent[]): void {
  for (const side of [state.sideA, state.sideB]) {
    const mon = activeOf(side);
    if (mon.fainted) continue;

    const residual = residualDamage(mon);
    if (residual > 0) {
      const lost = damageMon(mon, residual);
      events.push({
        type: "tick",
        targetUserId: side.userId,
        monName: mon.name,
        source: conditionsOf(mon).status ?? "status",
        hp: -lost,
        fainted: mon.fainted || undefined,
      });
    }
    if (mon.fainted) continue;

    const leech = leechDamage(mon);
    if (leech > 0) {
      const lost = damageMon(mon, leech);
      events.push({
        type: "tick",
        targetUserId: side.userId,
        monName: mon.name,
        source: "leech-seed",
        hp: -lost,
        fainted: mon.fainted || undefined,
      });
      // O que a semente tira vai pro pokémon do outro lado — é o que faz dela
      // uma troca de recursos, e não só dano por turno.
      const foe = activeOf(side === state.sideA ? state.sideB : state.sideA);
      if (!foe.fainted) {
        const healed = healMon(foe, lost);
        if (healed > 0) {
          const foeUserId = side === state.sideA ? state.sideB.userId : state.sideA.userId;
          events.push({ type: "tick", targetUserId: foeUserId, monName: foe.name, source: "leech-gain", hp: healed });
        }
      }
    }
  }

  // O recuo e o ESCUDO valem só pro turno em que foram levantados. Limpar TODO
  // o time (e não só o ativo) é barato e fecha a porta pro flag vazar num
  // snapshot persistido.
  //
  // ⚠️ `protectStreak` NÃO é limpo aqui: ele é o que faz a proteção repetida
  // ficar cada vez mais fraca, e por isso precisa atravessar o turno. Quem zera
  // é a própria carta (ao falhar) e a troca (clearVolatiles).
  for (const side of [state.sideA, state.sideB]) {
    for (const mon of side.team) {
      const c = conditionsOf(mon);
      c.flinched = false;
      c.protected = false;
    }
  }
}

/** Desfecho da partida a partir das reservas vivas: quem zerou o time perdeu. */
function outcome(state: DuelState): { finished: boolean; winnerId: string | null } {
  const aLiving = hasLivingMon(state.sideA);
  const bLiving = hasLivingMon(state.sideB);
  if (aLiving && bLiving) return { finished: false, winnerId: null };
  if (!aLiving && !bLiving) return { finished: true, winnerId: null }; // empate (duplo nocaute do último)
  return { finished: true, winnerId: aLiving ? state.sideA.userId : state.sideB.userId };
}

/**
 * Resolve UM round NORMAL inteiro (os dois lados com ativo vivo):
 *  1. as TROCAS resolvem primeiro (quem trocou não ataca, e quem sai larga
 *     estágios e condições voláteis);
 *  2. os ATAQUES saem na ordem priority → Speed EFETIVO → sorteio, contra o
 *     ativo ATUAL de cada lado (pós-troca) — quem entrou por troca PODE tomar
 *     dano. Cada golpe passa antes pelo portão das condições (dormindo,
 *     paralisado, confuso, recuado) e, depois de conectar, aplica o que ele faz
 *     além do dano (status, estágio, dreno, cura);
 *  3. o FIM DO TURNO cobra queimadura/veneno/semente e apaga o recuo;
 *  4. desmaiar NÃO encerra enquanto houver reserva viva; a partida só acaba
 *     quando um lado zera o time.
 *
 * Idempotência/concorrência ficam na camada de command (trava otimista + tx).
 */
export function resolveRound(params: ResolveRoundParams): DuelResult {
  const { typeChart, rng } = params;
  const state = cloneState(params.state);
  const events: DuelEvent[] = [];

  for (const action of [params.actionA, params.actionB]) {
    if (action.userId !== state.sideA.userId && action.userId !== state.sideB.userId) {
      throw new Error(`userId ${action.userId} não pertence a este duelo`);
    }
  }
  if (params.actionA.userId === params.actionB.userId) {
    throw new Error("as duas ações do round são do mesmo jogador");
  }

  const actionOf: Record<string, DuelAction> = {
    [params.actionA.userId]: params.actionA,
    [params.actionB.userId]: params.actionB,
  };

  // 1) TROCAS primeiro (fiel à série): mudam o ativo antes de qualquer ataque.
  for (const side of [state.sideA, state.sideB]) {
    const action = actionOf[side.userId];
    if (action.type === "SWITCH") applyVoluntarySwitch(side, action.targetSlot, events, action.moves);
  }

  // Hesitação (NONE) vira evento; troca e golpe não hesitam.
  for (const side of [state.sideA, state.sideB]) {
    if (actionOf[side.userId].type === "NONE") events.push({ type: "hesitate", userId: side.userId });
  }

  // 1.5) PROTEÇÃO, antes dos ataques e depois das trocas.
  //
  // Resolver aqui é o que torna a mecânica REATIVA sem ser uma janela de reação:
  // os dois escolheram às cegas no mesmo round, e quem apostou no escudo
  // descobre junto com o outro se acertou a aposta. Se resolvesse na ordem do
  // turno, um protect "lento" seria inútil contra golpe de priority alta — a
  // proteção deixaria de ser aposta e viraria função da Speed.
  for (const side of [state.sideA, state.sideB]) {
    const action = actionOf[side.userId];
    const mon = activeOf(side);
    const card = action.type === "MOVE" ? mon.moves[action.cardSlot] : undefined;

    if (!card?.effect?.protects) {
      // Fez outra coisa (ou trocou, ou hesitou) → a sequência zera. Sem isto,
      // daria pra alternar protect/ataque e a chance nunca cairia — que é
      // exatamente o que a chance decrescente existe pra impedir.
      conditionsOf(mon).protectStreak = 0;
      continue;
    }

    const c = conditionsOf(mon);
    const chance = protectChance(c.protectStreak);
    // O rng SÓ é tocado quando a chance não é 100 — a 1ª proteção da sequência
    // não sorteia nada. É o que mantém a suíte determinística (CLAUDE.md).
    const pegou = chance >= 100 || rng() * 100 < chance;

    c.protected = pegou;
    c.protectStreak = pegou ? c.protectStreak + 1 : 0;
    events.push({ type: "protect", userId: side.userId, monName: mon.name, held: pegou });
  }

  // 2) ATAQUES: só quem escolheu MOVE, na ordem do turno pelo ativo atual.
  const attackers = [state.sideA, state.sideB].filter((s) => actionOf[s.userId].type === "MOVE");

  const cardSlotOf = (side: DuelSide): number => {
    const a = actionOf[side.userId];
    return a.type === "MOVE" ? a.cardSlot : 0;
  };

  let ordered: DuelSide[] = attackers;
  if (attackers.length === 2) {
    const [x, y] = attackers;
    const inX: OrderInput = { userId: x.userId, mon: activeOf(x), cardSlot: cardSlotOf(x) };
    const inY: OrderInput = { userId: y.userId, mon: activeOf(y), cardSlot: cardSlotOf(y) };
    const [first] = orderForTurn(inX, inY, rng);
    ordered = first.userId === x.userId ? [x, y] : [y, x];
  }

  if (ordered.length > 0) {
    events.push({ type: "roundStart", round: state.round, firstUserId: ordered[0].userId });
  }

  for (const side of ordered) {
    const foe = side === state.sideA ? state.sideB : state.sideA;
    executeAttack(
      {
        attacker: activeOf(side),
        defender: activeOf(foe),
        attackerUserId: side.userId,
        defenderUserId: foe.userId,
        typeChart,
        rng,
        events,
        attackerSide: side,
      },
      cardSlotOf(side)
    );
  }

  // 3) FIM DO TURNO: queimadura, veneno e semente cobram a conta, e o recuo
  // (flinch) do turno é apagado. É o que impede a partida de virar uma troca de
  // golpes eterna — quem está com status tem pressa.
  applyEndOfTurn(state, events);

  const { finished, winnerId } = outcome(state);
  if (finished) return { state, events, winnerId, finished: true };

  // REGENERAÇÃO: só aqui, junto da virada do round. NÃO entra no
  // applyForcedSwitch nem no applyLeadLoadout — os dois acontecem DENTRO da
  // mesma rodada de jogo, e regenerar ali pagaria energia duas vezes por rodada
  // (é a mesma razão de o applyEndOfTurn não rodar naqueles dois).
  for (const side of [state.sideA, state.sideB]) {
    side.energy = regenEnergy(side.energy ?? ENERGY_START);
  }

  state.round += 1;
  return { state, events, winnerId: null, finished: false };
}

export interface ForcedSwitchParams {
  state: DuelState;
  /** slot escolhido por cada lado; null/inválido → auto-promove o 1º vivo. */
  choiceA: number | null;
  choiceB: number | null;
  /**
   * A barra de skills que cada lado montou pro substituto. Ausente quando o
   * tempo estourou e o motor auto-promoveu — aí o pokémon entra com a barra que
   * já tinha, e é por isso que o `equipOnEntry` não zera nada sem escolha.
   */
  movesA?: BattleMoveDef[];
  movesB?: BattleMoveDef[];
}

export interface LeadRoundParams {
  state: DuelState;
  movesA?: BattleMoveDef[];
  movesB?: BattleMoveDef[];
}

/**
 * Resolve o ROUND 0 (preparação): monta a barra do pokémon que abre a partida
 * pra cada lado e passa pro round 1.
 *
 * O líder é o único que entra em campo sem uma ação de troca — daí precisar de
 * um round só dele. Quem não escolheu a tempo entra com a barra que o snapshot
 * já trouxe, então ninguém começa a partida sem golpe.
 *
 * Não gera evento: um log de turno vazio no round 0 só poluiria o relatório de
 * combate, que conta o que ACONTECEU em campo.
 */
export function applyLeadLoadout(params: LeadRoundParams): DuelResult {
  const state = cloneState(params.state);

  equipOnEntry(activeOf(state.sideA), params.movesA);
  equipOnEntry(activeOf(state.sideB), params.movesB);

  state.round += 1;
  return { state, events: [], winnerId: null, finished: false };
}

/** Slot do substituto na troca forçada: a escolha (se válida) ou o 1º vivo. */
function forcedTarget(side: DuelSide, choice: number | null): number | null {
  if (choice != null) {
    const picked = side.team.find((m) => m.slot === choice);
    if (picked && !picked.fainted) return picked.slot;
  }
  const first = [...side.team].sort((a, b) => a.slot - b.slot).find((m) => !m.fainted);
  return first ? first.slot : null;
}

/**
 * Aplica a TROCA FORÇADA: para cada lado cujo ativo desmaiou (e ainda tem
 * reserva viva), coloca em campo o substituto escolhido — ou o 1º vivo, se a
 * escolha não veio (timeout) ou é inválida. Depois disso nenhum lado precisa
 * mais trocar, e o próximo round é normal.
 */
export function applyForcedSwitch(params: ForcedSwitchParams): DuelResult {
  const state = cloneState(params.state);
  const events: DuelEvent[] = [];

  for (const side of [state.sideA, state.sideB]) {
    if (!needsForcedSwitch(side)) continue;
    const ehA = side.userId === state.sideA.userId;
    const choice = ehA ? params.choiceA : params.choiceB;
    const target = forcedTarget(side, choice);
    if (target == null) continue; // sem reserva viva (não deveria: needsForcedSwitch garante)
    const from = activeOf(side);
    clearVolatiles(from); // quem sai de campo (aqui, desmaiado) larga estágios e voláteis
    side.activeSlot = target;
    const to = side.team.find((m) => m.slot === target)!;
    // A barra só é montada quando o SUBSTITUTO ESCOLHIDO é o que entrou. Se o
    // motor auto-promoveu outro (escolha inválida ou vencida), a barra escolhida
    // era pra outro pokémon e aplicá-la aqui poria golpe alheio na carta errada.
    if (choice === target) equipOnEntry(to, ehA ? params.movesA : params.movesB);
    events.push({ type: "switch", userId: side.userId, fromName: from.name, toName: to.name });
  }

  const { finished, winnerId } = outcome(state);
  if (finished) return { state, events, winnerId, finished: true };

  state.round += 1;
  return { state, events, winnerId: null, finished: false };
}
