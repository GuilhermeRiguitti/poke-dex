import Link from "next/link";
import { SwordsIcon } from "@/src/layout/icons";
import DeckSlotCard from "./DeckSlotCard";
import type { DeckBoardView } from "./deckBoardView";

// Server Component: a TRILHA DA DIREITA do workspace da coleção. Montar um
// loadout continua vindo da coleção (CollectionCardActions); tirar do deck é só
// aqui, no X de cada linha (DeckSlotCard, client).
//
// As vagas deixaram de ser cartas mini lado a lado e viraram LINHAS empilhadas:
// na coluna estreita a carta de 96px não cabia em fileira, e a linha mostra o
// que decide o time (nome, nível e tipos) em texto legível, sem depender da
// moldura. A carta inteira continua sendo a da coleção, ao lado.
//
// Não há botão de "limpar deck": não existe command pra isso — o único caminho
// de saída é o DELETE de uma vaga por vez.

export default function DeckSlots({ deck }: { deck: DeckBoardView }) {
  const { slots, count, limit, full, battleLabel } = deck;

  return (
    <aside className="flex flex-col border-t border-edge bg-panel/60 xl:min-h-0 xl:border-l xl:border-t-0">
      <div className="flex-none border-b border-edge bg-panel-2/50 p-3.5">
        <div className="flex items-baseline gap-2">
          <h2 className="flex items-center gap-2 font-title text-base uppercase tracking-wider">
            <SwordsIcon size={15} className="text-flare" />
            Deck de batalha
          </h2>
          <span className="ml-auto font-title text-base text-flare">
            {count}
            <span className="text-ink-dim">/{limit}</span>
          </span>
        </div>

        {/* uma marca por vaga: dá o "quanto falta" antes de ler a lista */}
        <div className="mt-2.5 flex gap-1">
          {slots.map((_, i) => (
            <span
              key={i}
              className={`h-1 flex-1 ${i < count ? "bg-flare" : "bg-edge"}`}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5 p-3 xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
        {slots.map((slot, i) =>
          slot.id === null ? (
            <div
              key={i}
              className="clip-btn flex min-h-14.5 items-center gap-2.5 border border-dashed border-edge px-2.5 text-ink-dim/60"
            >
              <span className="flex h-10 w-10 flex-none items-center justify-center border border-edge font-title text-base">
                {i + 1}
              </span>
              <span className="font-title text-xs uppercase tracking-widest">Slot vazio</span>
            </div>
          ) : (
            <DeckSlotCard key={slot.id} slot={slot} />
          )
        )}
      </div>

      <div className="flex-none border-t border-edge bg-panel-2/50 p-3.5">
        {count > 0 ? (
          <Link
            href="/battle"
            className={`clip-btn block bg-flare px-4 py-3 text-center font-title text-sm uppercase tracking-wider text-white transition-colors hover:bg-flare-dark ${
              full ? "animate-playable-pulse" : ""
            }`}
          >
            {battleLabel}
          </Link>
        ) : (
          <span className="clip-btn block cursor-not-allowed border border-edge px-4 py-3 text-center font-title text-sm uppercase tracking-wider text-ink-dim opacity-50">
            {battleLabel}
          </span>
        )}
      </div>
    </aside>
  );
}
