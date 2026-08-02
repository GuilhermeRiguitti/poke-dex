"use client";

import toast, { Toaster } from "react-hot-toast";

// Toaster global do app — monta uma vez no layout raiz. O visual não usa a
// prop `style` padrão da lib: toastWarn desenha um `toast.custom` com a mesma
// moldura chanfrada (clip-card) e tipografia do resto do jogo, em vez do balão
// arredondado genérico.
export function AppToaster() {
  return <Toaster position="top-center" gutter={10} toastOptions={{ duration: 4000 }} />;
}

/**
 * Aviso não-bloqueante no estilo do jogo. Ex.: deck cheio ao tentar montar um
 * loadout a mais — a checagem de verdade é do SERVIDOR (addToDeck retorna
 * "deck_full"), isto aqui só mostra a resposta dele.
 */
export function toastWarn(message: string) {
  toast.custom(
    (t) => (
      <div
        className={`clip-card flex items-center gap-3 border border-edge bg-panel px-4 py-3 shadow-lg transition-opacity duration-200 ${
          t.visible ? "opacity-100" : "opacity-0"
        }`}
      >
        <span className="font-title text-lg text-warn" aria-hidden>
          !
        </span>
        <span className="text-sm font-semibold text-ink">{message}</span>
      </div>
    ),
    { id: message }
  );
}
