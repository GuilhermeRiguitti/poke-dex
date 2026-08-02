"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import LoadoutBuilder from "./LoadoutBuilder";

// O rodapé do card da coleção: montar loadout.
//
// "Pôr no deck" não é um toggle — é montar um loadout (1 pokémon + 6 cartas do
// learnset), então o botão só abre o LoadoutBuilder. Tirar do deck não mora
// mais aqui: buildCollectionWhere já exclui da coleção quem está numa vaga do
// deck (deckSlots: { none: {} }), então esta carta nunca está "no deck" — quem
// tira é o botão dentro do próprio DeckSlots.
//
// O "Soltar" (DELETE /api/cards/[id]) foi TIRADO da carta. A rota e o command
// `removeCard` continuam existindo, só não têm mais gatilho na UI.

export default function CollectionCardActions({
  userPokemonId,
  name,
}: {
  userPokemonId: string;
  name: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [building, setBuilding] = useState(false);

  return (
    <>
      <button
        onClick={() => setBuilding(true)}
        disabled={pending}
        className="clip-btn cursor-pointer border-0 bg-panel-2 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-ink-dim transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
      >
        Montar
      </button>

      {building && (
        <LoadoutBuilder
          userPokemonId={userPokemonId}
          name={name}
          onClose={() => setBuilding(false)}
          onDone={() => {
            setBuilding(false);
            // A carta some da coleção assim que entra no deck (o WHERE exclui
            // quem tem vaga) — por isso o refresh aqui não é só "atualizar o
            // deck", é reconsultar a própria listagem paginada.
            startTransition(() => router.refresh());
          }}
        />
      )}
    </>
  );
}
