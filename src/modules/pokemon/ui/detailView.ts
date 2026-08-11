// A ficha da espécie como a página de detalhe desenha. PURA: mapear DTO -> o
// que a tela mostra é função pura, mora aqui e tem teste (CLAUDE.md, regra 4).
// Componente é costura.

import type { PokemonDetailDTO } from "./types";
import { dexNumber } from "./pokeCardView";

const STAT_LABELS: Record<string, string> = {
  hp: "HP",
  attack: "Ataque",
  defense: "Defesa",
  "special-attack": "At. Especial",
  "special-defense": "Def. Especial",
  speed: "Velocidade",
};

/** Teto das barras de stat. 255 é o maior base stat do jogo (Blissey, HP). */
const STAT_MAX = 255;

export interface StatBarView {
  key: string;
  label: string;
  value: number;
  max: number;
}

export interface DetailView {
  name: string;
  dexNumber: string;
  artworkUrl: string | null;
  types: string[];
  /** tipo que pinta a moldura (--type-c) e a placa do nome */
  accentType: string;
  statBars: StatBarView[];
  /** a PokéAPI dá decímetros e hectogramas; a tela mostra m e kg */
  heightMeters: string;
  weightKg: string;
  /** nomes de move vêm com hífen ("thunder-punch") */
  moveNames: string[];
  totalMoves: number;
}

export function detailView(pokemon: PokemonDetailDTO): DetailView {
  return {
    name: pokemon.name,
    dexNumber: dexNumber(pokemon.id),
    artworkUrl: pokemon.artworkUrl,
    types: pokemon.types,
    accentType: pokemon.types[0] ?? "normal",
    statBars: pokemon.stats.map((s) => ({
      key: s.name,
      label: STAT_LABELS[s.name] ?? s.name,
      value: s.value,
      max: STAT_MAX,
    })),
    heightMeters: (pokemon.height / 10).toFixed(1),
    weightKg: (pokemon.weight / 10).toFixed(1),
    moveNames: pokemon.moves.map((m) => m.replace(/-/g, " ")),
    totalMoves: pokemon.totalMoves,
  };
}
