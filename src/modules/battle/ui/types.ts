import type { NonVolatileAilment } from "../domain/conditions";
import type { MoveEffect, StageStat } from "../domain/moveEffect";
import type { LearnsetMoveDTO } from "@/src/modules/pokemon/ui/types";
import type { RarityTier } from "@/src/modules/pokemon/domain/rarity";

// Contrato de dados entre o servidor e a UI da batalha (duelo simultâneo).
//
// Espelho ESTREITO das linhas do Prisma: só entra aqui o que o jogador pode ver.
// A linha do banco carrega a carta que o oponente já escolheu pro round em
// aberto (BattleAction.cardSlot); nada deve ser serializado pro client sem
// passar pelo mapper (toBattleDTO) — nem por props de Server Component, nem por
// NextResponse.json.

export interface BattleMoveDTO {
  id: number;
  name: string;
  type: string;
  power: number | null;
  accuracy: number | null;
  damageClass: "physical" | "special" | "status";
  priority: number;
  maxPp: number;
  currentPp: number;
  /**
   * Quanta energia esta carta custa. Calculado no SERVIDOR (`energyCostOf`) e
   * não no browser: a tabela de faixas é a alavanca de balanceamento do jogo, e
   * mandá-la pro cliente significaria que todo ajuste dela precisa esperar o
   * cliente atualizar — além de expor o gabarito de graça. Mesma razão de a
   * raridade ir calculada em vez de o browser derivar do BST.
   */
  energyCost: number;
  /**
   * O que a carta faz além de bater. Vai INTEIRO pro cliente (é o efeito da
   * MINHA carta, que eu já poderia ler na PokéDex) porque é ele que transforma
   * "STA / sem dano" numa jogada compreensível: sem isso o jogador não tem como
   * saber que aquela carta paralisa. Quem traduz em texto é `moveEffectLabel`,
   * no battleView — regra de apresentação não mora no componente.
   */
  effect: MoveEffect | null;
}

/**
 * O estado alterado de um combatente, como a tela mostra. É informação PÚBLICA
 * de propósito — nos jogos da série você vê que o oponente está queimado e que
 * ele subiu o Ataque; sem isso não dá pra jogar contra status. O que NÃO sai
 * daqui é a contagem de turnos do sono, que é escondida também na série (e
 * entregar viraria "espero exatamente 2 turnos").
 */
export interface MonConditionsDTO {
  status: NonVolatileAilment | null;
  confused: boolean;
  seeded: boolean;
  /** só os estágios DIFERENTES de zero, pra tela não desenhar sete zeros. */
  stages: { stat: StageStat; stage: number }[];
}

export interface BattlePokemonDTO {
  id: string;
  slot: number;
  pokemonId: number;
  name: string;
  spriteUrl: string | null;
  types: string[];
  level: number;
  maxHp: number;
  currentHp: number;
  fainted: boolean;
  moves: BattleMoveDTO[];
  conditions: MonConditionsDTO;
  /**
   * Faixa de raridade pela fortitude (BST) — pinta o metal da moldura.
   * Calculada NO SERVIDOR de propósito: `bstOf` carrega a tabela dos 1025 BSTs,
   * e a arena é código de cliente — mandar essa tabela pro browser só pra
   * escolher uma cor seria peso à toa.
   */
  rarity: RarityTier;
}

export interface ParticipantDTO {
  id: string;
  userId: string;
  activeSlot: number;
  pokemons: BattlePokemonDTO[];
  /**
   * Energia do lado. É PÚBLICA (os dois lados), pelo mesmo motivo do HP e do
   * status: sem ver o recurso do oponente não dá pra ler a ameaça — "ele tem 3,
   * então o golpe grande vem agora" é exatamente a leitura que a mecânica
   * existe pra criar. O que continua segredo é a CARTA escolhida (`cardSlot`),
   * que é outra coisa.
   */
  energy: number;
  /** Teto do acúmulo, pra a barra saber o tamanho dela. */
  energyMax: number;
  /** Deu sinal de vida dentro da janela de presença? */
  present: boolean;
  /**
   * Quanto falta pra ele perder por ausência, em ms. RELATIVO, nunca o
   * `lastSeenAt` cru — mesma razão do `turnEndsInMs`: o relógio do browser não é
   * confiável, e uma máquina atrasada faria a tela mentir sobre o prazo.
   * `null` quando está presente (não há contagem a mostrar).
   */
  absentForMs: number | null;
}

