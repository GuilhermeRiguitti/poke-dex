"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

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
    <div
      className="bg-no-repeat bg-cover min-h-screen pb-12"
      style={{ backgroundImage: "url('https://wallpaperaccess.com/full/45664.jpg')" }}
    >
      <nav className="grid grid-cols-[1fr_2fr_1fr] w-full items-center justify-items-center h-max">
        <Link href="/">
          <img
            src="https://upload.wikimedia.org/wikipedia/commons/thumb/5/53/Pok%C3%A9_Ball_icon.svg/1200px-Pok%C3%A9_Ball_icon.svg.png"
            alt="Home"
            className="w-20 h-20 cursor-pointer"
          />
        </Link>
        <Link href="/pokedex">
          <img
            src="https://upload.wikimedia.org/wikipedia/commons/thumb/9/98/International_Pok%C3%A9mon_logo.svg/2000px-International_Pok%C3%A9mon_logo.svg.png"
            alt="Pokémon"
            className="w-[300px] h-[70px] p-2.5 cursor-pointer"
          />
        </Link>
      </nav>

      <div className="flex flex-col items-center mt-12 text-white gap-4 px-4 text-center">
        <h1 className="text-2xl font-bold">Batalha Online</h1>

        {loading && <p>Carregando seu deck...</p>}

        {!loading && deck && (
          <>
            <p>
              Deck: {deck.name} — {deck.deckCards.length} pokémon(s)
            </p>
            {deck.deckCards.length === 0 && (
              <p className="text-yellow-300 max-w-md">
                Seu deck está vazio. Vá até a{" "}
                <Link href="/pokedex" className="underline">
                  coleção
                </Link>{" "}
                e adicione pokémons ao deck antes de batalhar.
              </p>
            )}
            {error && <p className="text-red-400">{error}</p>}
            {!queued ? (
              <button
                onClick={enterQueue}
                disabled={deck.deckCards.length === 0}
                className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-bold px-6 py-2 rounded-lg cursor-pointer border-0"
              >
                Procurar Partida
              </button>
            ) : (
              <>
                <p className="animate-pulse">Procurando oponente...</p>
                <button
                  onClick={leaveQueue}
                  className="bg-red-700 hover:bg-red-600 text-white px-4 py-2 rounded cursor-pointer border-0"
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
