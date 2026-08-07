"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { toastWarn } from "@/src/layout/toast";

import {
  clearSlot,
  countFilled,
  draftFrom,
  draftToSlots,
  firstFreeIndex,
  indexOfCard,
  placeInSlot,
  sameDraft,
  type DeckDraft,
} from "../domain/deckDraft";
import { DECK_LIMIT } from "../domain/rules";
import { deckSlotsIssueMessage, validateDeckSlots } from "../domain/validateDeckSlots";
import type { DeckBoardDTO, DeckCardDTO } from "./types";

// O ESTADO DO DECK ENQUANTO SE MONTA. É o coração da tela de coleção.
//
// ── O que mudou, e por quê ────────────────────────────────────────────────
// Antes cada gesto era um request: soltar a carta fazia POST /api/deck, o X
// fazia DELETE, arrastar pra reordenar fazia PATCH — cada um seguido de
// `router.refresh()`. Três consequências ruins:
//   1. a carta só assentava na vaga quando o servidor respondia (o arrastar
//      "tremia", e um deck cheio só era descoberto depois do 409);
//   2. desfazer não existia — cada erro do jogador já estava gravado;
//   3. o refresh reconsultava a coleção paginada inteira a cada carta.
//
// Agora o time é um RASCUNHO no cliente. Arrastar, trocar de vaga e tirar são
// operações puras (domain/deckDraft.ts) sobre um array de DECK_LIMIT posições —
// zero request. Só o botão "salvar" escreve, com um PUT que manda o time inteiro.
//
// ── Por que um contexto ────────────────────────────────────────────────────
// A carta que se arrasta vive na coluna do meio (a coleção) e a vaga que a
// recebe vive na da direita — duas subárvores irmãs em (game)/page.tsx, sem
// estado em comum. O provider é a única peça que enxerga as duas.
//
// E ele NÃO torna a página cliente: as duas colunas continuam renderizadas no
// servidor e entram aqui como `children`. Um componente cliente pode receber
// árvore do servidor por prop — o que não pode é a page levar "use client",
// porque aí getCollectionQuery/getDeckBoardQuery (que importam Prisma) iriam
// parar no bundle do browser.

/** De onde a carta que está no ar saiu — é o que decide "trocar" ou "ocupar". */
export type DragOrigin = { kind: "collection" } | { kind: "slot"; index: number };

interface CartaArrastada {
  card: DeckCardDTO;
  origem: DragOrigin;
  /**
   * A CARTA renderizada, pra desenhar a miniatura que segue o cursor.
   *
   * É o mesmo nó que a grade já mostra (o `children` do CollectionCardDrag,
   * vindo do servidor) — não uma segunda versão simplificada. Elemento React é
   * descritor, então reaproveitá-lo aqui não duplica dado nem busca nada de
   * novo, e a miniatura fica idêntica à carta de origem.
   */
  preview: React.ReactNode;
  /** o quanto a miniatura encolhe em relação à carta de origem */
  escala: number;
}

interface DeckEditor {
  /** o time como está na tela — DECK_LIMIT posições, `null` é vaga vazia */
  draft: DeckDraft<DeckCardDTO>;
  /** dá pra mexer no time? fora do modo edição, arrastar e o ✕ não fazem nada */
  editing: boolean;
  /** o rascunho difere do que está gravado */
  dirty: boolean;
  /** o PUT está em voo */
  salvando: boolean;
  quantas: number;
  limite: number;

  iniciarEdicao: () => void;
  cancelarEdicao: () => void;
  salvar: () => void;

  /** põe a carta na primeira vaga livre (é o caminho do toque, sem arrastar) */
  porNoTime: (card: DeckCardDTO) => void;
  tirarDaVaga: (index: number) => void;
  /** em que vaga esta carta está no rascunho, ou null */
  vagaDe: (userPokemonId: string) => number | null;

