"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toastWarn } from "@/src/layout/toast";
import { DECK_LIMIT, moveSlot } from "../domain/rules";
import { useDeckDrop } from "./DeckDropZone";
import DeckSlotCard from "./DeckSlotCard";
import { dropTargetIndex, livePosition, slotShift, type DeckSlotView } from "./deckBoardView";

// A lista de vagas do deck, arrastável pra trocar a ordem do time. É o único
// pedaço cliente do DeckSlots — o cabeçalho e o botão de batalhar seguem no
// servidor (CLAUDE.md regra 1: o "use client" desce o mais fundo possível).
//
// A ordem IMPORTA no jogo: a vaga 0 é quem começa em campo, o resto é reserva.
// Por isso arrastar não é enfeite — é escolher quem abre a batalha.
//
// Ponteiro, não HTML5 drag-and-drop: `dragstart`/`drop` não existem no toque, e
// metade do jogo é jogada no celular. Com Pointer Events o mesmo código serve
// pro mouse, pro dedo e pra caneta. A alça tem `touch-action: none` pra que
// arrastar a carta não role a página junto.
//
// Só as vagas PREENCHIDAS arrastam. As vazias são sempre as últimas
// (deckBoardView empacota assim) e servem de moldura.

/** Quanto o dedo precisa andar antes de virar arrasto — abaixo disso é toque. */
const LIMIAR_PX = 4;

/**
 * `passo` (altura da linha + o espaço entre elas) mora aqui e não no ref das
 * medidas porque ele é usado pra DESENHAR o deslocamento das vizinhas — e ref
 * não se lê durante o render.
 */
type Arrasto = { from: number; to: number; dy: number; ativo: boolean; passo: number };

