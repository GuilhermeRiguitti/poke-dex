"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PackIcon } from "@/src/components/icons";
import { formatCountdown, packStatusView } from "./packView";
import PackRevealCard from "./PackRevealCard";
import type { OpenPackResultDTO, PackCardDTO, PackStateDTO } from "./types";

// A ÚNICA fronteira "use client" da rota de pacotes: tem clique (abrir) e um
// cronômetro vivo. A page é servidor e passa o estado inicial por prop; daqui
// pra frente o estado é do cliente até o próximo request.

type Phase = "idle" | "opening" | "revealed";

export default function PackOpener({ initialState }: { initialState: PackStateDTO }) {
  const router = useRouter();
  const [state, setState] = useState(initialState);
  const [cards, setCards] = useState<PackCardDTO[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const status = packStatusView(state, now);

  // Cronômetro vivo: só liga quando há contagem pra mostrar. Cada tick é
  // client-side puro (sem request) — quando zera, o próprio packStatusView
  // passa a devolver canOpen true no próximo render.
  useEffect(() => {
    if (status.msUntilNext === null) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [status.msUntilNext]);

  async function open() {
    if (!status.canOpen || phase === "opening") return;
    setPhase("opening");
    setError(null);
    setCards([]);
    try {
      const res = await fetch("/api/packs/open", { method: "POST" });
      if (res.status === 409) {
        setError("Nenhum pacote disponível ainda.");
        setPhase("idle");
        // ressincroniza o estado do servidor (o cliente pode estar adiantado)
        router.refresh();
        return;
      }
      if (!res.ok) {
        setError("Não foi possível abrir o pacote. Tente de novo.");
        setPhase("idle");
        return;
      }
      const data = (await res.json()) as OpenPackResultDTO;
      setCards(data.cards);
      setState(data.packState);
      setNow(Date.now());
      setPhase("revealed");
      // atualiza dados de servidor de outras telas (coleção, futuro dashboard)
      router.refresh();
    } catch {
      setError("Falha de rede ao abrir o pacote.");
      setPhase("idle");
    }
  }

  const newCount = cards.filter((c) => c.isNew).length;

  return (
    <div className="flex flex-col items-center">
      {/* cofre / CTA */}
      <div className="clip-card w-full max-w-md border border-edge bg-panel p-6 text-center">
        <div className="mx-auto mb-3 flex h-20 w-20 items-center justify-center text-flare">
          <PackIcon size={64} className={status.canOpen ? "animate-playable-pulse" : ""} />
        </div>

        {status.extraPacks > 0 && (
          <p className="mb-2 font-title text-sm uppercase tracking-wide text-gold">
            {status.extraPacks} pacote{status.extraPacks > 1 ? "s" : ""} bônus
          </p>
        )}

        <button
          onClick={open}
          disabled={!status.canOpen || phase === "opening"}
          className="clip-btn w-full cursor-pointer border-0 bg-flare px-4 py-3 font-title text-lg uppercase tracking-wide text-white transition-all hover:bg-flare-dark active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {phase === "opening" ? "Abrindo..." : status.buttonLabel}
        </button>

        {status.msUntilNext !== null && (
          <p className="mt-3 text-sm font-semibold text-ink-dim">
            Próximo pacote grátis em{" "}
            <span className="font-title tracking-wider text-ink">
              {formatCountdown(status.msUntilNext)}
            </span>
          </p>
        )}

        {error && <p className="mt-3 text-sm font-semibold text-bad">{error}</p>}
      </div>

      {/* cartas reveladas */}
      {phase === "revealed" && cards.length > 0 && (
        <div className="mt-8 w-full">
          <p className="mb-4 text-center font-title text-sm uppercase tracking-wide text-ink-dim">
            {newCount > 0 ? (
              <>
                <span className="text-flare">{newCount}</span> nova
                {newCount > 1 ? "s" : ""} de {cards.length}
              </>
            ) : (
              <>Todas repetidas desta vez</>
            )}
          </p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {cards.map((card, i) => (
              <PackRevealCard key={`${card.pokemonId}-${i}`} card={card} index={i} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
