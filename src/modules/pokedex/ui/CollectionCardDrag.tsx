"use client";

import { useRef } from "react";
import { useDeckDrop } from "@/src/modules/deck/ui/DeckDropZone";

// Envelope que torna a carta da coleção arrastável até o deck.
//
// É CLIENTE, mas a carta continua vindo do SERVIDOR: o markup do PokeCard entra
// aqui como `children`. Mesmo truque que o HoloCard já usa — só a casca hidrata.
//
// `data-dragging` no wrapper é o que desliga o tilt 3D enquanto a carta está
// sendo arrastada (a regra mora no globals.css). Sem isso a carta fica girando
// atrás do cursor no meio do gesto.
//
// Só no MOUSE. No toque o gesto vertical é rolar a lista de cartas, e roubá-lo
// pra arrastar deixaria a coleção impossível de percorrer no celular — lá o
// caminho continua sendo o botão "Montar".

const LIMIAR_PX = 5;

export default function CollectionCardDrag({
  userPokemonId,
  name,
  children,
}: {
  userPokemonId: string;
  /** só pro rótulo de acessibilidade e pra mensagem de erro do drop */
  name: string;
  children: React.ReactNode;
}) {
  const drop = useDeckDrop();
  // Ref, não variável: `mover` re-renderiza pra reposicionar a miniatura, e uma
  // variável do corpo do componente voltaria a null no meio do gesto.
  const inicio = useRef<{ x: number; y: number } | null>(null);

  const arrastando = drop?.carta?.userPokemonId === userPokemonId;

  // Fora do provider (ou sem deck na tela) a carta é só uma carta.
  if (!drop) return <>{children}</>;

  return (
    <div
      data-dragging={arrastando ? "true" : undefined}
      className={arrastando ? "opacity-60" : undefined}
      onPointerDown={(e) => {
        if (e.pointerType !== "mouse" || e.button !== 0) return;
        // O rodapé da carta tem o botão "Montar" — ali o gesto é clicar.
        if ((e.target as HTMLElement).closest("button")) return;
        if (drop.salvando) return;
        inicio.current = { x: e.clientX, y: e.clientY };
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        const p = inicio.current;
        if (p == null) return;
        // Só vira arrasto depois de andar: sem o limiar, um clique com a mão
        // trêmula em cima da carta já montaria um loadout sem querer.
        if (!arrastando) {
          if (Math.hypot(e.clientX - p.x, e.clientY - p.y) < LIMIAR_PX) return;
          // `children` é a carta renderizada no servidor: a miniatura que segue
          // o cursor é a MESMA carta, não uma versão simplificada dela.
          drop.comecar({ userPokemonId, name, preview: children }, e);
        }
        drop.mover(e);
      }}
      onPointerUp={() => {
        inicio.current = null;
        if (arrastando) drop.soltar();
      }}
      onPointerCancel={() => {
        inicio.current = null;
        if (arrastando) drop.soltar();
      }}
    >
      {children}
    </div>
  );
}
