import PokemonCard from "./PokemonCard";
import { dexNumber } from "./pokedexView";
import type { PokemonCardDTO } from "./types";

// Server Component. É o CATÁLOGO: view-only, pra consultar informação. O
// "Capturar" morreu — a única forma de obter pokémon é abrir pacote. Cada card
// leva ao detalhe (o Link mora no PokemonCard); o rodapé só marca o que o
// jogador já tem na coleção.

export default function PokedexGrid({
  pokemons,
  capturedIds,
}: {
  pokemons: PokemonCardDTO[];
  capturedIds: number[];
}) {
  const captured = new Set(capturedIds);

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {pokemons.map((pokemon, i) => (
        <PokemonCard
          key={pokemon.id}
          pokemonId={pokemon.id}
          dexNumber={dexNumber(pokemon.id)}
          name={pokemon.name}
          artworkUrl={pokemon.artworkUrl}
          types={pokemon.types}
          accentType={pokemon.types[0] ?? "normal"}
          index={i}
        >
          {captured.has(pokemon.id) ? (
            <span className="clip-btn flex items-center justify-center gap-1 bg-ok/15 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-ok">
              ✓ Na coleção
            </span>
          ) : (
            <span className="clip-btn flex items-center justify-center gap-1 bg-panel-2 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-ink-dim">
              Não obtido
            </span>
          )}
        </PokemonCard>
      ))}
    </div>
  );
}
