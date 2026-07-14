import CollectionCardActions from "./CollectionCardActions";
import PokemonCard from "./PokemonCard";
import type { CollectionCardView } from "./pokedexView";

// Server Component. Mesmos cards da listagem da dex, outro rodapé.

export default function CollectionGrid({ cards }: { cards: CollectionCardView[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {cards.map((card, i) => (
        <PokemonCard
          key={card.userCardId}
          pokemonId={card.pokemonId}
          dexNumber={card.dexNumber}
          name={card.name}
          artworkUrl={card.artworkUrl}
          types={card.types}
          accentType={card.accentType}
          index={i}
          highlighted={card.inDeck}
        >
          <CollectionCardActions
            userCardId={card.userCardId}
            deckCardId={card.deckCardId}
            inDeck={card.inDeck}
            canToggle={card.canToggle}
          />
        </PokemonCard>
      ))}
    </div>
  );
}
