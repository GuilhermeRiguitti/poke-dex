"use client";

import { useRef } from "react";
import { typeColor } from "@/src/lib/typeColors";
import { useDeckEditor } from "./DeckEditorProvider";
import type { DeckSlotView } from "./deckBoardView";

// UMA VAGA do deck — e cada vaga é o PRÓPRIO alvo de drop.
//
// É a mudança que dá nome à tela: soltar uma carta na vaga 3 põe ela na 3. Antes
// o alvo era a lista inteira e o servidor escolhia a posição (a primeira livre),
// então o jogador soltava em cima da 3 e a carta ia parar na 5.
//
// Cada vaga se REGISTRA no provider em vez de o provider procurá-la no DOM:
// quem sabe onde o alvo está é quem o desenha. O provider testa o retângulo de
// cada vaga contra o ponteiro (não `elementFromPoint`, que acertaria a miniatura
// que segue o cursor).
//
// Vaga preenchida também ARRASTA: pegar a carta daqui e soltar na 1 troca as
// duas. Ponteiro, não HTML5 drag-and-drop: `dragstart`/`drop` não existem no
// toque, e metade do jogo é jogada no celular.
//
// Nenhum fetch aqui. O ✕ mexe no rascunho; quem grava é o botão de salvar.

/** Quanto o dedo precisa andar antes de virar arrasto — abaixo disso é toque. */
const LIMIAR_PX = 4;

/** Tamanho da miniatura arrastada em relação à linha da vaga (ela já é pequena). */
const ESCALA_MINIATURA = 0.9;

