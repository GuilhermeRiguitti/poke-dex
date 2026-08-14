"use client";

// O diálogo que nasce do ⇄ da carta: pede o código ao servidor e mostra pra
// copiar. Costura — a regra de texto mora no `tradeView`, e a de negócio no
// command.

import { useEffect, useState } from "react";
import { formatTradeCode, tradeErrorLabel } from "./tradeView";

export default function OfferTradeDialog({
  userPokemonId,
  name,
  onClose,
}: {
  userPokemonId: string;
  name: string;
  onClose: () => void;
}) {
  const [code, setCode] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    // `ignorar` cobre o desmonte no meio do pedido: sem ele, fechar o diálogo
    // antes da resposta chamaria setState em componente já morto.
    let ignorar = false;

    (async () => {
      const res = await fetch("/api/trade/offer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userPokemonId }),
      });
      const body = (await res.json().catch(() => ({}))) as { code?: string; error?: string };
      if (ignorar) return;
      if (!res.ok || !body.code) {
        setErro(tradeErrorLabel(body.error ?? "invalid_code"));
        return;
      }
      setCode(body.code);
    })();

    return () => {
      ignorar = true;
    };
  }, [userPokemonId]);

  async function copiar() {
    if (!code) return;
    // O CRU, não o formatado: o hífen é enfeite de leitura e o servidor
    // normaliza, mas copiar o cru é o caminho que não depende disso.
    await navigator.clipboard.writeText(code).catch(() => {});
    setCopiado(true);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-sm border border-edge bg-panel p-6 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-[family-name:var(--font-title)] text-xl text-ink">
          Oferecer {name.replace(/-/g, " ")}
        </h2>

        {erro ? (
          <p className="mt-4 text-sm text-bad">{erro}</p>
        ) : code ? (
          <>
            <p className="mt-4 text-sm text-ink-dim">
              Passe este código pra quem vai receber. Ele vale por 24 h.
            </p>
            <p className="mt-3 font-[family-name:var(--font-card)] text-3xl tracking-widest text-gold">
              {formatTradeCode(code)}
            </p>
            <button
              type="button"
              onClick={copiar}
              className="mt-4 w-full cursor-pointer bg-flare px-4 py-2 font-semibold text-bg transition hover:bg-flare-dark"
            >
              {copiado ? "Copiado" : "Copiar código"}
            </button>
            <p className="mt-3 text-xs text-ink-dim">
              A carta sai da sua coleção só quando alguém aceitar.
            </p>
          </>
        ) : (
          <p className="mt-4 text-sm text-ink-dim">Gerando o código…</p>
        )}

        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full cursor-pointer border border-edge px-4 py-2 text-sm text-ink-dim transition hover:text-ink"
        >
          Fechar
        </button>
      </div>
    </div>
  );
}
