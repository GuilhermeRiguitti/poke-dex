import Link from "next/link";
import { SwordsIcon } from "@/src/components/icons";
import type { DeckSlotView } from "./pokedexView";

// Server Component: as vagas do deck são só desenho. Quem MEXE no deck é o
// botão do card (CollectionCardActions), que é o cliente.

export default function DeckSlots({
  slots,
  deckCount,
  deckLimit,
}: {
  slots: DeckSlotView[];
  deckCount: number;
  deckLimit: number;
}) {
  return (
    <section className="clip-card mb-8 border border-edge bg-panel p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="plate border border-edge bg-panel-2 px-3 py-1">
          <span className="plate-inner flex items-center gap-2 font-title text-sm uppercase tracking-wider">
            <SwordsIcon size={15} className="text-flare" />
            Deck de batalha
            <span className="text-ink-dim">
              {deckCount}/{deckLimit}
            </span>
          </span>
        </h2>
        {deckCount > 0 && (
          <Link
            href="/battle"
            className="clip-btn bg-flare px-4 py-2 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-flare-dark"
          >
            Batalhar
          </Link>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {slots.map((slot, i) => (
          <div
            key={i}
            className={`clip-btn flex aspect-square flex-col items-center justify-center gap-1 border ${
              slot.pokemonId !== null ? "border-flare/50 bg-panel-2" : "border-dashed border-edge"
            }`}
          >
            {slot.pokemonId === null ? (
              <span className="font-title text-2xl text-edge">+</span>
            ) : (
              <>
                {slot.iconUrl && (
                  // eslint-disable-next-line @next/next/no-img-element -- sprite da PokéAPI
                  <img
                    src={slot.iconUrl}
                    alt={slot.name ?? ""}
                    className="h-14 w-14 object-contain"
                  />
                )}
                <span className="font-title text-[10px] uppercase tracking-wide">{slot.name}</span>
                <span className="lv-badge">
                  <span>Lv {slot.level}</span>
                </span>
              </>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
