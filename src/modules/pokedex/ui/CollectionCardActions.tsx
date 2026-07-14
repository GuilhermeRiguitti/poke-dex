"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

// A outra (e última) fronteira "use client" da PokéDex: os dois botões do
// rodapé do card da coleção. Tem evento, então é cliente. O card, o grid, as
// vagas do deck e a page inteira ao redor continuam sendo servidor.
//
// Note o que este componente NÃO faz: não busca a coleção, não busca o deck,
// não busca pokémon. Ele só dispara a escrita e pede o refresh — quem lê é o
// servidor. Era exatamente esse acoplamento (o cliente que escreve também
// precisava ler tudo pra saber o que desenhar) que fazia a página inteira ser
// "use client" e trazia junto o N+1.

export default function CollectionCardActions({
  userCardId,
  deckCardId,
  inDeck,
  canToggle,
}: {
  userCardId: string;
  /** id do DeckCard, quando este pokémon está no deck */
  deckCardId: string | null;
  inDeck: boolean;
  canToggle: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

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

  const toggleDeck = () =>
    run(() =>
      inDeck && deckCardId
        ? fetch(`/api/deck/${deckCardId}`, { method: "DELETE" })
        : fetch("/api/deck", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userCardId }),
          })
    );

  const release = () => run(() => fetch(`/api/cards/${userCardId}`, { method: "DELETE" }));

  return (
    <div className="grid grid-cols-2 gap-2">
      <button
        onClick={toggleDeck}
        disabled={locked || !canToggle}
        className={`clip-btn cursor-pointer border-0 px-2 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
          inDeck ? "bg-flare text-white hover:bg-flare-dark" : "bg-panel-2 text-ink-dim hover:text-ink"
        }`}
      >
        {inDeck ? "No deck ✓" : "+ Deck"}
      </button>
      <button
        onClick={release}
        disabled={locked}
        className="clip-btn cursor-pointer border-0 bg-panel-2 px-2 py-1.5 text-xs font-bold uppercase tracking-wide text-bad/80 transition-colors hover:text-bad disabled:opacity-40"
      >
        Soltar
      </button>
    </div>
  );
}
