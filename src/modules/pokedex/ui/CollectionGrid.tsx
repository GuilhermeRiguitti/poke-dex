import PokeCard from "@/src/modules/pokedex/ui/PokeCard";
import CollectionCardActions from "./CollectionCardActions";
import type { CollectionCardView } from "./pokedexView";

// Server Component. É a MESMA carta do catálogo, com duas diferenças: aqui os
// dados vêm do nosso banco, então ela leva Lv e as 6 barras de stat (derivadas
// pelo nível deste pokémon lá no pokedexView); e o rodapé é o botão de montar.
//
// Toda carta aqui está DISPONÍVEL — quem já tem vaga no deck não aparece nesta
// lista (buildCollectionWhere exclui no banco). Por isso não há moldura
// destacada nem estado "no deck" pra desenhar.

export default function CollectionGrid({ cards }: { cards: CollectionCardView[] }) {
  return (
    // A coluna do meio do workspace muda de largura com a tela (as duas trilhas
    // são fixas), então a fileira se resolve sozinha: cabe quem couber em 260px,
    // que é a largura da carta — abaixo disso o texto do handoff fica ilegível.
    <div className="grid content-start justify-items-center gap-5 grid-cols-[repeat(auto-fill,minmax(260px,1fr))]">
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
          details={{ level: card.level, baseStats: card.baseStats }}
        >
          <CollectionCardActions userPokemonId={card.userPokemonId} name={card.name} />
        </PokeCard>
      ))}
    </div>
  );
}