  // ── arrastar ────────────────────────────────────────────────────────────
  arrastando: CartaArrastada | null;
  /** a vaga sob o ponteiro agora, ou null */
  vagaAlvo: number | null;
  /**
   * O ponteiro está sobre a COLEÇÃO carregando uma carta que veio de uma vaga —
   * soltar aqui tira ela do time.
   *
   * Só é verdade nesse caso: carta vinda da própria coleção largada de volta na
   * coleção não faz nada, e não deve acender nada.
   */
  sobreAColecao: boolean;
  comecarArrasto: (c: CartaArrastada, e: React.PointerEvent) => void;
  moverArrasto: (e: React.PointerEvent) => void;
  soltarArrasto: () => void;
  /** cada vaga se registra por aqui — é ela que sabe onde está no DOM */
  registrarVaga: (index: number, el: HTMLElement | null) => void;
  /** a área da coleção se registra por aqui, pelo mesmo motivo */
  registrarZonaColecao: (el: HTMLElement | null) => void;
}

const Ctx = createContext<DeckEditor | null>(null);

/**
 * O editor do deck. Fora do provider devolve null — quem consome trata isso
 * como "montar deck não está disponível aqui" em vez de estourar, porque a
 * carta da coleção também é desenhada em telas que não têm deck do lado.
 */
export function useDeckEditor(): DeckEditor | null {
  return useContext(Ctx);
}

