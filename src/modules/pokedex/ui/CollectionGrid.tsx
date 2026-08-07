import type { DeckCardDTO } from "@/src/modules/deck/ui/types";
import PokeCard from "@/src/modules/pokedex/ui/PokeCard";
import CollectionCardActions from "./CollectionCardActions";
import CollectionCardDrag from "./CollectionCardDrag";
import type { CollectionCardView } from "./pokedexView";

// Server Component. É a MESMA carta do catálogo, com duas diferenças: aqui os
// dados vêm do nosso banco, então ela leva Lv e as 6 barras de stat (derivadas
// pelo nível deste pokémon lá no pokedexView); e o rodapé é o botão de montar.
//
// A lista mostra TODA a coleção agora, inclusive quem já está no deck (antes o
// WHERE excluía). Quem está montado aparece esmaecido com a marca da vaga — a
// casca cliente é que sabe disso, comparando com o rascunho.

export default function CollectionGrid({ cards }: { cards: CollectionCardView[] }) {
  return (
    // A coluna do meio do workspace muda de largura com a tela (as duas trilhas
    // são fixas), então a fileira se resolve sozinha: cabe quem couber em 260px,
    // que é a largura da carta — abaixo disso o texto do handoff fica ilegível.
    <div className="grid content-start justify-items-center gap-5 grid-cols-[repeat(auto-fill,minmax(260px,1fr))]">
      {cards.map((card, i) => {
        // O que a VAGA do deck precisa pra se desenhar, montado aqui no
        // servidor e mandado junto com a carta. É o que permite soltar a carta
        // numa vaga e vê-la desenhada na hora, sem ida ao servidor — o
        // contrato está em deck/ui/types.ts (DeckCardDTO).
        const deckCard: DeckCardDTO = {
          userPokemonId: card.userPokemonId,
          pokemonId: card.pokemonId,
          name: card.name,
          iconUrl: card.iconUrl,
          level: card.level,
          types: card.types,
          rarity: card.rarity,
          baseStats: card.baseStats,
        };

        return (
          // A carta segue renderizada no SERVIDOR — o CollectionCardDrag só põe
          // uma casca cliente por volta pra ela poder ser arrastada até o deck.
          <CollectionCardDrag key={card.userPokemonId} card={deckCard}>
            <PokeCard
              dexNumber={card.dexNumber}
              name={card.name}
              artworkUrl={card.artworkUrl}
              types={card.types}
              rarity={card.rarity}
              size="grid"
              index={i}
              details={{ level: card.level, baseStats: card.baseStats }}
            >
              <CollectionCardActions card={deckCard} name={card.name} level={card.level} />
            </PokeCard>
          </CollectionCardDrag>
        );
      })}
    </div>
  );
}
