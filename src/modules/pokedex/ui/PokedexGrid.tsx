import CaptureButton from "./CaptureButton";
import PokemonCard from "./PokemonCard";
import { dexNumber } from "./pokedexView";
import type { PokemonCardDTO } from "./types";

// Server Component. Os cards são servidor; só o botão de capturar (que tem
// clique) é cliente.

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
          <CaptureButton pokemonId={pokemon.id} captured={captured.has(pokemon.id)} />
        </PokemonCard>
      ))}
    </div>
  );
}