// Eventos do turno do duelo (renderização + BattleTurnLog). Chaveados por
// userId, não por lado A/B — o que importa pra tela é quem agiu. Espelha
// DuelEvent (domain/duelTypes.ts).
export type BattleEventDTO =
  | {
      type: "attack";
      userId: string;
      cardName: string;
      damage: number;
      effectiveness: number;
      isCrit: boolean;
      missed: boolean;
      targetFainted: boolean;
      hits?: number;
    }
  | { type: "switch"; userId: string; fromName: string; toName: string }
  | { type: "hesitate"; userId: string }
  /** sumiu e não voltou (presence). Encerra a partida — ≠ hesitar. */
  | { type: "abandoned"; userId: string }
  | { type: "protect"; userId: string; monName: string; held: boolean }
  | { type: "roundStart"; round: number; firstUserId: string }
  | { type: "ailment"; targetUserId: string; monName: string; ailment: string; blocked?: "immune" | "already" }
  | { type: "stage"; targetUserId: string; monName: string; stat: string; delta: number; stage: number }
  | { type: "blocked"; targetUserId: string; monName: string; reason: string; selfDamage?: number }
  | { type: "recovered"; targetUserId: string; monName: string; ailment: string }
  | { type: "tick"; targetUserId: string; monName: string; source: string; hp: number; fainted?: boolean };

export interface TurnLogDTO {
  turnNumber: number;
  events: BattleEventDTO[];
}

export type BattleStatusDTO = "IN_PROGRESS" | "FINISHED" | "ABANDONED";

export interface BattleDTO {
  id: string;
  status: BattleStatusDTO;
  round: number;
  winnerId: string | null;
  /**
   * Quem já escolheu a carta do round atual. É o "oponente pronto" da tela —
   * e o limite exato do que pode ser dito sobre a jogada alheia antes do turno
   * resolver: QUEM, nunca O QUÊ (ver toBattleDTO).
   */
  submittedUserIds: string[];
  /**
   * Quanto resta do round, em ms, NO INSTANTE em que o servidor montou este DTO.
   *
   * Relativo, e não um `turnStartedAt`/deadline absoluto, de propósito: o
   * relógio do browser pode estar minutos fora do certo, e um countdown feito de
   * `deadline - Date.now()` herdaria esse erro inteiro — mostrando 4 minutos ou
   * já zerado enquanto o servidor conta outra coisa. Aqui as duas pontas da
   * subtração são do SERVIDOR; o cliente só precisa medir o quanto passou desde
   * que recebeu, e pra isso o relógio dele basta (o erro não se acumula porque
   * cada resposta traz o valor novo). 0 = o tempo já venceu e o round resolve no
   * próximo request.
   */
  turnEndsInMs: number;
  /** A janela cheia — a barra do countdown precisa do total pra ter escala. */
  turnTimeoutMs: number;
  participants: ParticipantDTO[];
  turnLogs: TurnLogDTO[];
}

/**
 * Uma carta candidata no seletor de skills (GET /api/battle/[id]/loadout): o
 * learnset do módulo `pokemon` MAIS o efeito já traduzido pela batalha.
 *
 * O efeito viaja junto porque escolher às cegas era o problema: a lista dizia
 * só "STATUS" e o jogador não tinha como saber que aquela carta paralisa, cura
 * ou dobra o Ataque. É a MINHA lista (a rota resolve o dono), então nada aqui
 * conta sobre o time do oponente.
 */
export interface LoadoutOptionDTO extends LearnsetMoveDTO {
  effect: MoveEffect | null;
}

// Deck como a tela da fila precisa dele (não é o deck inteiro do Prisma).
export interface QueueDeckDTO {
  id: string;
  name: string;
  slotCount: number;
}
