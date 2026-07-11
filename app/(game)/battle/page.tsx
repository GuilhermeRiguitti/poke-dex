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
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-poke/15">
        <SwordsIcon size={40} className="text-poke" />
      </div>
      <h1 className="mt-4 text-3xl font-extrabold">Arena de Batalha</h1>
      <p className="mt-1 max-w-md text-sm text-ink-dim">
        Batalhas PvP por turnos contra outros treinadores, com seu deck de até 6 pokémons.
      </p>

      <div className="mt-8 w-full max-w-sm rounded-2xl border border-edge bg-surface p-6">
        {loading && <p className="text-ink-dim">Carregando seu deck...</p>}

        {!loading && deck && (
          <>
            <p className="text-sm">
              <span className="text-ink-dim">Deck:</span>{" "}
              <span className="font-bold">{deck.name}</span>{" "}
              <span className="text-ink-dim">— {deck.deckCards.length}/6 pokémons</span>
            </p>

            {deck.deckCards.length === 0 && (
              <p className="mt-3 text-sm text-warn">
                Seu deck está vazio. Monte-o na{" "}
                <Link href="/pokedex" className="underline">
                  sua coleção
                </Link>{" "}
                antes de batalhar.
              </p>
            )}

            {error && <p className="mt-3 text-sm text-bad">{error}</p>}

            {!queued ? (
              <button
                onClick={enterQueue}
                disabled={deck.deckCards.length === 0}
                className="mt-5 w-full rounded-xl bg-poke py-3 font-bold text-white hover:bg-poke-dark disabled:opacity-40 cursor-pointer border-0 transition-colors"
              >
                Procurar oponente
              </button>
            ) : (
              <>
                <div className="mt-5 flex items-center justify-center gap-2 text-ink-dim">
                  <span className="h-2 w-2 animate-ping rounded-full bg-poke" />
                  Procurando oponente...
                </div>
                <button
                  onClick={leaveQueue}
                  className="mt-4 w-full rounded-xl border border-edge py-2.5 text-sm text-ink-dim hover:text-ink cursor-pointer bg-transparent transition-colors"
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
