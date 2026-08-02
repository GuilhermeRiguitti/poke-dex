"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import PokeCard from "@/src/modules/pokedex/ui/PokeCard";
import type { DeckSlotView } from "./deckBoardView";

// A carta de uma vaga PREENCHIDA do deck, com o X de remover. É o único ponto
// de escrita do deck dentro do DeckSlots — a coleção não mostra mais essa
// carta (buildCollectionWhere exclui quem já tem vaga), então tirar do deck só
// pode acontecer aqui.

export default function DeckSlotCard({ slot, index }: { slot: DeckSlotView; index: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

  const locked = busy || pending;

  const remove = async () => {
    if (!slot.id) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/deck/${slot.id}`, { method: "DELETE" });
      // A carta some do deck E reaparece na coleção com o mesmo refresh: as
      // duas listas vêm do mesmo WHERE (deckSlots: none), então precisam
      // recarregar juntas.
      if (res.ok) startTransition(() => router.refresh());
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative">
      <PokeCard
        dexNumber={slot.dexNumber ?? ""}
        name={slot.name ?? ""}
        artworkUrl={slot.iconUrl}
        types={slot.types}
        rarity={slot.rarity ?? "common"}
        size="mini"
        index={index}
        details={{ level: slot.level ?? 1, baseStats: slot.baseStats ?? undefined }}
      />
      <button
        onClick={remove}
        disabled={locked}
        aria-label={`Tirar ${slot.name ?? "carta"} do deck`}
        title="Tirar do deck"
        className="clip-btn absolute -right-1.5 -top-1.5 z-20 flex h-6 w-6 cursor-pointer items-center justify-center border-0 bg-bad text-xs font-bold text-white shadow-md transition-transform hover:scale-110 disabled:cursor-not-allowed disabled:opacity-50"
      >
        ✕
      </button>
    </div>
  );
}
