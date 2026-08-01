import type { PokemonCardDTO } from "@/src/modules/pokedex";
import type { BaseStats } from "@/src/modules/progression/domain/leveling";
import { bstOf, rarityTier } from "../domain/rarity";
import type { PackCardDTO } from "../ui/types";

/**
 * Uma carta sorteada → DTO pronto pra tela.
 *
 * O visual (`card`) já vem montado do espelho local (Pokemon.name/spriteUrl/
 * types) — packs não bate mais na PokéAPI (a coleção é UserPokemon, e o espelho
 * tem tudo que a carta desenha). bst/rarity vêm do domain, campo a campo.
 *
 * `baseStats` também sai do espelho: a carta desenha as 6 barras de stat, e sem
 * ele a do pacote seria a única sem elas.
 */
export function toPackCardDTO(
  pokemonId: number,
  card: PokemonCardDTO | null,
  baseStats: BaseStats | null,
  level: number,
  isNew: boolean
): PackCardDTO {
  const bst = bstOf(pokemonId);
  return {
    pokemonId,
    card,
    bst,
    rarity: rarityTier(bst),
    baseStats,
    level,
    isNew,
  };
}
