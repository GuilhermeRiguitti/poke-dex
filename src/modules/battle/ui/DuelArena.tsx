"use client";

import { Component, type ReactNode, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import CombatLog from "./CombatLog";
import CombatantPanel from "./CombatantPanel";
import DuelCallout from "./DuelCallout";
import MoveCommandBar from "./MoveCommandBar";
import ReserveDrawer from "./ReserveDrawer";
import TurnClock from "./TurnClock";
import { duelCalloutFor, type DuelMonView, type DuelTurnFx, type DuelView } from "./battleView";

// A ARENA: o palco 3D ocupa a TELA INTEIRA (é o cenário, não um quadro) e o HUD
// flutua por cima, empurrado pras quinas — o meio fica livre pros dois Pokémon
// e pro balão de dano.
//
//   canto ↖ rodada + estado        topo ↑ o que fazer agora
//   canto ↗ placa do oponente + time dele
//   canto ↙ minha placa + relatório de combate
//   rodapé ↓ barra de golpes (a decisão do round)
//   canto ↘ gaveta de reservas (a troca, guardada a um hover)
//
// A regra de apresentação continua pura em battleView.ts (DuelTurnFx,
// duelCalloutFor, duelLogMark). Aqui é costura + movimento. Se o WebGL falhar,
// cai no fallback de sprites HTML.

const DuelStage3D = dynamic(() => import("./DuelStage3D"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 grid place-items-center font-title text-xs uppercase tracking-widest text-ink-dim">
      Montando arena…
    </div>
  ),
});

// ── fallback HTML se o 3D falhar (WebGL indisponível) ───────────────────────
// Segue o mesmo enquadramento do palco: oponente à direita/acima, eu à
// esquerda/abaixo — inclusive o balão de dano, que no 3D vem ancorado pelo drei.
function StageFallbackSprites({ me, opp, fx }: { me: DuelMonView; opp: DuelMonView; fx: DuelTurnFx | null }) {
  const one = (mon: DuelMonView, side: "me" | "opp") => {
    const callout = duelCalloutFor(fx, side, mon.name);
    const place = side === "opp" ? "left-[64%] top-[36%]" : "left-[30%] top-[48%]";
    return (
      <div className={`absolute -translate-x-1/2 ${place}`}>
        {callout && (
          <div className="absolute bottom-full left-1/2 mb-3 -translate-x-1/2">
            <DuelCallout callout={callout} />
          </div>
        )}
        <div className="absolute -bottom-1 left-1/2 h-3 w-24 -translate-x-1/2 rounded-[50%] bg-black/45 blur-[3px]" />
        {mon.spriteUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- sprite da PokéAPI
          <img
            src={mon.spriteUrl}
            alt={mon.name}
            className={`h-40 w-40 object-contain drop-shadow-[0_6px_10px_rgba(0,0,0,.5)] ${mon.fainted ? "opacity-30 grayscale" : "sprite-idle"}`}
          />
        )}
      </div>
    );
  };
  return (
    <div className="absolute inset-0">
      {one(opp, "opp")}
      {one(me, "me")}
    </div>
  );
}

// Error boundary: se o R3F/WebGL estourar, mostramos os sprites HTML — o jogo
// nunca fica sem o campo (a batalha funciona igual, sem o 3D).
class StageBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

