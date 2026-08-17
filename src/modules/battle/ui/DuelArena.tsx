"use client";

import { Component, type ReactNode, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import CombatLog from "./CombatLog";
import CombatantPanel from "./CombatantPanel";
import DuelCallout from "./DuelCallout";
import MoveCommandBar from "./MoveCommandBar";
import ReserveRail from "./ReserveRail";
import { duelCalloutFor, type DuelMonView, type DuelTurnFx, type DuelView } from "./battleView";

// A ARENA: o palco 3D ocupa a TELA INTEIRA (é o cenário, não um quadro) e o HUD
// flutua por cima, empurrado pras quinas — o meio fica livre pros dois Pokémon
// e pro balão de dano.
//
//   painel ↖ rodada + relógio + saída + estado + relatório ("o que passou")
//   topo ↑ o que fazer agora
//   canto ↗ placa do oponente + time dele
//   canto ↙ minha placa
//   rodapé ↓ console de golpes (a decisão do round)
//   coluna → trilho de reservas (a troca, sempre na tela)
//
// A sala é TELA CHEIA e não tem navbar (grupo de rota (arena)) — por isso a
// saída é um link daqui, no alto da coluna esquerda.
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
        {/* ↖ o PAINEL da esquerda: rodada, relógio, saída, estado do oponente e
            o relatório — tudo num frame só (ver CombatLog). Antes eram quatro
            peças soltas empilhadas na quina, cada uma com o seu fundo, todas
            por cima do palco.
            No celular ele sai: a largura não dá pra ele e pra placa de HP, e
            quem decide a jogada é a placa. */}
        <div className="pointer-events-auto absolute left-3 top-3 hidden w-[min(23rem,34vw)] sm:left-4 sm:top-4 sm:block">
          <CombatLog
            lines={view.logLines}
            round={view.round}
            isOver={view.isOver}
            turnEndsInMs={view.turnEndsInMs}
            turnTimeoutMs={view.turnTimeoutMs}
            oppAbsentMs={view.oppAbsentMs}
            opponentReady={view.opponentReady}
          />
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

        {/* ↙ minha placa */}
        <div className="pointer-events-auto absolute bottom-28 left-3 w-[min(26rem,55vw)] sm:bottom-4 sm:left-4 sm:w-[min(23rem,34vw)]">
          <CombatantPanel mon={view.me} side="me" energy={view.myEnergy} energyMax={view.energyMax} />
        </div>

        {/* ↓ a decisão do round: a barra de golpes */}
        {!forcedSwitch && !view.isOver && (
          <div
            className={`pointer-events-auto absolute bottom-4 left-1/2 -translate-x-1/2 transition-opacity ${
              locked && casting === null ? "opacity-60" : ""
            }`}
          >
            {/* O console já se mede sozinho (w-[min(66rem,96vw)]) — o wrapper só
                centraliza e apaga quando a jogada está travada. */}
            <MoveCommandBar
              cards={view.cards}
              locked={locked}
              casting={casting}
              energy={view.myEnergy}
              energyMax={view.energyMax}
              onPlay={handlePlay}
            />
          </div>
        )}

        {/* ↘ a troca: o banco de reservas, SEMPRE visível, flutuando no palco.
            Fica ACIMA da faixa do console (bottom-52) e não abaixo: o console é
            a decisão do round e não pode ser tapado — nem pela carta que a
            pilha levanta no hover, que é o motivo de ela crescer pra CIMA. */}
        {!view.isOver && (
          <div className="pointer-events-auto absolute bottom-52 right-3 sm:right-4">
            <ReserveRail
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
