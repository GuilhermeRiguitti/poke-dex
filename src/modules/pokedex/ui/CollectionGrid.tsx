import PokeCard from "@/src/modules/pokedex/ui/PokeCard";
import CollectionCardActions from "./CollectionCardActions";
import type { CollectionCardView } from "./pokedexView";

// Server Component. É a MESMA carta do catálogo, com duas diferenças: aqui os
// dados vêm do nosso banco, então ela leva Lv e as 6 barras de stat (derivadas
// pelo nível deste pokémon lá no pokedexView); e o rodapé são os botões de deck.

export default function CollectionGrid({ cards }: { cards: CollectionCardView[] }) {
  return (
    // No máximo 4 por fileira: a carta é 260px, e passar disso espremeria a
    // moldura abaixo do tamanho em que o texto do handoff é legível.
    <div className="grid grid-cols-1 justify-items-center gap-5 min-[580px]:grid-cols-2 min-[860px]:grid-cols-3 min-[1140px]:grid-cols-4">
      {cards.map((card, i) => (
        <PokeCard
          key={card.userPokemonId}
          dexNumber={card.dexNumber}
          name={card.name}
          artworkUrl={card.artworkUrl}
          types={card.types}
          rarity={card.rarity}
          size="grid"
          index={i}
          highlighted={card.inDeck}
          details={{ level: card.level, baseStats: card.baseStats }}
        >
          <CollectionCardActions
            userPokemonId={card.userPokemonId}
            name={card.name}
            deckSlotId={card.deckSlotId}
            inDeck={card.inDeck}
            canToggle={card.canToggle}
          />
        </PokeCard>
      ))}
    </div>
  );
}
