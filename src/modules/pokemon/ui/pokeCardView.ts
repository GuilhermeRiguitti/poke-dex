// Regra de apresentação da carta. PURA: sem React, sem Prisma, sem fetch —
// mapear "dado do banco" -> "o que a moldura desenha" é função pura, mora aqui
// e tem teste (CLAUDE.md, regra 4). O componente é só costura.
//
// Importa de domain/ DIRETO, nunca do barrel do módulo: o barrel é a API de
// servidor e reexporta queries/commands, que importam Prisma — e isto aqui vai
// pro bundle do browser.

import type { RarityTier } from "../domain/rarity";
import { deriveStats, type BaseStats } from "../domain/leveling";

/** O número da dex como o card mostra: 25 -> "#0025". */
export function dexNumber(pokemonId: number): string {
  return `#${String(pokemonId).padStart(4, "0")}`;
}

/** O metal da moldura. Cada faixa de raridade tem o seu. */
export type CardMetal = "bronze" | "silver" | "rose" | "gold";

const RARITY_METAL: Record<RarityTier, CardMetal> = {
  common: "bronze",
  uncommon: "silver",
  rare: "rose",
  legendary: "gold",
};

export function cardMetal(tier: RarityTier): CardMetal {
  return RARITY_METAL[tier];
}

/** Os tamanhos da mesma carta. A geometria toda sai de --card-w. */
export type PokeCardSize = "full" | "grid" | "duel" | "mini";

export const CARD_WIDTH: Record<PokeCardSize, number> = {
  full: 340, // a proporção original do handoff — o pacote
  // 260 pra caber 4 por fileira num container de ~1150px (4×260 + 3×20 de gap
  // = 1100). Era 210 e sobrava espaço à direita — e a 210 o texto do handoff,
  // que é calibrado pra 340, ficava pequeno demais pra ler.
  grid: 260, // coleção e catálogo
  // O trilho de reservas da arena, e é a carta COM os 6 atributos — é pra isso
  // que ela é empilhada: a pilha devolve a altura que 5 cartas inteiras
  // tomariam, e é essa altura que paga uma carta larga o bastante pra os
  // atributos existirem.
  //
  // 180 sai da conta da pilha HORIZONTAL (ver RESERVE_VISIBLE): 5 reservas
  // ocupam `180 × (1 + 4 × 0,4) = 468px` de largura e 265 de altura — o que
  // cabe na faixa livre da direita, ACIMA do console (a faixa do console é
  // intocável, é ela que decide o round).
  duel: 180,
  mini: 96, // vaga do deck
};

/** A proporção da carta: a altura sai da largura, em toda tela. */
export const CARD_RATIO = 500 / 340;

/**
 * Quanto de LARGURA de cada carta da pilha fica à mostra (a seguinte cobre o
 * resto). A pilha é horizontal, então a fatia visível é a coluna da ESQUERDA da
 * carta: começo do nome, o medidor de vida e uma lasca da arte.
 *
 * 0,4 é o meio termo: menos e a fatia não identifica o pokémon, mais e as cinco
 * reservas passam da faixa livre da direita.
 *
 * Mora aqui junto de `CARD_WIDTH` porque os dois se equilibram: a largura da
 * pilha é `W × (1 + 4 × isto)`, então subir um obriga a baixar o outro.
 */
export const RESERVE_VISIBLE = 0.4;

/** Altura da carta do trilho, em px. */
export function duelCardHeightPx(): number {
  return Math.round(CARD_WIDTH.duel * CARD_RATIO);
}

/** A FATIA à mostra de cada carta empilhada — largura, em px. */
export function reserveSliverPx(): number {
  return Math.round(CARD_WIDTH.duel * RESERVE_VISIBLE);
}

/**
 * O que a carta seguinte esconde da anterior, em px — a margem negativa da
 * pilha. Em PX e não em %: percentual aqui é fácil de errar, e o número tem que
 * bater exatamente com a largura da carta.
 */
export function reserveHiddenPx(): number {
  return CARD_WIDTH.duel - reserveSliverPx();
}

/**
 * Onde o medidor de vida entra na carta do trilho: logo ABAIXO do fio que fecha
 * o cabeçalho (16u de padding + ~26u de cabeçalho + 8u do fio ≈ 54u).
 *
 * Dentro da fatia à mostra, e não na borda, de propósito: encostado na borda
 * ele parecia pertencer à carta vizinha, não a esta.
 */
export function reserveHpTopPx(): number {
  return Math.round((CARD_WIDTH.duel / 340) * 54);
}

/** Teto do PREENCHIMENTO da barra. O número mostrado NÃO é travado. */
const STAT_MAX_PCT = 100;

export interface CardStatBar {
  key: string;
  /** rótulo curto, como cabe na carta */
  label: string;
  /** o stat DERIVADO no nível atual — o número que a engine de dano usa */
  value: number;
  /** 0..100 — vem do BASE stat da espécie, não do derivado. Ver statBars. */
  pct: number;
}

// Ordem fixa. `derived` casa com DerivedStats e `base` com BaseStats
// (os dois em leveling.ts) — os nomes diferem entre os dois tipos.
const STAT_ORDER = [
  { derived: "hp", base: "hp", label: "HP" },
  { derived: "attack", base: "atk", label: "ATK" },
  { derived: "defense", base: "def", label: "DEF" },
  { derived: "specialAttack", base: "spa", label: "AT.ESP" },
  { derived: "specialDefense", base: "spd", label: "DF.ESP" },
  { derived: "speed", base: "spe", label: "VEL" },
] as const;

/**
 * base stats + nível -> as 6 barras da carta. As duas metades respondem
 * perguntas diferentes de propósito:
 *
 *   NÚMERO = o stat DERIVADO no nível (deriveStats — a mesma fórmula da série
 *   que a engine de dano usa). Diz "quão forte ESTE pokémon está agora", então
 *   a carta não mente e o Lv significa alguma coisa.
 *
 *   BARRA = o base stat da ESPÉCIE, travado em 100%. Diz "esse é rápido, aquele
 *   é tanque" — o perfil, que não muda com o nível.
 *
 * Por que a barra NÃO é o derivado (já foi, e ficou ruim): no nível 1 os
 * derivados são 5..13 pra qualquer espécie, então toda carta recém-saída do
 * pacote nascia com os trilhos vazios e o bloco de stats parecia quebrado. Com
 * a base, a barra enche igual à do handoff em qualquer nível — e a conta é
 * literalmente a dele (`width: {valor}%`), só que aplicada ao número certo.
 */
export function statBars(base: BaseStats, level: number): CardStatBar[] {
  const derived = deriveStats(base, level);
  return STAT_ORDER.map((stat) => ({
    key: stat.derived,
    label: stat.label,
    value: derived[stat.derived],
    pct: Math.max(0, Math.min(STAT_MAX_PCT, base[stat.base])),
  }));
}
