// Como a RARIDADE é desenhada: rótulo, cor, brilho. PURA — mapear dado -> o
// que a tela mostra é função pura, mora aqui e tem teste (CLAUDE.md, regra 4).
//
// Mora no `pokemon` e não no `packs` porque a raridade é fato da ESPÉCIE, e
// quem desenha ela é a CARTA — que aparece na coleção, no catálogo, no deck e
// na batalha, não só no pacote. Ficando no packs, a carta do pokémon teria que
// importar do packs, e a seta entre os módulos apontaria pros dois lados.
//
// Importa o TIPO de domain/ por caminho relativo: isto vai pro bundle do
// browser, e o index.ts do módulo reexporta queries/commands (Prisma).

import type { RarityTier } from "../domain/rarity";

const RARITY_LABEL: Record<RarityTier, string> = {
  common: "Comum",
  uncommon: "Incomum",
  rare: "Raro",
  legendary: "Lendário",
};

// Rampa de cor ascendente com os tokens do design system (globals.css):
// cinza -> verde -> ciano -> dourado. O dourado (gold) é o "raridade" do tema.
const RARITY_COLOR: Record<RarityTier, string> = {
  common: "var(--color-ink-dim)",
  uncommon: "var(--color-ok)",
  rare: "var(--color-energy)",
  legendary: "var(--color-gold)",
};

export function rarityLabel(tier: RarityTier): string {
  return RARITY_LABEL[tier];
}

export function rarityColor(tier: RarityTier): string {
  return RARITY_COLOR[tier];
}

/** Só o lendário ganha brilho/aura extra na carta. */
export function isTopRarity(tier: RarityTier): boolean {
  return tier === "legendary";
}

// Força do holográfico (0..1) pela MESMA fortitude que define a raridade: quanto
// mais forte o pokémon, mais metálico/vivo o brilho. É o que liga "raridade da
// carta" ao efeito 3D, tanto no pacote quanto na coleção.
const RARITY_HOLO: Record<RarityTier, number> = {
  common: 0.32,
  uncommon: 0.55,
  rare: 0.78,
  legendary: 1,
};

/** Intensidade do holo (0..1) pra passar ao HoloCard. */
export function holoIntensity(tier: RarityTier): number {
  return RARITY_HOLO[tier];
}
