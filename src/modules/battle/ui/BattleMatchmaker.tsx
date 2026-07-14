"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import QueueDeckCard from "./QueueDeckCard";
import QueueRadarEmblem from "./QueueRadarEmblem";
import type { QueueDeckDTO } from "./types";

const POLL_INTERVAL_MS = 2000;

// Dono do estado da fila. É a única parte cliente desta tela.
//
// Sobre o formato: o emblema (anéis de radar) e o card (botão/status) leem o
// MESMO `searching`, mas o título fica visualmente entre os dois. Em vez de
// espalhar o estado ou empurrar o título pro cliente, o título entra como
// `children` — Server Component renderizado no servidor e encaixado aqui.
// É o padrão de interleaving do Next; o custo é essa indireção, e é honesto
// dizer que ela existe.
export default function BattleMatchmaker({
  deck,
  children,
}: {
  deck: QueueDeckDTO;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
  };

  useEffect(() => stopPolling, []);

  const goToBattle = (battleId: string) => {
    stopPolling();
    router.push(`/battle/${battleId}`);
  };

  const startPolling = () => {
    pollRef.current = setInterval(async () => {
      const res = await fetch("/api/battle/queue/status");
      if (!res.ok) return;
      const data = await res.json();
      if (data.matched && data.battleId) goToBattle(data.battleId);
    }, POLL_INTERVAL_MS);
  };

  const search = async () => {
    setError("");
    const res = await fetch("/api/battle/queue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deckId: deck.id }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? "Erro ao entrar na fila");
      return;
    }
    // Pareou na hora (já tinha alguém esperando) → vai direto pra partida.
    if (data.matched && data.battleId) {
      goToBattle(data.battleId);
      return;
    }

    setSearching(true);
    startPolling();
  };

  const cancel = async () => {
    stopPolling();
    await fetch("/api/battle/queue", { method: "DELETE" });
    setSearching(false);
  };

  return (
    <div className="flex flex-col items-center pt-16 text-center">
      <QueueRadarEmblem searching={searching} />
      {children}
      <QueueDeckCard
        deck={deck}
        searching={searching}
        error={error}
        onSearch={search}
        onCancel={cancel}
      />
    </div>
  );
}
