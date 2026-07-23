"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CARDS_PER_SLOT } from "@/src/modules/deck/domain/rules";
import type { LearnsetMoveDTO } from "@/src/modules/deck/ui/types";
import { typeColor } from "@/src/lib/typeColors";

// Modal de montar loadout: busca o learnset da espécie e deixa escolher até 6
// cartas (CARDS_PER_SLOT). É o coração do jogo novo — o deck deixou de ser "só
// escolher o pokémon" e passou a ser "escolher as skills dele".
//
// O learnset vem travado por NÍVEL (readLearnset): o que o pokémon ainda não
// aprendeu aparece na lista, com o nível exigido, mas não é selecionável. Ver
// o travado é metade da progressão — é o que dá motivo pra subir de nível.
// A trava de verdade é do servidor (addToDeck); aqui é conveniência.
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
        // Pré-seleciona as mais fortes JÁ DESTRAVADAS — pré-selecionar uma
        // travada faria o Salvar cair no 400 do servidor sem o jogador
        // entender por quê.
        setSelected(
          data.moves
            .filter((m) => m.unlocked)
            .sort((a, b) => (b.power ?? -1) - (a.power ?? -1))
            .slice(0, CARDS_PER_SLOT)
            .map((m) => m.moveId)
        );
      })
      .catch(() => alive && setError("Não foi possível carregar as cartas."));
    return () => {
      alive = false;
    };
  }, [userPokemonId]);

  // Trava o scroll do fundo enquanto o modal está aberto.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

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

  // Portal pro <body>: o card-frame fica com um transform residual do
  // animate-rise (fill both), e transform faz o ancestral virar containing
  // block de `fixed` — sem o portal, o "modal" renderiza DENTRO do card,
  // recortado pelo overflow/clip-path dele.
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="clip-card flex max-h-[85vh] w-full max-w-xl flex-col border border-edge bg-panel p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-title text-lg uppercase tracking-wide">
            Montar <span className="text-flare">{name}</span>
          </h2>
          <span
            className={`font-title text-sm tracking-wide ${
              selected.length === CARDS_PER_SLOT ? "text-ok" : "text-ink-dim"
            }`}
          >
            {selected.length}/{CARDS_PER_SLOT} cartas
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
            <ul className="grid grid-cols-2 gap-2">
              {moves.map((m) => {
                // A posição na seleção É a posição na barra da batalha — o
                // badge numerado mostra isso, não é só "check".
                const pos = selected.indexOf(m.moveId);
                const on = pos !== -1;
                const capped = !on && selected.length >= CARDS_PER_SLOT;
                return (
                  <li key={m.moveId}>
                    <button
                      onClick={() => toggle(m.moveId)}
                      disabled={capped || !m.unlocked}
                      title={m.unlocked ? undefined : `Aprende no nível ${m.levelLearnedAt}`}
                      style={{ borderLeftColor: typeColor(m.type) }}
                      className={`clip-btn relative flex w-full cursor-pointer flex-col items-start gap-0.5 border-l-4 px-3 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${
                        on ? "bg-flare/15 hover:bg-flare/25" : "bg-panel-2 hover:bg-panel"
                      }`}
                    >
                      {on && (
                        <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center bg-flare font-title text-[10px] text-white">
                          {pos + 1}
                        </span>
                      )}
                      <span className="w-full truncate pr-5 text-sm font-semibold capitalize">
                        {m.name.replace(/-/g, " ")}
                      </span>
                      <span className="flex w-full items-center justify-between text-xs text-ink-dim">
                        <span className="uppercase" style={{ color: typeColor(m.type) }}>{m.type}</span>
                        <span className="font-bold">
                          {m.unlocked ? (m.power ? `${m.power}pw` : m.damageClass) : `🔒 nv ${m.levelLearnedAt}`}
                        </span>
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
    </div>,
    document.body,
  );
}
