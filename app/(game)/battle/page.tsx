"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SwordsIcon } from "@/components/icons";

interface DeckCard {
  id: string;
  userCard: { pokemonId: number };
}

interface Deck {
  id: string;
  name: string;
  deckCards: DeckCard[];
}

export default function BattleQueuePage() {
  const router = useRouter();
  const [deck, setDeck] = useState<Deck | null>(null);
  const [loading, setLoading] = useState(true);
  const [queued, setQueued] = useState(false);
  const [error, setError] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetch("/api/deck")
      .then((res) => {
        if (res.status === 401) { router.push("/login"); return null; }
        return res.json();
      })
      .then((data) => { if (data) setDeck(data); })
      .finally(() => setLoading(false));
  }, [router]);

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const startPolling = () => {
    pollRef.current = setInterval(async () => {
      const res = await fetch("/api/battle/queue/status");
      if (!res.ok) return;
      const data = await res.json();
      if (data.matched && data.battleId) {
        if (pollRef.current) clearInterval(pollRef.current);
        router.push(`/battle/${data.battleId}`);
      }
    }, 2000);
  };

  const enterQueue = async () => {
    if (!deck) return;
    setError("");
    const res = await fetch("/api/battle/queue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deckId: deck.id }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error ?? "Erro ao entrar na fila"); return; }
    if (data.matched && data.battleId) { router.push(`/battle/${data.battleId}`); return; }
    setQueued(true);
    startPolling();
  };

  const leaveQueue = async () => {
    if (pollRef.current) clearInterval(pollRef.current);
    await fetch("/api/battle/queue", { method: "DELETE" });
    setQueued(false);
  };

  return (
    <div className="flex flex-col items-center pt-16 text-center">
      {/* emblema com radar quando na fila */}
      <div className="relative flex h-24 w-24 items-center justify-center">
        {queued && (
          <>
            <span className="animate-radar absolute inset-0 rounded-full border-2 border-flare" />
            <span
              className="animate-radar absolute inset-0 rounded-full border-2 border-flare"
              style={{ animationDelay: "0.5s" }}
            />
          </>
        )}
        <div className="plate flex h-20 w-20 items-center justify-center border border-edge bg-panel">
          <span className="plate-inner">
            <SwordsIcon size={38} className="text-flare" />
          </span>
        </div>
      </div>

      <h1 className="mt-5 font-title text-4xl uppercase tracking-wide">
        Arena de <span className="text-flare">Batalha</span>
      </h1>
      <p className="mt-2 max-w-md text-sm font-semibold text-ink-dim">
        Batalhas PvP por turnos contra outros treinadores, com seu deck de até 6 pokémons.
      </p>

      <div className="clip-card mt-8 w-full max-w-sm border border-edge bg-panel p-6">
        {loading && <p className="font-semibold text-ink-dim">Carregando seu deck...</p>}

        {!loading && deck && (
          <>
            <p className="text-sm font-semibold">
              <span className="text-ink-dim">Deck:</span>{" "}
              <span className="font-title tracking-wide">{deck.name}</span>{" "}
              <span className="text-ink-dim">— {deck.deckCards.length}/6 pokémons</span>
            </p>

            {deck.deckCards.length === 0 && (
              <p className="mt-3 text-sm font-semibold text-warn">
                Seu deck está vazio. Monte-o na{" "}
                <Link href="/pokedex" className="underline">
                  sua coleção
                </Link>{" "}
                antes de batalhar.
              </p>
            )}

            {error && <p className="mt-3 text-sm font-semibold text-bad">{error}</p>}

            {!queued ? (
              <button
                onClick={enterQueue}
                disabled={deck.deckCards.length === 0}
                className="clip-btn animate-playable-pulse mt-5 w-full cursor-pointer border-0 bg-flare py-3 font-title text-lg uppercase tracking-wider text-white transition-colors hover:bg-flare-dark disabled:animate-none disabled:opacity-40"
              >
                Procurar oponente
              </button>
            ) : (
              <>
                <p className="mt-5 font-title uppercase tracking-wider text-flare">
                  Procurando oponente...
                </p>
                <button
                  onClick={leaveQueue}
                  className="clip-btn mt-4 w-full cursor-pointer border border-edge bg-transparent py-2.5 text-sm font-bold uppercase tracking-wide text-ink-dim transition-colors hover:text-ink"
                >
                  Cancelar
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
