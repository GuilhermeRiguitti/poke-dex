// Regra de apresentação da carta. PURA: sem React, sem Prisma, sem fetch —
// mapear "dado do banco" -> "o que a moldura desenha" é função pura, mora aqui
// e tem teste (CLAUDE.md, regra 4). O componente é só costura.
//
// Importa de domain/ DIRETO, nunca do barrel do módulo: o barrel é a API de
// servidor e reexporta queries/commands, que importam Prisma — e isto aqui vai
// pro bundle do browser.

import type { RarityTier } from "@/src/modules/packs/domain/rarity";
import { deriveStats, type BaseStats } from "@/src/modules/progression/domain/leveling";

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

/** Os três tamanhos da mesma carta. A geometria toda sai de --card-w. */
export type PokeCardSize = "full" | "grid" | "mini";

export const CARD_WIDTH: Record<PokeCardSize, number> = {
  full: 340, // a proporção original do handoff — o pacote
  // 260 pra caber 4 por fileira num container de ~1150px (4×260 + 3×20 de gap
  // = 1100). Era 210 e sobrava espaço à direita — e a 210 o texto do handoff,
  // que é calibrado pra 340, ficava pequeno demais pra ler.
  grid: 260, // coleção e catálogo
  mini: 96, // vaga do deck e reserva na batalha
};

/** Teto do PREENCHIMENTO da barra. O número mostrado NÃO é travado. */
export const STAT_MAX_PCT = 100;

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