export default function DeckEditorProvider({
  board,
  children,
}: {
  board: DeckBoardDTO;
  children: React.ReactNode;
}) {
  // O time GRAVADO, espalhado nas DECK_LIMIT posições. É a régua do "dirty" e o
  // ponto pra onde o cancelar volta.
  const salvo = useMemo(() => draftFrom<DeckCardDTO>(board.slots), [board.slots]);

  const [draft, setDraft] = useState<DeckDraft<DeckCardDTO>>(salvo);
  // Deck vazio abre JÁ em edição: não há time pra proteger de um clique errado,
  // e obrigar quem acabou de abrir o primeiro pacote a apertar "editar" antes de
  // montar é uma porta fechada sem nada atrás.
  const [editing, setEditing] = useState(() => countFilled(salvo) === 0);
  const [salvando, setSalvando] = useState(false);

  const [arrastando, setArrastando] = useState<CartaArrastada | null>(null);
  const [vagaAlvo, setVagaAlvo] = useState<number | null>(null);
  const [sobreAColecao, setSobreAColecao] = useState(false);

  const vagasRef = useRef<(HTMLElement | null)[]>([]);
  const zonaColecaoRef = useRef<HTMLElement | null>(null);
  const posRef = useRef({ x: 0, y: 0 });
  const miniaturaRef = useRef<HTMLDivElement | null>(null);
  /**
   * A carta em curso, espelhada em ref.
   *
   * `moverArrasto` precisa saber DE ONDE a carta veio (só a que saiu de uma vaga
   * pode ser devolvida à coleção). Ler isso do estado deixaria o primeiro
   * `pointermove` com o valor velho: quem começa o arrasto chama `comecarArrasto`
   * e `moverArrasto` no MESMO evento, e o estado só chega no render seguinte.
   */
  const arrastandoRef = useRef<CartaArrastada | null>(null);

  const dirty = !sameDraft(draft, salvo);
  const quantas = countFilled(draft);

  const registrarVaga = useCallback((index: number, el: HTMLElement | null) => {
    vagasRef.current[index] = el;
  }, []);

  const registrarZonaColecao = useCallback((el: HTMLElement | null) => {
    zonaColecaoRef.current = el;
  }, []);

  /**
   * Posiciona a miniatura escrevendo NO NÓ, sem passar pelo React.
   *
   * Guardar a posição do cursor em estado re-renderizaria este provider — e com
   * ele as 20 cartas da coleção — a cada pointermove. É a mesma razão pela qual
   * o HoloCard escreve custom properties direto no elemento.
   */
  const posicionarMiniatura = useCallback(() => {
    const el = miniaturaRef.current;
    if (!el) return;
    el.style.left = `${posRef.current.x}px`;
    el.style.top = `${posRef.current.y}px`;
  }, []);

  const comecarArrasto = useCallback((c: CartaArrastada, e: React.PointerEvent) => {
    posRef.current = { x: e.clientX, y: e.clientY };
    arrastandoRef.current = c;
    setArrastando(c);
    setVagaAlvo(null);
    setSobreAColecao(false);
  }, []);

  const moverArrasto = useCallback(
    (e: React.PointerEvent) => {
      posRef.current = { x: e.clientX, y: e.clientY };
      posicionarMiniatura();

      // Acerto por RETÂNGULO, não por elementFromPoint: a miniatura que segue o
      // cursor fica por cima de tudo e responderia no lugar do alvo de baixo.
      //
      // Cada vaga é um alvo próprio — é o que faz "soltar na 3" cair na 3. Antes
      // o alvo era a lista inteira e o servidor escolhia a posição.
      let alvo: number | null = null;
      for (let i = 0; i < vagasRef.current.length; i++) {
        if (dentroDe(vagasRef.current[i], e)) {
          alvo = i;
          break;
        }
      }

      // Só mexe no estado quando o alvo MUDA: o realce é a única coisa que
      // precisa de re-render, e ele vira poucas vezes por gesto.
      setVagaAlvo((antes) => (antes === alvo ? antes : alvo));

      // A COLEÇÃO é o alvo de "tirar do time" — mas só pra carta que veio de uma
      // vaga. Arrastar da coleção e largar na coleção não é nada, e acender a
      // área nesse caso prometeria uma ação que não existe.
      //
      // A vaga ganha da coleção quando as duas pegam (abaixo de `xl` o painel do
      // deck fica empilhado sobre a grade): soltar em cima de uma vaga é sempre
      // "pôr ali", nunca "tirar".
      const daVaga = arrastandoRef.current?.origem.kind === "slot";
      const devolvendo = alvo === null && daVaga && dentroDe(zonaColecaoRef.current, e);
      setSobreAColecao((antes) => (antes === devolvendo ? antes : devolvendo));
    },
    [posicionarMiniatura]
  );

  const soltarArrasto = useCallback(() => {
    const atual = arrastando;
    const alvo = vagaAlvo;
    const devolvendo = sobreAColecao;

    arrastandoRef.current = null;
    setArrastando(null);
    setVagaAlvo(null);
    setSobreAColecao(false);
    if (!atual) return;

    if (alvo !== null) {
      // `placeInSlot` resolve os dois gestos: vindo da coleção ocupa a vaga (quem
      // estava lá volta pra coleção), vindo de outra vaga TROCA as duas.
      setDraft((d) => placeInSlot(d, alvo, atual.card));
      return;
    }

    // Soltou na coleção uma carta que estava numa vaga: tira do time. É o
    // caminho inverso do arrastar pra montar, e o par do ✕ da linha.
    const origem = atual.origem;
    if (devolvendo && origem.kind === "slot") {
      setDraft((d) => clearSlot(d, origem.index));
    }

    // Fora dos dois alvos, o gesto é CANCELADO — a carta volta pro lugar.
    // Soltar no vazio (a barra de cima, a margem da tela) não pode desmontar
    // vaga nenhuma: seria destruir o time por um movimento impreciso.
  }, [arrastando, vagaAlvo, sobreAColecao]);

  const porNoTime = useCallback((card: DeckCardDTO) => {
    setDraft((d) => {
      if (indexOfCard(d, card.userPokemonId) !== null) return d; // já está no time
      const vaga = firstFreeIndex(d);
      if (vaga === null) {
        toastWarn(`O time já tem ${DECK_LIMIT} pokémons`);
        return d;
      }
      return placeInSlot(d, vaga, card);
    });
  }, []);

  const tirarDaVaga = useCallback((index: number) => {
    setDraft((d) => clearSlot(d, index));
  }, []);

  const vagaDe = useCallback((userPokemonId: string) => indexOfCard(draft, userPokemonId), [draft]);

  const iniciarEdicao = useCallback(() => setEditing(true), []);

  const cancelarEdicao = useCallback(() => {
    setDraft(salvo);
    setEditing(false);
  }, [salvo]);

  const salvar = useCallback(() => {
    const slots = draftToSlots(draft);

    // A MESMA validação que o servidor roda (domain/validateDeckSlots). Aqui ela
    // é conveniência — evita gastar um request pra ouvir um não —, lá é a trava
    // de verdade. Pelo rascunho ser posicional, nenhuma destas falhas deveria
    // acontecer; se acontecer, é bug nosso, e o aviso é melhor que um 400 mudo.
    const parsed = validateDeckSlots(slots);
    if (!parsed.ok) {
      toastWarn(deckSlotsIssueMessage(parsed.issue));
      return;
    }

    setSalvando(true);
    fetch("/api/deck", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slots }),
    })
      .then(async (res) => {
        if (res.ok) {
          // O servidor devolve o deck GRAVADO. Adotá-lo (em vez de confiar no
          // rascunho) é o que fecha o ciclo: o que a tela mostra passa a ser o
          // que o banco tem, e `dirty` volta a ser falso pela comparação, não
          // por decreto.
          const gravado = (await res.json()) as DeckBoardDTO;
          setDraft(draftFrom<DeckCardDTO>(gravado.slots));
          setEditing(false);
          return;
        }

        const corpo = (await res.json().catch(() => ({}))) as {
          error?: string;
          issue?: Parameters<typeof deckSlotsIssueMessage>[0];
          names?: string[];
        };

        if (corpo.error === "invalid_cards") {
          const nomes = (corpo.names ?? []).map((n) => n.replace(/-/g, " ")).join(", ");
          toastWarn(
            nomes
              ? `${nomes} ainda não tem nenhum golpe liberado — tire do time`
              : "Um dos pokémons do time não tem golpe liberado"
          );
          return;
        }
        if (corpo.error === "invalid_slots" && corpo.issue) {
          toastWarn(deckSlotsIssueMessage(corpo.issue));
          return;
        }
        toastWarn(corpo.error === "not_found" ? "Uma das cartas não é sua" : "Não deu pra salvar o deck");
      })
      .catch(() => toastWarn("Não deu pra salvar o deck"))
      .finally(() => setSalvando(false));
  }, [draft]);

  const valor: DeckEditor = {
    draft,
    editing,
    dirty,
    salvando,
    quantas,
    limite: DECK_LIMIT,
    iniciarEdicao,
    cancelarEdicao,
    salvar,
    porNoTime,
    tirarDaVaga,
    vagaDe,
    arrastando,
    vagaAlvo,
    sobreAColecao,
    comecarArrasto,
    moverArrasto,
    soltarArrasto,
    registrarVaga,
    registrarZonaColecao,
  };

  return (
    <Ctx.Provider value={valor}>
      {children}

      {/* A CARTA em miniatura seguindo o cursor — a ideia é parecer que se está
          arrastando a carta física, não um rótulo dela.

          `pointer-events: none` é obrigatório: sem isso ela roubaria o ponteiro
          da própria carta que a está movendo. De quebra é o que deixa o tilt 3D
          TRAVADO durante o gesto — sem evento de ponteiro chegando, o HoloCard
          não inclina e a carta viaja reta. */}
      {arrastando && (
        <div
          // Callback ref: no instante em que a miniatura entra no DOM ela já é
          // posta onde o cursor está. Sem isso ela pisca no canto 0,0 até o
          // primeiro pointermove.
          ref={(el) => {
            miniaturaRef.current = el;
            posicionarMiniatura();
          }}
          className="pointer-events-none fixed z-50 origin-top-left"
          // origin-top-left: o canto da carta fica no cursor, e a conta de
          // posição continua sendo só (x, y) — sem depender da largura dela.
          // A inclinação fixa de -4° é o "peguei na mão"; não é o tilt do holo,
          // que segue o ponteiro e aqui está desligado.
          style={{
            transform: `scale(${arrastando.escala}) rotate(-4deg)`,
            // Três estados: sobre uma vaga (vai entrar), sobre a coleção (vai
            // SAIR do time — esmaece, é o oposto de acender), e no ar.
            filter:
              vagaAlvo !== null
                ? "drop-shadow(0 18px 26px rgb(0 0 0 / 0.55)) brightness(1.1)"
                : sobreAColecao
                  ? "drop-shadow(0 14px 20px rgb(0 0 0 / 0.5)) grayscale(0.7) brightness(0.8)"
                  : "drop-shadow(0 14px 20px rgb(0 0 0 / 0.5))",
          }}
        >
          {arrastando.preview}
        </div>
      )}
    </Ctx.Provider>
  );
}

/** O ponteiro está dentro do retângulo deste elemento? */
function dentroDe(el: HTMLElement | null, e: React.PointerEvent): boolean {
  if (!el) return false;
  const r = el.getBoundingClientRect();
  return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
}
