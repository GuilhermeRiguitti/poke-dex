"use client";

// Rede de segurança do grupo (game). Sem ela, qualquer throw num Server Component
// (uma query que estourou o tempo, a PokéAPI fora do ar) cai na tela de erro
// padrão do Next — que em produção é uma página branca com "Application error",
// sem caminho de volta. O `reset()` re-renderiza o segmento: no nosso caso quase
// sempre resolve, porque a falha típica é uma lambda fria estourando o tempo.
//
// O layout de (game) já pintou NavBar e sessão em volta — aqui é só o miolo.

import { useEffect } from "react";

export default function GameError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // O digest é o que liga esta tela à stack real no log da Vercel — sem ele,
    // o relato do jogador ("deu erro") não tem como ser rastreado.
    console.error("[game] erro não tratado:", error.digest ?? error.message);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <h1 className="font-[family-name:var(--font-title)] text-3xl text-[var(--color-bad)]">
        Algo quebrou aqui
      </h1>
      <p className="max-w-md text-[var(--color-ink-dim)]">
        Não foi possível carregar esta tela. Sua coleção e suas partidas estão a salvo.
      </p>
      {error.digest ? (
        <p className="text-xs text-[var(--color-ink-dim)]">código: {error.digest}</p>
      ) : null}
      <button
        type="button"
        onClick={reset}
        className="mt-2 rounded-lg bg-[var(--color-flare)] px-6 py-2 font-semibold text-[var(--color-bg)] transition hover:bg-[var(--color-flare-dark)]"
      >
        Tentar de novo
      </button>
    </div>
  );
}
