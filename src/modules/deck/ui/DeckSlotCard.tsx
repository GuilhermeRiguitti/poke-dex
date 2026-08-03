"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { typeColor } from "@/src/lib/typeColors";
import type { DeckSlotView } from "./deckBoardView";

// Uma vaga PREENCHIDA do deck, na trilha da direita: alça de arrastar + sprite +
// nome + Lv + tipos, e o X de remover. É o único ponto de escrita do deck dentro
// do DeckSlots — a coleção não mostra mais essa carta (buildCollectionWhere
// exclui quem já tem vaga), então tirar do deck só pode acontecer aqui.
//
// Quem manda no arrastar é o DeckSlotList (ele conhece as vizinhas); aqui só
// mora a alça que dispara os eventos e o visual de "pegou".

interface Props {
  slot: DeckSlotView;
  /** posição no time, 0-based — a 0 é quem começa em campo */
  posicao: number;
  total: number;
  arrastando: boolean;
  onPegar: (e: React.PointerEvent) => void;
  onArrastar: (e: React.PointerEvent) => void;
  onSoltar: () => void;
  onTecla: (e: React.KeyboardEvent) => void;
}

export default function DeckSlotCard({
  slot,
  posicao,
  total,
  arrastando,
  onPegar,
  onArrastar,
  onSoltar,
  onTecla,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

  const locked = busy || pending;
  const cor = typeColor(slot.accentType ?? "normal");
  const emCampo = posicao === 0;

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

  // No MOUSE a carta inteira arrasta — pegar a linha pelo corpo é o gesto que a
  // pessoa tenta primeiro, e exigir mira num quadradinho de 40px fazia parecer
  // que a tela não arrastava. Menos o ✕: ali o gesto é clicar, não arrastar.
  const pegarPelaCarta = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return; // no toque, só pela alça (ver abaixo)
    if ((e.target as HTMLElement).closest("button")) return;
    onPegar(e);
  };

  return (
    <div
      onPointerDown={pegarPelaCarta}
      onPointerMove={onArrastar}
      onPointerUp={onSoltar}
      onPointerCancel={onSoltar}
      className={`clip-btn flex min-h-14.5 select-none items-center gap-2.5 p-2 transition-opacity ${
        locked ? "opacity-50" : ""
      } ${arrastando ? "cursor-grabbing shadow-lg" : "cursor-grab"}`}
      style={{
        background: `linear-gradient(90deg, color-mix(in srgb, ${cor} 16%, transparent), var(--color-panel-2) 62%)`,
        boxShadow: arrastando
          ? `inset 0 0 0 1px ${cor}, 0 8px 20px rgb(0 0 0 / 0.45)`
          : `inset 0 0 0 1px color-mix(in srgb, ${cor} 40%, transparent)`,
      }}
    >
      {/* A alça segue existindo pro TOQUE e pro teclado. No dedo ela não pode ser
          a carta toda: `touch-action: none` na linha inteira impediria rolar a
          página com o dedo em cima do deck. Aqui o alvo é pequeno de propósito. */}
      <span
        role="button"
        tabIndex={0}
        aria-label={`${slot.name}, posição ${posicao + 1} de ${total}. Arraste, ou use Alt com as setas, para mudar a ordem do time.`}
        title={emCampo ? "Começa em campo — arraste para mudar" : "Arraste para mudar a ordem"}
        // stopPropagation: sem isso o evento sobe pra carta, que também escuta,
        // e o arrasto começaria DUAS vezes — a segunda zerando a medida da
        // primeira.
        onPointerDown={(e) => {
          e.stopPropagation();
          onPegar(e);
        }}
        onPointerMove={(e) => {
          e.stopPropagation();
          onArrastar(e);
        }}
        onPointerUp={(e) => {
          e.stopPropagation();
          onSoltar();
        }}
        onPointerCancel={(e) => {
          e.stopPropagation();
          onSoltar();
        }}
        onKeyDown={onTecla}
        className="clip-btn flex h-10 w-10 flex-none cursor-grab touch-none select-none flex-col items-center justify-center gap-0.5 active:cursor-grabbing"
        style={{ background: `color-mix(in srgb, ${cor} 16%, transparent)` }}
      >
        <span className="font-title text-sm leading-none" style={{ color: emCampo ? cor : undefined }}>
          {posicao + 1}
        </span>
        <span className="text-[8px] leading-none text-ink-dim" aria-hidden>
          ⠿
        </span>
      </span>

      <span className="clip-btn flex h-10 w-10 flex-none items-center justify-center">
        {slot.iconUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={slot.iconUrl} alt={slot.name ?? ""} className="h-full w-full object-contain" />
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
