"use client";

import { useCallback } from "react";
import { useDeckEditor } from "@/src/modules/deck/ui/DeckEditorProvider";

// A área da coleção como ALVO DE DROP: soltar aqui uma carta que está numa vaga
// TIRA ela do time.
//
// É o gesto inverso do arrastar pra montar, e o par do ✕ da linha do deck.
// Existe porque arrastar pra fora da vaga já parecia que ia fazer alguma coisa —
// e não fazia nada: a carta voltava pro lugar sem explicação.
//
// A zona é o painel ROLÁVEL inteiro, não a grade de cartas: com o time quase
// cheio sobra pouca carta na grade, e mirar no espaço entre elas seria pior que
// usar o ✕. O espaço vazio abaixo das cartas conta como alvo.
//
// Só uma casca cliente — a grade dentro dela continua vindo do servidor. Fora do
// provider (telas sem deck ao lado) ela é uma `div` comum.
//
// O aviso é SÓ o tom de fundo, sem texto. Um rótulo "solte para tirar do time"
// existiu e saiu: ele entrava no fluxo e empurrava a grade pra baixo ao aparecer
// — a tela pulava bem na hora em que o jogador precisa de mira firme. Quem
// completa o recado é a miniatura no cursor, que esmaece sobre esta área.

export default function CollectionDropZone({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const editor = useDeckEditor();
  const registrarZona = editor?.registrarZonaColecao;

  // O `ref` NÃO pode ser `editor.registrarZonaColecao` direto: passar uma função
  // que veio de um objeto de contexto faz o `react-hooks/refs` tratar o objeto
  // inteiro como ref e acusar toda leitura dele no render. O `useCallback`
  // resolve isso e ainda dá identidade estável — sem ele, o callback trocaria a
  // cada render e o React desregistraria/registraria a zona no meio do arrasto.
  const registrar = useCallback(
    (el: HTMLDivElement | null) => {
      registrarZona?.(el);
    },
    [registrarZona]
  );

  const devolvendo = editor?.sobreAColecao ?? false;

  return (
    <div
      ref={registrar}
      className={`${className ?? ""} relative transition-colors ${devolvendo ? "bg-bad/5" : ""}`}
    >
      {children}
    </div>
  );
}
