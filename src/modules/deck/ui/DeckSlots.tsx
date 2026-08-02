import Link from "next/link";
import { SwordsIcon } from "@/src/layout/icons";
import { CARD_WIDTH } from "@/src/modules/pokedex/ui/pokeCardView";
import DeckSlotCard from "./DeckSlotCard";
import type { DeckBoardView } from "./deckBoardView";

// Server Component: as vagas do deck são desenho + composição do card client
// (DeckSlotCard) que leva o X de remover. Montar um loadout continua vindo da
// coleção (CollectionCardActions); tirar do deck é só aqui.
//
// Cada vaga preenchida é a MESMA carta das outras telas, no tamanho `mini`:
// nele as barras, os tipos e o rodapé somem (viram ruído em 96px) e sobram
// moldura, arte e Lv. A vaga vazia repete a proporção da carta pra fileira não
// ficar desalinhada.

export default function DeckSlots({ deck }: { deck: DeckBoardView }) {
  const { slots, count, limit } = deck;

  return (
    <section className="clip-card mb-8 border border-edge bg-panel p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="plate border border-edge bg-panel-2 px-3 py-1">
          <span className="plate-inner flex items-center gap-2 font-title text-sm uppercase tracking-wider">
            <SwordsIcon size={15} className="text-flare" />
            Deck de batalha
            <span className="text-ink-dim">
              {count}/{limit}
            </span>
          </span>
        </h2>
        {count > 0 && (
          <Link
            href="/battle"
            className="clip-btn bg-flare px-4 py-2 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-flare-dark"
          >
            Batalhar
          </Link>
        )}
      </div>

      <div className="flex flex-wrap justify-center gap-3 sm:justify-start">
        {slots.map((slot, i) =>
          slot.pokemonId === null || slot.rarity === null ? (
            <div
              key={i}
              className="clip-card flex items-center justify-center border border-dashed border-edge"
              style={{
                width: CARD_WIDTH.mini,
                height: (CARD_WIDTH.mini * 500) / 340,
              }}
            >
              <span className="font-title text-2xl text-edge">+</span>
            </div>
          ) : (
            <DeckSlotCard key={i} slot={slot} index={i} />
          )
        )}
      </div>
    </section>
  );
}
