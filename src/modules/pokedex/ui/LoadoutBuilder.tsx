"use client";

import { useEffect, useState } from "react";
import { CARDS_PER_SLOT } from "@/src/modules/deck/domain/rules";
import type { LearnsetMoveDTO } from "@/src/modules/deck/ui/types";

// Modal de montar loadout: busca o learnset da espécie e deixa escolher até 6
// cartas (CARDS_PER_SLOT). É o coração do jogo novo — o deck deixou de ser "só
// escolher o pokémon" e passou a ser "escolher as 6 skills dele".
//
// Só dispara a escrita (POST /api/deck) e avisa a página (onDone → refresh);
// quem lê a coleção/deck é o servidor.

export default function LoadoutBuilder({
  userPokemonId,
  name,
  onClose,
  onDone,
}: {
  userPokemonId: string;
  name: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [moves, setMoves] = useState<LearnsetMoveDTO[] | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(`/api/deck/learnset/${userPokemonId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: { moves: LearnsetMoveDTO[] }) => {
        if (!alive) return;
        setMoves(data.moves);
        // Pré-seleciona as 6 primeiras (o readLearnset já ordena dano primeiro).
        setSelected(data.moves.slice(0, CARDS_PER_SLOT).map((m) => m.moveId));
      })
      .catch(() => alive && setError("Não foi possível carregar as cartas."));
    return () => {
      alive = false;
    };
  }, [userPokemonId]);

  const toggle = (moveId: string) => {
    setSelected((prev) => {
      if (prev.includes(moveId)) return prev.filter((id) => id !== moveId);
      if (prev.length >= CARDS_PER_SLOT) return prev; // teto de 6
      return [...prev, moveId];
    });
  };

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/deck", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userPokemonId, moveIds: selected }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error === "deck_full" ? "Seu deck já está cheio (6 loadouts)." : "Não foi possível salvar.");
        return;
      }
      onDone();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="clip-card flex max-h-[85vh] w-full max-w-lg flex-col border border-edge bg-panel p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-title text-lg uppercase tracking-wide">
            Montar <span className="text-flare">{name}</span>
          </h2>
          <span className="text-sm font-bold text-ink-dim">
            {selected.length}/{CARDS_PER_SLOT}
          </span>
        </div>

        {error && <p className="mb-3 text-sm font-semibold text-bad">{error}</p>}

        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          {moves === null ? (
            <p className="py-8 text-center text-sm font-semibold text-ink-dim">Carregando cartas...</p>
          ) : moves.length === 0 ? (
            <p className="py-8 text-center text-sm font-semibold text-ink-dim">
              Essa espécie não tem cartas no espelho.
            </p>
          ) : (
            <ul className="grid gap-1.5">
              {moves.map((m) => {
                const on = selected.includes(m.moveId);
                return (
                  <li key={m.moveId}>
                    <button
                      onClick={() => toggle(m.moveId)}
                      className={`flex w-full items-center justify-between gap-2 border px-3 py-2 text-left text-sm transition-colors ${
                        on ? "border-flare bg-flare/15" : "border-edge bg-panel-2 hover:border-ink-dim"
                      }`}
                      style={{ ["--type-c" as string]: `var(--type-${m.type})` }}
                    >
                      <span className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--type-c)" }} />
                        <span className="font-semibold capitalize">{m.name.replace(/-/g, " ")}</span>
                        <span className="text-xs uppercase text-ink-dim">{m.type}</span>
                      </span>
                      <span className="text-xs font-bold text-ink-dim">
                        {m.power ? `${m.power} pow` : m.damageClass}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            onClick={onClose}
            className="clip-btn cursor-pointer border border-edge bg-transparent py-2.5 text-sm font-bold uppercase tracking-wide text-ink-dim hover:text-ink"
          >
            Cancelar
          </button>
          <button
            onClick={save}
            disabled={saving || selected.length === 0}
            className="clip-btn cursor-pointer border-0 bg-flare py-2.5 text-sm font-bold uppercase tracking-wide text-white hover:bg-flare-dark disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? "Salvando..." : "Salvar loadout"}
          </button>
        </div>
      </div>
    </div>
  );
}
