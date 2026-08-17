"use client";

// Rede de segurança da arena. Igual à do (game) em intenção, mas com o caminho
// de volta EXPLÍCITO: aqui não há navbar, então um throw sem este botão deixa o
// jogador numa tela sem nenhuma saída a não ser digitar a URL.

import Link from "next/link";
import { useEffect } from "react";

export default function ArenaError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[arena] erro não tratado:", error.digest ?? error.message);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="font-title text-3xl text-bad">A arena não abriu</h1>
      <p className="max-w-md text-ink-dim">
        Não foi possível montar esta partida. Ela continua salva — voltar e entrar de novo costuma
        resolver.
      </p>
      {error.digest ? <p className="text-xs text-ink-dim">código: {error.digest}</p> : null}
      <div className="mt-2 flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="clip-btn bg-flare px-6 py-2 font-semibold text-bg transition hover:bg-flare-dark"
        >
          Tentar de novo
        </button>
        <Link
          href="/battle"
          className="clip-btn border border-edge bg-panel-2 px-6 py-2 font-semibold transition hover:border-energy"
        >
          Voltar pra fila
        </Link>
      </div>
    </div>
  );
}
