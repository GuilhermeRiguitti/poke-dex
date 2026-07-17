"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import LoadoutBuilder from "./LoadoutBuilder";

// O rodapé do card da coleção: montar loadout (ou tirar do deck) e soltar.
//
// No jogo novo "pôr no deck" não é um toggle — é montar um loadout (1 pokémon +
// 6 cartas do learnset), então o botão abre o LoadoutBuilder. Tirar do deck e
// soltar seguem sendo escrita direta + refresh (quem lê é o servidor).

export default function CollectionCardActions({
  userPokemonId,
  name,
  deckSlotId,
  inDeck,
  canToggle,
}: {
  userPokemonId: string;
  name: string;
  /** id do DeckSlot, quando este pokémon está no deck */
  deckSlotId: string | null;
  inDeck: boolean;
  canToggle: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [building, setBuilding] = useState(false);

  const locked = busy || pending;

  const run = async (action: () => Promise<Response>) => {
    setBusy(true);
    try {
      const res = await action();
      if (res.ok) startTransition(() => router.refresh());
    } finally {
      setBusy(false);
    }
  };

  const removeFromDeck = () =>
    deckSlotId && run(() => fetch(`/api/deck/${deckSlotId}`, { method: "DELETE" }));
  const release = () => run(() => fetch(`/api/cards/${userPokemonId}`, { method: "DELETE" }));

  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => (inDeck ? removeFromDeck() : setBuilding(true))}
          disabled={locked || !canToggle}
          className={`clip-btn cursor-pointer border-0 px-2 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
            inDeck ? "bg-flare text-white hover:bg-flare-dark" : "bg-panel-2 text-ink-dim hover:text-ink"
          }`}
        >
          {inDeck ? "No deck ✓" : "Montar"}
        </button>
        <button
          onClick={release}
          disabled={locked}
          className="clip-btn cursor-pointer border-0 bg-panel-2 px-2 py-1.5 text-xs font-bold uppercase tracking-wide text-bad/80 transition-colors hover:text-bad disabled:opacity-40"
        >
          Soltar
        </button>
      </div>

      {building && (
        <LoadoutBuilder
          userPokemonId={userPokemonId}
          name={name}
          onClose={() => setBuilding(false)}
          onDone={() => {
            setBuilding(false);
            startTransition(() => router.refresh());
          }}
        />
      )}
    </>
  );
}
