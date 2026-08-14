"use client";

// A parte interativa da página de troca: colar um código pra receber, e a lista
// das suas ofertas abertas (com cancelar).
//
// Recebe as ofertas JÁ PRONTAS por prop — a page é servidor e busca no render
// (CLAUDE.md regra 1). Não há `useEffect` de primeira pintura aqui de propósito:
// isso é exatamente o que a regra manda matar.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toTradeOfferView, tradeErrorLabel } from "./tradeView";
import type { TradeOfferDTO } from "./types";

export default function TradeBoard({ offers }: { offers: TradeOfferDTO[] }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [mensagem, setMensagem] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [enviando, setEnviando] = useState(false);

  const views = offers.map(toTradeOfferView);

  async function aceitar(e: React.FormEvent) {
    e.preventDefault();
    if (enviando) return;
    setEnviando(true);
    setMensagem(null);

    const res = await fetch("/api/trade/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string };

    if (!res.ok) {
      setMensagem({ tipo: "erro", texto: tradeErrorLabel(body.error ?? "invalid_code") });
      setEnviando(false);
      return;
    }

    setMensagem({ tipo: "ok", texto: "Carta recebida! Ela já está na sua coleção." });
    setCode("");
    setEnviando(false);
    // A coleção mudou no servidor: `refresh()` refaz o render da árvore server
    // sem recarregar a página inteira.
    router.refresh();
  }

  async function cancelar(id: string) {
    await fetch(`/api/trade/offer/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h2 className="font-[family-name:var(--font-title)] text-lg text-ink">Receber uma carta</h2>
        <p className="mt-1 text-sm text-ink-dim">
          Cole o código que o outro treinador te passou.
        </p>

        <form onSubmit={aceitar} className="mt-3 flex flex-wrap gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="A2B4-C6D8"
            aria-label="Código da troca"
            className="min-w-0 flex-1 border border-edge bg-panel-2 px-3 py-2 font-[family-name:var(--font-card)] tracking-widest text-ink uppercase placeholder:text-ink-dim/50"
          />
          <button
            type="submit"
            disabled={enviando || code.trim().length === 0}
            className="cursor-pointer bg-flare px-5 py-2 font-semibold text-bg transition hover:bg-flare-dark disabled:cursor-not-allowed disabled:opacity-40"
          >
            {enviando ? "Trocando…" : "Aceitar"}
          </button>
        </form>

        {mensagem && (
          <p className={`mt-3 text-sm ${mensagem.tipo === "ok" ? "text-ok" : "text-bad"}`}>
            {mensagem.texto}
          </p>
        )}
      </section>

      <section>
        <h2 className="font-[family-name:var(--font-title)] text-lg text-ink">
          Suas ofertas abertas
        </h2>

        {views.length === 0 ? (
          <p className="mt-2 text-sm text-ink-dim">
            Nenhuma. Use o ⇄ numa carta da coleção pra gerar um código.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {views.map((v) => (
              <li
                key={v.id}
                className="flex items-center gap-3 border border-edge bg-panel-2/50 p-3"
              >
                {v.spriteUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={v.spriteUrl} alt="" className="h-12 w-12 flex-none object-contain" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate capitalize text-ink">
                    {v.name.replace(/-/g, " ")}{" "}
                    <span className="text-ink-dim">Nv {v.level}</span>
                  </span>
                  <span
                    className={`block text-xs ${v.expiringSoon ? "text-warn" : "text-ink-dim"}`}
                  >
                    {v.expiryLabel}
                  </span>
                </span>
                <code className="flex-none font-[family-name:var(--font-card)] tracking-widest text-gold">
                  {v.displayCode}
                </code>
                <button
                  type="button"
                  onClick={() => cancelar(v.id)}
                  aria-label={`Cancelar a oferta de ${v.name}`}
                  className="flex-none cursor-pointer border border-edge px-2 py-1 text-xs text-ink-dim transition hover:text-bad"
                >
                  cancelar
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
