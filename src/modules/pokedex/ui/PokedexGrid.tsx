import Link from "next/link";
import PokeCard from "@/src/modules/pokedex/ui/PokeCard";
import { bstOf, rarityTier } from "@/src/modules/packs/domain/rarity";
import { dexNumber } from "./pokedexView";
import type { PokemonCardDTO } from "../types";

// Server Component. É o CATÁLOGO: view-only, pra consultar informação. O
// "Capturar" morreu — a única forma de obter pokémon é abrir pacote. Cada card
// leva ao detalhe; o rodapé só marca o que o jogador já tem na coleção.
//
// `details={false}` — é ESTA tela que motiva a flag. Aqui os dados vêm da
// PokéAPI ao vivo (listPokedexPage) e o PokemonCardDTO é uma whitelist de 5
// campos, sem stat nenhum. Sem details a carta não mostra Lv nem barras, e a
// janela de arte cresce pra ocupar o espaço delas — por isso a rota do catálogo
// não precisou mudar.

export default function PokedexGrid({
  pokemons,
  capturedIds,
}: {
  pokemons: PokemonCardDTO[];
  capturedIds: number[];
}) {
  const captured = new Set(capturedIds);

  return (
    // No máximo 4 por fileira — mesma régua da coleção (ver CollectionGrid).
    <div className="grid grid-cols-1 justify-items-center gap-5 min-[580px]:grid-cols-2 min-[860px]:grid-cols-3 min-[1140px]:grid-cols-4">
      {pokemons.map((pokemon, i) => (
        <Link key={pokemon.id} href={`/pokemon/${pokemon.id}`}>
          <PokeCard
            dexNumber={dexNumber(pokemon.id)}
            name={pokemon.name}
            artworkUrl={pokemon.artworkUrl}
            types={pokemon.types}
            rarity={rarityTier(bstOf(pokemon.id))}
            size="grid"
            index={i}
            details={false}
          >
            {captured.has(pokemon.id) ? (
              <span className="clip-btn bg-ok/25 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-ok">
                ✓ Na coleção
              </span>
            ) : (
              <span className="clip-btn bg-black/30 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white/45">
                Não obtido
              </span>
            )}
          </PokeCard>
        </Link>
      ))}
    </div>
  );
}
