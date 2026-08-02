"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { typeColor } from "@/src/lib/typeColors";
import type { DeckSlotView } from "./deckBoardView";

// Uma vaga PREENCHIDA do deck, na trilha da direita: sprite + nome + Lv +
// tipos, e o X de remover. É o único ponto de escrita do deck dentro do
// DeckSlots — a coleção não mostra mais essa carta (buildCollectionWhere exclui
// quem já tem vaga), então tirar do deck só pode acontecer aqui.

export default function DeckSlotCard({ slot }: { slot: DeckSlotView }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

  const locked = busy || pending;
  const cor = typeColor(slot.accentType ?? "normal");

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
    <div
      className={`clip-btn flex min-h-14.5 items-center gap-2.5 p-2 transition-opacity ${
        locked ? "opacity-50" : ""
      }`}
      style={{
        background: `linear-gradient(90deg, color-mix(in srgb, ${cor} 16%, transparent), var(--color-panel-2) 62%)`,
        boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${cor} 40%, transparent)`,
      }}
    >
      <span
        className="clip-btn flex h-10 w-10 flex-none items-center justify-center"
        style={{ background: `color-mix(in srgb, ${cor} 16%, transparent)` }}
      >
        {slot.iconUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={slot.iconUrl}
            alt={slot.name ?? ""}
            className="h-full w-full object-contain"
          />
        )}
      </span>

      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate font-title text-sm uppercase tracking-wide">{slot.name}</span>
          <span className="lv-badge flex-none">
            <span>Lv {slot.level}</span>
          </span>
        </span>
        <span className="flex gap-1">
          {slot.types.map((t) => (
            <span
              key={t}
              className="clip-btn px-1.5 py-px font-title text-[9px] uppercase leading-relaxed tracking-wider text-bg"
              style={{ background: typeColor(t) }}
            >
              {t}
            </span>
          ))}
        </span>
      </span>

      <button
        onClick={remove}
        disabled={locked}
        aria-label={`Tirar ${slot.name ?? "carta"} do deck`}
        title="Tirar do deck"
        className="flex h-6 w-6 flex-none cursor-pointer items-center justify-center border-0 bg-panel-2 text-xs font-bold text-ink-dim transition-colors hover:bg-bad hover:text-white disabled:cursor-not-allowed"
      >
        ✕
      </button>
    </div>
  );
}