export default function DeckSlotList({ slots }: { slots: DeckSlotView[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  // Esta lista é o alvo do arrasto que vem da coleção. Ela se REGISTRA no
  // provider (que mora acima das duas colunas) em vez de o provider procurá-la
  // no DOM — assim quem sabe onde o alvo está é quem o desenha.
  const drop = useDeckDrop();

  const preenchidas = slots.filter((s) => s.id !== null);
  const vazias = slots.length - preenchidas.length;
  const recebendo = !!drop?.carta;
  const vaiCair = recebendo && drop!.sobreOAlvo && vazias > 0;

  // Ordem otimista: a carta fica onde foi solta na hora, sem esperar o servidor.
  // Sem isso ela volta pro lugar antigo e pula de volta quando o refresh chega.
  const [ordem, setOrdem] = useState(preenchidas);
  const [doServidor, setDoServidor] = useState(idsDe(preenchidas));

  // Quando o servidor manda uma lista diferente (montou, tirou, ou o refresh
  // depois do nosso PATCH), ele é a verdade e a ordem local é descartada.
  const idsAtuais = idsDe(preenchidas);
  if (idsAtuais !== doServidor) {
    setDoServidor(idsAtuais);
    setOrdem(preenchidas);
  }

  const [arrasto, setArrasto] = useState<Arrasto | null>(null);
  const linhasRef = useRef<(HTMLLIElement | null)[]>([]);
  const medidasRef = useRef<{ startY: number; meios: number[] } | null>(null);

  function comecar(e: React.PointerEvent, index: number) {
    if (e.pointerType === "mouse" && e.button !== 0) return;

    const linhas = linhasRef.current.slice(0, ordem.length).filter((l): l is HTMLLIElement => l !== null);
    if (linhas.length < 2) return; // com uma carta só não há o que reordenar

    const caixas = linhas.map((l) => l.getBoundingClientRect());
    medidasRef.current = { startY: e.clientY, meios: caixas.map((c) => c.top + c.height / 2) };

    e.currentTarget.setPointerCapture(e.pointerId);
    setArrasto({
      from: index,
      to: index,
      dy: 0,
      ativo: false,
      // Altura da linha + o espaço entre elas, MEDIDO em vez de chutado: o
      // `gap` da lista vem do Tailwind e pode mudar no CSS sem avisar aqui.
      passo: caixas[1].top - caixas[0].top,
    });
  }

  function mover(e: React.PointerEvent) {
    const m = medidasRef.current;
    if (!m || !arrasto) return;

    const dy = e.clientY - m.startY;
    // Antes do limiar não é arrasto: sem isso, um clique trêmulo na alça já
    // reordenaria o time.
    const ativo = arrasto.ativo || Math.abs(dy) > LIMIAR_PX;
    // A vaga sai do CENTRO da carta arrastada (meio da linha + o quanto andou),
    // não da posição do dedo: quem pega a carta pela borda de baixo não deve
    // reordenar diferente de quem pega pelo meio.
    const centro = m.meios[arrasto.from] + dy;

    setArrasto({ ...arrasto, dy, ativo, to: ativo ? dropTargetIndex(m.meios, arrasto.from, centro) : arrasto.from });
  }

  function soltar() {
    if (!arrasto) return;
    const { from, to, ativo } = arrasto;
    setArrasto(null);
    medidasRef.current = null;
    if (!ativo || from === to) return;

    aplicar(moveSlot(ordem, from, to), ordem);
  }

  async function aplicar(nova: typeof ordem, anterior: typeof ordem) {
    setOrdem(nova);

    const res = await fetch("/api/deck/order", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slotIds: nova.map((s) => s.id) }),
    });

    if (!res.ok) {
      // Desfaz na tela e vai buscar o time de verdade: 409 é a outra aba tendo
      // mexido no deck enquanto este arrastava.
      setOrdem(anterior);
      toastWarn(res.status === 409 ? "O deck mudou em outra aba" : "Não deu pra salvar a ordem");
    }
    // Recarrega dos dois jeitos: no erro pra mostrar o time real, no acerto pra
    // que a coleção ao lado veja a mesma ordem.
    startTransition(() => router.refresh());
  }

  /** Alt+setas move a carta sem mouse — arrastar não dá pra fazer no teclado. */
  function teclado(e: React.KeyboardEvent, index: number) {
    if (!e.altKey) return;
    const destino = e.key === "ArrowUp" ? index - 1 : e.key === "ArrowDown" ? index + 1 : null;
    if (destino === null || destino < 0 || destino >= ordem.length) return;

    e.preventDefault();
    aplicar(moveSlot(ordem, index, destino), ordem);
  }

  return (
    <ul
      ref={drop?.registrarAlvo}
      className={`flex flex-col gap-1.5 p-3 transition-colors xl:min-h-0 xl:flex-1 xl:overflow-y-auto ${
        vaiCair ? "bg-energy/10" : ""
      }`}
    >
      {ordem.map((slot, i) => {
        const arrastando = arrasto?.ativo && arrasto.from === i;
        const desloca = arrasto?.ativo ? slotShift(i, arrasto.from, arrasto.to) : 0;
        const passo = arrasto?.passo ?? 0;

        return (
          <li
            key={slot.id}
            ref={(el) => {
              linhasRef.current[i] = el;
            }}
            className={arrastando ? "relative z-10" : "relative"}
            style={{
              transform: `translateY(${arrastando ? arrasto.dy : desloca * passo}px)`,
              // Só quem NÃO está no dedo anima: animar o arrastado o faria
              // correr atrás do cursor com atraso.
              transition: arrastando ? "none" : "transform 150ms ease",
            }}
          >
            <DeckSlotCard
              slot={slot}
              // O número mostra pra onde a carta VAI enquanto o dedo anda.
              posicao={arrasto?.ativo ? livePosition(i, arrasto.from, arrasto.to) : i}
              total={ordem.length}
              arrastando={!!arrastando}
              onPegar={(e) => comecar(e, i)}
              onArrastar={mover}
              onSoltar={soltar}
              onTecla={(e) => teclado(e, i)}
            />
          </li>
        );
      })}

      {Array.from({ length: vazias }, (_, i) => {
        // A PRIMEIRA vaga vazia é onde a carta arrastada vai cair (o servidor
        // usa firstFreeOrder). Só ela acende — acender todas não diria nada.
        const alvo = i === 0 && vaiCair;

        return (
          <li
            key={`vazia-${i}`}
            className={`clip-btn flex min-h-14.5 items-center gap-2.5 border border-dashed px-2.5 transition-colors ${
              alvo ? "border-energy bg-energy/10 text-energy" : "border-edge text-ink-dim/60"
            }`}
          >
            <span
              className={`flex h-10 w-10 flex-none items-center justify-center border font-title text-base ${
                alvo ? "border-energy" : "border-edge"
              }`}
            >
              {ordem.length + i + 1}
            </span>
            <span className="font-title text-xs uppercase tracking-widest">
              {alvo ? `Soltar ${drop?.carta?.name ?? ""} aqui` : "Slot vazio"}
            </span>
          </li>
        );
      })}

      {/* Deck cheio e alguém arrastando: dizer por que nada vai acontecer é
          melhor do que a carta sumir de volta pra coleção sem explicação. */}
      {recebendo && vazias === 0 && (
        <li className="clip-btn flex min-h-14.5 items-center justify-center border border-dashed border-bad px-2.5 text-center font-title text-xs uppercase tracking-widest text-bad">
          Time completo ({DECK_LIMIT})
        </li>
      )}
    </ul>
  );
}

/** Chave de comparação da lista que veio do servidor (ordem inclusa). */
function idsDe(slots: DeckSlotView[]): string {
  return slots.map((s) => s.id).join(",");
}
