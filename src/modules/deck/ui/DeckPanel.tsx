"use client";

import Link from "next/link";
import { SwordsIcon } from "@/src/layout/icons";
import { useDeckEditor } from "./DeckEditorProvider";
import { deckBoardView } from "./deckBoardView";
import DeckSlotCard from "./DeckSlotCard";

// A TRILHA DA DIREITA do workspace da coleção: o time, e os botões de editar /
// salvar / cancelar / batalhar.
//
// Substituiu o par DeckSlots (servidor) + DeckSlotList (cliente). O painel
// inteiro é cliente agora, e isso não fere a regra 1 do CLAUDE.md ("o use client
// desce o mais fundo possível"): com o time virando RASCUNHO, tudo aqui depende
// dele — a contagem no cabeçalho, as marquinhas de progresso, as seis vagas e o
// botão de batalhar (que a edição pendente desliga). Não sobrou pedaço estático
// pra deixar no servidor.
//
// O que continua no servidor é o que importa: a PAGE. Ela busca o deck e a
// coleção com Prisma e passa por prop — nenhum `useEffect` buscando dado, nenhum
// "Carregando...".

export default function DeckPanel() {
  const editor = useDeckEditor();
  if (!editor) return null; // fora do provider não há deck pra mostrar

  const { editing, dirty, salvando, iniciarEdicao, cancelarEdicao, salvar } = editor;
  const deck = deckBoardView(editor.draft, { editing, dirty });

  return (
    <aside className="flex flex-col border-t border-edge bg-panel/60 xl:min-h-0 xl:border-l xl:border-t-0">
      <div className="flex-none border-b border-edge bg-panel-2/50 p-3.5">
        <div className="flex items-baseline gap-2">
          <h2 className="flex items-center gap-2 font-title text-base uppercase tracking-wider">
            <SwordsIcon size={15} className="text-flare" />
            Deck de batalha
          </h2>
          <span className="ml-auto font-title text-base text-flare">
            {deck.count}
            <span className="text-ink-dim">/{deck.limit}</span>
          </span>
        </div>

        {/* uma marca por vaga: dá o "quanto falta" antes de ler a lista. Segue a
            POSIÇÃO, não a contagem — com buraco no meio (carta na 1 e na 4) a
            barra tem que mostrar o buraco, senão ela conta uma história que a
            lista logo abaixo desmente. */}
        <div className="mt-2.5 flex gap-1">
          {deck.slots.map((s) => (
            <span
              key={s.index}
              className={`h-1 flex-1 ${s.userPokemonId ? "bg-flare" : "bg-edge"}`}
            />
          ))}
        </div>

        <p className="mt-2 text-xs font-semibold text-ink-dim">
          {editing
            ? "Arraste as cartas até uma vaga. A vaga 1 começa em campo."
            : dirty
              ? "Há mudanças não salvas."
              : "Toque em editar para mudar o time."}
        </p>
      </div>

      <ul className="flex flex-col gap-1.5 p-3 xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
        {deck.slots.map((slot) => (
          <li key={slot.index}>
            <DeckSlotCard slot={slot} />
          </li>
        ))}
      </ul>

      <div className="flex-none space-y-2 border-t border-edge bg-panel-2/50 p-3.5">
        {editing ? (
          <div className="flex gap-2">
            <button
              onClick={salvar}
              disabled={salvando || !dirty}
              className="clip-btn flex-1 cursor-pointer border-0 bg-energy px-4 py-3 text-center font-title text-sm uppercase tracking-wider text-bg transition-colors hover:bg-energy/85 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {salvando ? "Salvando…" : dirty ? "Salvar deck" : "Sem mudanças"}
            </button>
            <button
              onClick={cancelarEdicao}
              disabled={salvando}
              title={dirty ? "Descarta as mudanças" : "Sair da edição"}
              className="clip-btn cursor-pointer border border-edge bg-transparent px-4 py-3 text-center font-title text-sm uppercase tracking-wider text-ink-dim transition-colors hover:border-bad/60 hover:text-bad disabled:cursor-not-allowed disabled:opacity-40"
            >
              Cancelar
            </button>
          </div>
        ) : (
          <button
            onClick={iniciarEdicao}
            className="clip-btn w-full cursor-pointer border border-edge bg-transparent px-4 py-3 text-center font-title text-sm uppercase tracking-wider text-ink transition-colors hover:border-energy/60 hover:text-energy"
          >
            Editar deck
          </button>
        )}

        {/* Batalhar sai do ar enquanto o deck está em edição. O que a batalha usa
            é o time GRAVADO — entrar na fila vendo seis cartas na tela e lutar
            com as três antigas seria uma derrota sem explicação possível. */}
        {deck.canBattle ? (
          <Link
            href="/battle"
            className={`clip-btn block bg-flare px-4 py-3 text-center font-title text-sm uppercase tracking-wider text-white transition-colors hover:bg-flare-dark ${
              deck.full ? "animate-playable-pulse" : ""
            }`}
          >
            {deck.battleLabel}
          </Link>
        ) : (
          <span
            title={deck.battleBlockedReason ?? undefined}
            className="clip-btn block cursor-not-allowed border border-edge px-4 py-3 text-center font-title text-sm uppercase tracking-wider text-ink-dim opacity-50"
          >
            {deck.battleBlockedReason}
          </span>
        )}
      </div>
    </aside>
  );
}
