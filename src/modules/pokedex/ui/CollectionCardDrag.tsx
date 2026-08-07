"use client";

import { useRef } from "react";
import type { DeckCardDTO } from "@/src/modules/deck/ui/types";
import { useDeckEditor } from "@/src/modules/deck/ui/DeckEditorProvider";

// Envelope que torna a carta da coleção arrastável até UMA VAGA do deck.
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
// caminho continua sendo o botão "pôr no time" (CollectionCardActions), que põe
// na primeira vaga livre.
//
// Duas coisas mudaram com o rascunho de cliente:
//  - só arrasta em MODO EDIÇÃO. Fora dele o deck é o que está gravado, e uma
//    carta que se move sem querer viraria mudança pendente sem o jogador pedir.
//  - a carta que JÁ ESTÁ no time aparece marcada (a coleção lista tudo agora) e
//    não arrasta de novo — quem quer mudar a posição dela pega pela vaga.

const LIMIAR_PX = 5;

/** Tamanho da miniatura em relação à carta (260px → ~117px). */
const ESCALA = 0.45;

export default function CollectionCardDrag({
  card,
  children,
}: {
  card: DeckCardDTO;
  children: React.ReactNode;
}) {
  const editor = useDeckEditor();
  // Ref, não variável: `mover` re-renderiza pra reposicionar a miniatura, e uma
  // variável do corpo do componente voltaria a null no meio do gesto.
  const inicio = useRef<{ x: number; y: number } | null>(null);

  // Fora do provider (ou sem deck na tela) a carta é só uma carta.
  if (!editor) return <>{children}</>;

  const vaga = editor.vagaDe(card.userPokemonId);
  const noTime = vaga !== null;
  const arrastando =
    editor.arrastando?.card.userPokemonId === card.userPokemonId &&
    editor.arrastando.origem.kind === "collection";
  const podeArrastar = editor.editing && !noTime && !editor.salvando;

  return (
    <div
      data-dragging={arrastando ? "true" : undefined}
      // A carta no time fica esmaecida com a marca da vaga por cima: some da
      // grade seria pior — o jogador perderia de vista o que montou, e no
      // rascunho ele ainda pode desfazer.
      className={`relative ${arrastando ? "opacity-60" : noTime ? "opacity-45" : ""}`}
      // Mata o drag NATIVO da arte da carta (`<img>` nasce arrastável). Ele
      // cancela os pointer events e solta o pointer capture no meio do gesto, e
      // aí o nosso arrasto morre antes de sair do lugar.
      onDragStart={(e) => e.preventDefault()}
      onPointerDown={(e) => {
        if (!podeArrastar) return;
        if (e.pointerType !== "mouse" || e.button !== 0) return;
        // O rodapé da carta tem botões — ali o gesto é clicar.
        if ((e.target as HTMLElement).closest("button")) return;
        inicio.current = { x: e.clientX, y: e.clientY };
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        const p = inicio.current;
        if (p == null || !podeArrastar) return;
        // Só vira arrasto depois de andar: sem o limiar, um clique com a mão
        // trêmula em cima da carta já mexeria no time.
        if (!arrastando) {
          if (Math.hypot(e.clientX - p.x, e.clientY - p.y) < LIMIAR_PX) return;
          // `children` é a carta renderizada no servidor: a miniatura que segue
          // o cursor é a MESMA carta, não uma versão simplificada dela.
          editor.comecarArrasto(
            { card, origem: { kind: "collection" }, preview: children, escala: ESCALA },
            e
          );
        }
        editor.moverArrasto(e);
      }}
      onPointerUp={() => {
        inicio.current = null;
        if (arrastando) editor.soltarArrasto();
      }}
      onPointerCancel={() => {
        inicio.current = null;
        if (arrastando) editor.soltarArrasto();
      }}
    >
      {children}

      {noTime && (
        <span className="clip-btn pointer-events-none absolute right-2 top-2 bg-energy px-2 py-1 font-title text-[10px] uppercase leading-none tracking-wider text-bg">
          Vaga {vaga + 1}
        </span>
      )}
    </div>
  );
}