export default function DeckSlotCard({ slot }: { slot: DeckSlotView }) {
  const editor = useDeckEditor();
  const linhaRef = useRef<HTMLDivElement | null>(null);
  const inicio = useRef<{ x: number; y: number } | null>(null);

  const vazia = slot.userPokemonId === null;
  const editing = !!editor?.editing;
  const alvo = editor?.vagaAlvo === slot.index && !!editor?.arrastando;
  const arrastandoEsta =
    editor?.arrastando?.origem.kind === "slot" && editor.arrastando.origem.index === slot.index;

  const cor = typeColor(slot.accentType ?? "normal");

  // ── a vaga como ALVO ──────────────────────────────────────────────────────
  // O ref vai no nó externo, que é o retângulo que o provider mede.
  const registrar = (el: HTMLDivElement | null) => {
    linhaRef.current = el;
    editor?.registrarVaga(slot.index, el);
  };

  // ── a vaga como ORIGEM ────────────────────────────────────────────────────
  const podePegar = editing && !vazia && !editor?.salvando;

  const pegar = (e: React.PointerEvent) => {
    if (!podePegar) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if ((e.target as HTMLElement).closest("button")) return; // no ✕ o gesto é clicar
    inicio.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const mover = (e: React.PointerEvent) => {
    const p = inicio.current;
    if (!p || !editor) return;

    if (!arrastandoEsta) {
      // Só vira arrasto depois de andar: sem o limiar, um clique com a mão
      // trêmula em cima da vaga já trocaria o time de posição.
      if (Math.hypot(e.clientX - p.x, e.clientY - p.y) < LIMIAR_PX) return;
      editor.comecarArrasto(
        {
          card: {
            userPokemonId: slot.userPokemonId!,
            pokemonId: slot.pokemonId!,
            name: slot.name!,
            iconUrl: slot.iconUrl,
            level: slot.level!,
            types: slot.types,
            rarity: slot.rarity!,
            baseStats: slot.baseStats!,
          },
          origem: { kind: "slot", index: slot.index },
          // A miniatura é a PRÓPRIA linha da vaga, com a largura que ela tem no
          // painel — arrastar uma cópia de tamanho diferente faria parecer que
          // se está movendo outra coisa.
          preview: (
            <div style={{ width: linhaRef.current?.offsetWidth }}>
              <Linha slot={slot} cor={cor} fantasma />
            </div>
          ),
          escala: ESCALA_MINIATURA,
        },
        e
      );
    }
    editor.moverArrasto(e);
  };

  const soltar = () => {
    inicio.current = null;
    if (arrastandoEsta) editor?.soltarArrasto();
  };

  return (
    <div
      ref={registrar}
      onPointerDown={pegar}
      onPointerMove={mover}
      onPointerUp={soltar}
      onPointerCancel={soltar}
      // Rede embaixo do `draggable={false}` do sprite: mata o drag NATIVO de
      // qualquer conteúdo da linha (imagem, texto selecionado, link). Ele
      // cancelaria os pointer events no meio do nosso gesto.
      onDragStart={(e) => e.preventDefault()}
      // `touch-action: none` só quando dá pra pegar: no dedo, sem isso o gesto
      // vertical em cima do deck não rolaria mais a página.
      className={`${podePegar ? "touch-none cursor-grab active:cursor-grabbing" : ""} ${
        arrastandoEsta ? "opacity-40" : ""
      }`}
    >
      {vazia ? (
        <VagaVazia slot={slot} alvo={alvo} editing={editing} />
      ) : (
        <Linha
          slot={slot}
          cor={cor}
          alvo={alvo}
          onTirar={editing ? () => editor?.tirarDaVaga(slot.index) : undefined}
        />
      )}
    </div>
  );
}

/** A moldura tracejada de uma posição livre. Ela acende quando é o alvo do drop. */
function VagaVazia({
  slot,
  alvo,
  editing,
}: {
  slot: DeckSlotView;
  alvo: boolean;
  editing: boolean;
}) {
  return (
    <div
      className={`clip-btn flex min-h-14.5 items-center gap-2.5 border border-dashed px-2.5 transition-colors ${
        alvo ? "border-energy bg-energy/10 text-energy" : "border-edge text-ink-dim/60"
      }`}
    >
      <span
        className={`flex h-10 w-10 flex-none items-center justify-center border font-title text-base ${
          alvo ? "border-energy" : "border-edge"
        }`}
      >
        {slot.numero}
      </span>
      <span className="font-title text-xs uppercase tracking-widest">
        {alvo ? "Soltar aqui" : editing ? "Vaga livre" : "Slot vazio"}
      </span>
    </div>
  );
}

/**
 * A linha da carta montada.
 *
 * `fantasma` é a versão que viaja no cursor: sem o ✕ (não há o que clicar no
 * ar) e sem o realce de alvo.
 */
function Linha({
  slot,
  cor,
  alvo = false,
  fantasma = false,
  onTirar,
}: {
  slot: DeckSlotView;
  cor: string;
  alvo?: boolean;
  fantasma?: boolean;
  onTirar?: () => void;
}) {
  return (
    <div
      className="clip-btn flex min-h-14.5 select-none items-center gap-2.5 p-2 transition-shadow"
      style={{
        background: `linear-gradient(90deg, color-mix(in srgb, ${cor} 16%, transparent), var(--color-panel-2) 62%)`,
        boxShadow: alvo
          ? "inset 0 0 0 2px var(--color-energy)"
          : fantasma
            ? `inset 0 0 0 1px ${cor}, 0 8px 20px rgb(0 0 0 / 0.45)`
            : `inset 0 0 0 1px color-mix(in srgb, ${cor} 40%, transparent)`,
      }}
    >
      <span
        className="clip-btn flex h-10 w-10 flex-none flex-col items-center justify-center gap-0.5"
        style={{ background: `color-mix(in srgb, ${cor} 16%, transparent)` }}
        title={slot.emCampo ? "Começa em campo" : undefined}
      >
        <span
          className="font-title text-sm leading-none"
          style={{ color: slot.emCampo ? cor : undefined }}
        >
          {slot.numero}
        </span>
        {onTirar && (
          <span className="text-[8px] leading-none text-ink-dim" aria-hidden>
            ⠿
          </span>
        )}
      </span>

      <span className="clip-btn flex h-10 w-10 flex-none items-center justify-center">
        {slot.iconUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={slot.iconUrl}
            alt={slot.name ?? ""}
            // O SPRITE ENGOLIA O ARRASTO. `<img>` nasce `draggable` no browser:
            // pegar a linha bem em cima dele disparava o drag NATIVO (o fantasma
            // translúcido da imagem), que cancela os pointer events e solta o
            // pointer capture no meio do gesto — o nosso arrasto morria antes de
            // passar do limiar de 4px.
            //
            // Dois cadeados porque falham em lugares diferentes: `draggable`
            // desliga na origem, e `pointer-events-none` faz o pointerdown cair
            // direto na linha (o sprite é decoração, não alvo).
            draggable={false}
            className="pointer-events-none h-full w-full object-contain"
          />
        )}
      </span>

      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate font-title text-sm uppercase tracking-wide">{slot.name}</span>
          <span className="lv-badge flex-none">
            <span>Lv {slot.level}</span>
          </span>
        </span>
        <span className="flex gap-1">
          {slot.types.map((t) => (
            <span
              key={t}
              className="clip-btn px-1.5 py-px font-title text-[9px] uppercase leading-relaxed tracking-wider text-bg"
              style={{ background: typeColor(t) }}
            >
              {t}
            </span>
          ))}
        </span>
      </span>

      {onTirar && (
        <button
          onClick={onTirar}
          aria-label={`Tirar ${slot.name ?? "carta"} da vaga ${slot.numero}`}
          title="Tirar do time"
          className="flex h-6 w-6 flex-none cursor-pointer items-center justify-center border-0 bg-panel-2 text-xs font-bold text-ink-dim transition-colors hover:bg-bad hover:text-white"
        >
          ✕
        </button>
      )}
    </div>
  );
}
