"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import LoadoutBuilder from "./LoadoutBuilder";

// O rodapé do card da coleção: montar loadout, ou tirar do deck.
//
// No jogo novo "pôr no deck" não é um toggle — é montar um loadout (1 pokémon +
// 6 cartas do learnset), então o botão abre o LoadoutBuilder. Tirar do deck é
// escrita direta + refresh (quem lê é o servidor).
//
// O "Soltar" (DELETE /api/cards/[id]) foi TIRADO da carta. A rota e o command
// `removeCard` continuam existindo, só não têm mais gatilho na UI.

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

  return (
    <>
      <button
        onClick={() => (inDeck ? removeFromDeck() : setBuilding(true))}
        disabled={locked || !canToggle}
        className={`clip-btn cursor-pointer border-0 px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
          inDeck ? "bg-flare text-white hover:bg-flare-dark" : "bg-panel-2 text-ink-dim hover:text-ink"
        }`}
      >
        {inDeck ? "No deck ✓" : "Montar"}
      </button>

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
