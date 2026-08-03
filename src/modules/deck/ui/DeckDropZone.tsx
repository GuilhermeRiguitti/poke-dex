"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toastWarn } from "@/src/layout/toast";

// O arrastar da COLEÇÃO pro DECK, que atravessa duas colunas da mesma tela.
//
// Por que um contexto: a carta que se arrasta vive na coluna do meio e a vaga
// que a recebe vive na da direita — são duas subárvores irmãs em (game)/page.tsx,
// sem estado em comum. O provider é a única peça que enxerga as duas.
//
// E por que ele NÃO torna a página cliente: as duas colunas continuam sendo
// renderizadas no servidor e entram aqui como `children`. Um componente cliente
// pode receber árvore do servidor por prop — o que não pode é a page virar
// "use client", porque aí getCollectionQuery/getDeckBoardQuery (que importam
// Prisma) iriam parar no bundle do browser.
//
// O drop NÃO abre modal: o servidor monta a barra de cartas sozinho
// (defaultLoadout). Escolher skill vai passar a ser coisa da batalha.

interface CartaArrastada {
  userPokemonId: string;
  name: string;
  /**
   * A CARTA renderizada, pra desenhar a miniatura que segue o cursor.
   *
   * É o mesmo nó que a grade já mostra (o `children` do CollectionCardDrag,
   * vindo do servidor) — não uma segunda versão simplificada. Elemento React é
   * descritor, então reaproveitá-lo aqui não duplica dado nem busca nada de
   * novo, e a miniatura fica idêntica à carta de origem: mesma moldura, mesmos
   * tipos, mesmas barras.
   */
  preview: React.ReactNode;
}

/** Tamanho da miniatura em relação à carta (260px → ~117px). */
const ESCALA = 0.45;

interface DeckDrop {
  /** a carta em curso, ou null quando ninguém está arrastando */
  carta: CartaArrastada | null;
  /** o ponteiro está em cima da área do deck */
  sobreOAlvo: boolean;
  /** o POST está em voo — trava um segundo arrasto por cima */
  salvando: boolean;
  comecar: (carta: CartaArrastada, e: React.PointerEvent) => void;
  mover: (e: React.PointerEvent) => void;
  soltar: () => void;
  /** a área que recebe o drop se registra por aqui */
  registrarAlvo: (el: HTMLElement | null) => void;
}

const Ctx = createContext<DeckDrop | null>(null);

/**
 * O estado do arrasto. Fora do provider devolve null — quem consome trata isso
 * como "arrastar não está disponível aqui" em vez de estourar, porque a carta
 * da coleção também é desenhada em telas que não têm deck do lado.
 */
export function useDeckDrop(): DeckDrop | null {
  return useContext(Ctx);
}

export default function DeckDropProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [carta, setCarta] = useState<CartaArrastada | null>(null);
  const [sobreOAlvo, setSobreOAlvo] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const alvoRef = useRef<HTMLElement | null>(null);
  const posRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const miniaturaRef = useRef<HTMLDivElement | null>(null);

  const registrarAlvo = useCallback((el: HTMLElement | null) => {
    alvoRef.current = el;
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
    // Sem folga: o ponto é o CENTRO da carta (ver o transform lá embaixo). A
    // carta fica em volta do cursor, e não pendurada abaixo dele — o alvo do
    // drop é medido pelo cursor, então qualquer distância entre os dois faz
    // parecer que a carta cai fora da vaga.
    el.style.left = `${posRef.current.x}px`;
    el.style.top = `${posRef.current.y}px`;
  }, []);

  const comecar = useCallback(
    (c: CartaArrastada, e: React.PointerEvent) => {
      posRef.current = { x: e.clientX, y: e.clientY };
      setCarta(c);
      setSobreOAlvo(false);
    },
    []
  );

  const mover = useCallback(
    (e: React.PointerEvent) => {
      posRef.current = { x: e.clientX, y: e.clientY };
      posicionarMiniatura();

      // Acerto por RETÂNGULO do alvo, não por elementFromPoint: a miniatura que
      // segue o cursor fica por cima de tudo e responderia no lugar do deck.
      const r = alvoRef.current?.getBoundingClientRect();
      const dentro =
        !!r && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;

      // Só mexe no estado quando o lado MUDA: o realce do alvo é a única coisa
      // que precisa de re-render, e ele vira poucas vezes por gesto.
      setSobreOAlvo((antes) => (antes === dentro ? antes : dentro));
    },
    [posicionarMiniatura]
  );

  const soltar = useCallback(() => {
    const atual = carta;
    const acertou = sobreOAlvo;
    setCarta(null);
    setSobreOAlvo(false);
    if (!atual || !acertou) return;

    setSalvando(true);
    // Sem `moveIds`: o servidor monta a barra. É o que faz o drop ser UM gesto.
    fetch("/api/deck", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userPokemonId: atual.userPokemonId }),
    })
      .then(async (res) => {
        if (res.ok) {
          // A carta some da coleção E aparece no deck com o mesmo refresh: as
          // duas listas saem do mesmo WHERE (deckSlots: none).
          router.refresh();
          return;
        }
        const { error } = (await res.json().catch(() => ({}))) as { error?: string };
        toastWarn(
          error === "deck_full"
            ? "O deck já está cheio"
            : error === "invalid_cards"
              ? `${atual.name} ainda não tem nenhum golpe liberado`
              : "Não deu pra pôr no deck"
        );
      })
      .catch(() => toastWarn("Não deu pra pôr no deck"))
      .finally(() => setSalvando(false));
  }, [carta, sobreOAlvo, router]);

  return (
    <Ctx.Provider value={{ carta, sobreOAlvo, salvando, comecar, mover, soltar, registrarAlvo }}>
      {children}

      {/* A CARTA em miniatura seguindo o cursor — a ideia é parecer que se está
          arrastando a carta física, não um rótulo dela.

          `pointer-events: none` é obrigatório: sem isso ela roubaria o ponteiro
          da própria carta que a está movendo. De quebra é o que deixa o tilt 3D
          TRAVADO durante o gesto — sem evento de ponteiro chegando, o HoloCard
          não inclina e a carta viaja reta.

          Nenhum texto de instrução: quem diz onde vai cair é a vaga do deck, que
          acende com "soltar aqui". */}
      {carta && (
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
            transform: `scale(${ESCALA}) rotate(-4deg)`,
            filter: sobreOAlvo
              ? "drop-shadow(0 18px 26px rgb(0 0 0 / 0.55)) brightness(1.1)"
              : "drop-shadow(0 14px 20px rgb(0 0 0 / 0.5))",
          }}
        >
          {carta.preview}
        </div>
      )}
    </Ctx.Provider>
  );
}
