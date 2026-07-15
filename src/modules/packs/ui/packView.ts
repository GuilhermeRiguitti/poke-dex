// Lógica de apresentação de pacotes. PURA: mapeia DTO -> o que a tela desenha.
// Mora aqui e tem teste; o componente é só costura (CLAUDE.md, regra 4).
//
// ui/ só pode importar de ui/ e de tipos de domain/ — RarityTier é type de
// domain, então entra. Nada de Prisma/command aqui.
import type { RarityTier } from "../domain/rarity";
import type { PackStateDTO } from "./types";

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

/**
 * Milissegundos até o próximo pacote -> "23h 59m" / "45m 12s" / "08s".
 * Abaixo de 1h mostra minutos+segundos (contagem viva); acima, horas+minutos.
 * Nunca negativo — 0 ou menos vira "00s" (já pode abrir, mas quem chama decide).
 */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");

  if (h > 0) return `${h}h ${pad(m)}m`;
  if (m > 0) return `${m}m ${pad(s)}s`;
  return `${pad(s)}s`;
}

export interface PackStatusView {
  /** botão habilitado? */
  canOpen: boolean;
  /** texto principal do botão */
  buttonLabel: string;
  /** ms até o próximo pacote grátis, ou null se já pode / não há data */
  msUntilNext: number | null;
  extraPacks: number;
}

/**
 * O estado do "cofre" pronto pra tela, a partir do DTO e do relógio do cliente.
 * `now` é injetado pra teste. msUntilNext alimenta o cronômetro vivo do cliente.
 */
export function packStatusView(state: PackStateDTO, now = Date.now()): PackStatusView {
  const nextMs = state.nextFreePackAt ? new Date(state.nextFreePackAt).getTime() : null;
  const freeReady = nextMs === null || nextMs <= now;
  const canOpen = freeReady || state.extraPacks > 0;

  return {
    canOpen,
    buttonLabel: canOpen ? "Abrir pacote" : "Em espera",
    msUntilNext: freeReady ? null : nextMs! - now,
    extraPacks: state.extraPacks,
  };
}
