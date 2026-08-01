import PokeCard from "@/src/modules/pokedex/ui/PokeCard";
import { dexNumber } from "@/src/modules/pokedex/ui/pokedexView";
import type { PackCardDTO } from "./types";

// Uma carta revelada do pacote: a MESMA carta do resto do jogo, no tamanho
// grande (`full`), com o selo "Novo/Repetida" no rodapé.
//
// Este arquivo virou um adaptador fino — a moldura toda mora no PokeCard. O que
// sobra aqui é só o que é do PACOTE: os fallbacks de espécie fora do espelho
// (o jogador GANHA a carta mesmo com erro de leitura, então nome/arte/stats
// podem faltar) e o selo de repetida.
//
// O `level` não é sempre 1: a forma evoluída nasce no nível em que seria
// alcançada (birthLevelForSpecies, no openPack). É esse nível que a carta
// mostra e por onde as barras são derivadas.

export default function PackRevealCard({ card, index }: { card: PackCardDTO; index: number }) {
  const dex = dexNumber(card.pokemonId);

  return (
    <div className="animate-pack-pop" style={{ animationDelay: `${index * 90}ms` }}>
      <PokeCard
        dexNumber={dex}
        name={card.card?.name ?? dex}
        artworkUrl={card.card?.artworkUrl ?? null}
        types={card.card?.types ?? []}
        rarity={card.rarity}
        size="full"
        index={index}
        details={{ level: card.level, baseStats: card.baseStats ?? undefined }}
      >
        {card.isNew ? (
          <span className="clip-btn bg-flare px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
            Novo
          </span>
        ) : (
          <span className="clip-btn bg-black/40 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white/55">
            Repetida
          </span>
        )}
      </PokeCard>
    </div>
  );
}