// ── a arena ─────────────────────────────────────────────────────────────────
export default function DuelArena({
  view,
  submitting,
  onPlayCard,
  onSwitch,
}: {
  view: DuelView;
  submitting: boolean;
  onPlayCard: (cardSlot: number) => void;
  onSwitch: (targetSlot: number) => void;
}) {
  const locked = submitting || !view.canPlay;
  const forcedSwitch = view.mode === "forcedSwitch";

  // FX da última ação: dispara UMA vez quando o turnNumber muda (não re-anima o
  // histórico ao (re)abrir a sala).
  const [fx, setFx] = useState<DuelTurnFx | null>(null);
  const [nonce, setNonce] = useState(0);
  const seen = useRef<number | null>(null);
  useEffect(() => {
    const tn = view.fx?.turnNumber ?? null;
    if (seen.current === null) {
      seen.current = tn;
      return;
    }
    if (tn === null || tn === seen.current) return;
    seen.current = tn;
    setFx(view.fx);
    setNonce((n) => n + 1);
    const t = setTimeout(() => setFx(null), 1600);
    return () => clearTimeout(t);
  }, [view.fx]);

  // golpe em vôo (independe da rede: a animação sempre completa)
  const [casting, setCasting] = useState<number | null>(null);
  const castTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (castTimer.current && clearTimeout(castTimer.current)), []);
  function handlePlay(slot: number) {
    if (locked) return;
    setCasting(slot);
    if (castTimer.current) clearTimeout(castTimer.current);
    castTimer.current = setTimeout(() => setCasting(null), 520);
    onPlayCard(slot);
  }

  const shakeScreen = fx && !fx.missed && (fx.isCrit || fx.fainted) ? "screen-shake" : "";

  const banner = view.isOver
    ? null
    : forcedSwitch
      ? { text: `${view.me.name.replace(/-/g, " ")} caiu — escolha o substituto`, cls: "text-flare animate-pulse" }
      : view.waitingOpponent
        ? { text: "Aguardando oponente…", cls: "text-ink-dim animate-pulse" }
        : { text: "Escolha seu golpe", cls: "text-flare" };

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* palco 3D em tela cheia — é o cenário */}
      <div className="duel-sky absolute inset-0">
        <StageBoundary fallback={<StageFallbackSprites me={view.me} opp={view.opp} fx={fx} />}>
          <DuelStage3D
            me={{ spriteUrl: view.me.spriteUrl, fainted: view.me.fainted, name: view.me.name }}
            opp={{ spriteUrl: view.opp.spriteUrl, fainted: view.opp.fainted, name: view.opp.name }}
            fx={fx}
            nonce={nonce}
          />
        </StageBoundary>
        <div className="duel-vignette pointer-events-none absolute inset-0" aria-hidden />
      </div>

      {/* HUD flutuante. A camada não captura o mouse; cada peça reativa o seu. */}
      <div className={`pointer-events-none absolute inset-0 ${shakeScreen}`}>
        {/* ↖ rodada + estado do oponente */}
        <div className="absolute left-4 top-4 flex flex-col items-start gap-1.5">
          <span className="plate border border-edge bg-panel-2/85 px-3 py-1 backdrop-blur-sm">
            <span className="plate-inner font-title text-xs uppercase tracking-wider">Rodada {view.round}</span>
          </span>
          {!view.isOver && (
            // key por round: o relógio remonta a cada rodada e já nasce no
            // valor do servidor, sem esperar o primeiro tique.
            <TurnClock
              key={view.round}
              turnEndsInMs={view.turnEndsInMs}
              turnTimeoutMs={view.turnTimeoutMs}
              running={!view.isOver}
            />
          )}
          {!view.isOver && (
            /* A desconexão TROCA o rótulo de "escolhendo": um oponente que sumiu
               não está escolhendo nada, e ficar dizendo que está faz o jogador
               esperar à toa. O contador dá a informação que falta — quanto tempo
               até ele ganhar por ausência. */
            <span
              className={`font-title text-[10px] uppercase tracking-widest ${
                view.oppAbsentMs !== null
                  ? "text-bad"
                  : view.opponentReady
                    ? "text-ok"
                    : "text-ink-dim"
              }`}
            >
              {view.oppAbsentMs !== null
                ? `⏻ oponente sem sinal — vitória em ${Math.ceil(view.oppAbsentMs / 1000)}s`
                : view.opponentReady
                  ? "● oponente pronto"
                  : "○ oponente escolhendo"}
            </span>
          )}
        </div>

        {/* ↑ o que fazer agora */}
        {banner && (
          <div className="absolute left-1/2 top-24 -translate-x-1/2 px-4 text-center sm:top-4">
            <span
              className={`font-title text-xl uppercase tracking-wider drop-shadow-[0_2px_8px_rgba(0,0,0,.8)] sm:text-3xl ${banner.cls}`}
            >
              {banner.text}
            </span>
          </div>
        )}

        {/* ↗ placa do oponente + o time dele */}
        <div className="pointer-events-auto absolute right-3 top-4 w-[min(24rem,62vw)] sm:right-4">
          <CombatantPanel
            mon={view.opp}
            side="opp"
            party={view.oppParty}
            energy={view.oppEnergy}
            energyMax={view.energyMax}
          />
        </div>

        {/* ↙ minha placa + relatório de combate.
            No celular a coluna sobe pra cima da barra de golpes (não há
            largura pra ficarem lado a lado) e o relatório sai — a informação
            que decide a jogada é a placa de HP, não o histórico. */}
        <div className="pointer-events-auto absolute bottom-28 left-3 flex w-[min(26rem,55vw)] flex-col gap-2 sm:bottom-4 sm:left-4 sm:w-[min(26rem,42vw)]">
          <CombatantPanel mon={view.me} side="me" energy={view.myEnergy} energyMax={view.energyMax} />
          <div className="hidden sm:block">
            <CombatLog lines={view.logLines} />
          </div>
        </div>

        {/* ↓ a decisão do round: a barra de golpes */}
        {!forcedSwitch && !view.isOver && (
          <div
            className={`pointer-events-auto absolute bottom-4 left-1/2 max-w-[min(52rem,96vw)] -translate-x-1/2 transition-opacity ${
              locked && casting === null ? "opacity-60" : ""
            }`}
          >
            <MoveCommandBar cards={view.cards} locked={locked} casting={casting} onPlay={handlePlay} />
          </div>
        )}

        {/* ↘ a troca, guardada na gaveta */}
        {!view.isOver && (
          <div className="pointer-events-auto absolute bottom-28 right-3 sm:bottom-4 sm:right-4">
            <ReserveDrawer
              party={view.myParty}
              disabled={forcedSwitch ? submitting : locked}
              canSwitch={view.canSwitch}
              forceOpen={forcedSwitch}
              onSwitch={onSwitch}
            />
          </div>
        )}
      </div>
    </div>
  );
}
