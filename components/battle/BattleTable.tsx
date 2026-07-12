"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Konva from "konva";
import { Circle, Group, Image as KImage, Layer, Rect, Stage, Text } from "react-konva";
import { typeColor } from "@/lib/typeColors";
import { moveArtUrl } from "@/lib/storage";
import { useHtmlImage } from "./useHtmlImage";

const COLORS = {
  bg: "#0b1018",
  table: "#101724",
  panel: "#151d2e",
  panel2: "#1a2333",
  edge: "#2b3a54",
  ink: "#edf2fb",
  inkDim: "#8da0bf",
  energy: "#23c9ff",
  enemy: "#ff5c5c",
  gold: "#f2c14e",
  ok: "#37e08d",
  warn: "#ffc93c",
  bad: "#ff5c5c",
};

export interface TableMove {
  name: string;
  type: string;
  power: number | null;
  accuracy: number | null;
}

export interface TablePokemon {
  slot: number;
  name: string;
  spriteUrl: string | null;
  types: string[];
  maxHp: number;
  currentHp: number;
  fainted: boolean;
}

export interface TableAttackEvent {
  bySide: "mine" | "enemy";
  damage: number;
  missed: boolean;
  isCrit: boolean;
  effectiveness: number;
}

export interface TableScore {
  myAlive: number;
  myTotal: number;
  oppAlive: number;
  oppTotal: number;
}

interface BattleTableProps {
  myActive: TablePokemon;
  oppActive: TablePokemon;
  bench: TablePokemon[];
  moves: TableMove[];
  locked: boolean;
  needsSwitch: boolean;
  waiting: boolean;
  turnNumber: number;
  score: TableScore;
  lastTurnEvents: TableAttackEvent[] | null;
  lastTurnNumber: number;
  onAttack: (moveSlot: number) => void;
  onSwitch: (slot: number) => void;
}

type DropId = "enemy" | "mine";
type Rect = { x: number; y: number; width: number; height: number };

const clamp = (min: number, v: number, max: number) => Math.max(min, Math.min(max, v));

function hpColor(current: number, max: number): string {
  const pct = (current / max) * 100;
  return pct > 50 ? COLORS.ok : pct > 20 ? COLORS.warn : COLORS.bad;
}

function useTitleFont(): string {
  const [font] = useState(() => {
    const value = getComputedStyle(document.documentElement).getPropertyValue("--font-anton").trim();
    return value ? value.replace(/["']/g, "").split(",")[0] : "sans-serif";
  });
  return font;
}

// ── layout calculado a partir do tamanho REAL do container ───────────────
function computeLayout(W: number, H: number) {
  const PAD = 16;
  const leftW = clamp(150, W * 0.15, 210);
  const rightW = clamp(180, W * 0.17, 250);
  const deckH = clamp(150, H * 0.26, 205);
  const topH = H - deckH;

  const cX0 = leftW + PAD;
  const cX1 = W - rightW - PAD;
  const cCx = (cX0 + cX1) / 2;

  const arenaTop = PAD + 4;
  const arenaBottom = topH - PAD;
  const sprite = clamp(120, (arenaBottom - arenaTop) * 0.32, 210);

  const enemyY = arenaTop + 34;
  const activeY = arenaBottom - sprite - 52;

  // cartas de golpe (deck) — full width, 4 centradas
  const moveGap = 14;
  const moveW = clamp(120, (W - 2 * PAD) / 4 - moveGap, 176);
  const moveH = deckH - 22;
  const deckY = topH + 12;

  // tokens do banco
  const tokW = leftW - 2 * PAD;
  const tokH = 60;
  const tokGap = 8;

  return {
    W, H, PAD, leftW, rightW, deckH, topH, cCx, arenaTop, arenaBottom,
    sprite, enemyY, activeY, moveGap, moveW, moveH, deckY, tokW, tokH, tokGap,
  };
}
type Layout = ReturnType<typeof computeLayout>;

// ── sprite do pokémon (opcional espelhado) ───────────────────────────────
function MonSprite({ mon, cx, y, size, mirrored }: { mon: TablePokemon; cx: number; y: number; size: number; mirrored?: boolean }) {
  const sprite = useHtmlImage(mon.spriteUrl);
  if (!sprite) return null;
  return (
    <KImage
      image={sprite}
      x={mirrored ? cx + size / 2 : cx - size / 2}
      y={y}
      width={size}
      height={size}
      scaleX={mirrored ? -1 : 1}
      opacity={mon.fainted ? 0.35 : 1}
      shadowColor="#000"
      shadowBlur={18}
      shadowOpacity={0.5}
      shadowOffsetY={10}
    />
  );
}

// ── nameplate flutuante ──────────────────────────────────────────────────
function Nameplate({ mon, cx, y, width, tone, titleFont }: { mon: TablePokemon; cx: number; y: number; width: number; tone: "mine" | "enemy"; titleFont: string }) {
  const accent = tone === "mine" ? COLORS.energy : COLORS.enemy;
  const hpPct = Math.max(0, Math.min(1, mon.currentHp / mon.maxHp));
  const x = cx - width / 2;
  return (
    <Group x={x} y={y}>
      <Rect width={width} height={46} fill={COLORS.panel} stroke={COLORS.edge} strokeWidth={1} cornerRadius={4} />
      <Rect width={4} height={46} fill={accent} cornerRadius={2} />
      <Text text={mon.name.toUpperCase()} x={14} y={8} width={width - 84} fontFamily={titleFont} fontSize={17} fill={COLORS.ink} ellipsis wrap="none" />
      <Text text="LV 50" x={width - 66} y={9} width={54} align="right" fontFamily={titleFont} fontSize={13} fill={COLORS.gold} />
      <Rect x={14} y={29} width={width - 28} height={9} fill="#0a0f18" stroke={COLORS.edge} strokeWidth={1} />
      <Rect x={15} y={30} width={(width - 30) * hpPct} height={7} fill={hpColor(mon.currentHp, mon.maxHp)} />
      <Text text={`${mon.currentHp} / ${mon.maxHp}`} x={14} y={28} width={width - 28} align="right" fontSize={9} fontStyle="bold" fill={COLORS.ink} />
    </Group>
  );
}

// ── anel de alvo ─────────────────────────────────────────────────────────
function TargetRing({ cx, cy, r, color, active, label }: { cx: number; cy: number; r: number; color: string; active: boolean; label: string }) {
  return (
    <Group listening={false}>
      <Circle
        x={cx}
        y={cy}
        radius={r + (active ? 14 : 8)}
        stroke={color}
        strokeWidth={active ? 4 : 2}
        dash={active ? undefined : [7, 7]}
        opacity={active ? 0.95 : 0.5}
        shadowColor={color}
        shadowBlur={active ? 24 : 0}
        shadowOpacity={active ? 0.85 : 0}
      />
      <Text x={cx - 90} y={cy + r + 14} width={180} align="center" text={label} fontSize={12} fontStyle="bold" fill={color} opacity={active ? 1 : 0.7} />
    </Group>
  );
}

// ── carta/token arrastável ───────────────────────────────────────────────
function Draggable({
  homeX, homeY, width, height, disabled, dropId, targetRect, onOver, onDropOnTarget, children,
}: {
  homeX: number; homeY: number; width: number; height: number; disabled: boolean;
  dropId: DropId; targetRect: Rect; onOver: (id: DropId | null) => void; onDropOnTarget: () => void; children: React.ReactNode;
}) {
  const ref = useRef<Konva.Group>(null);
  const overRef = useRef(false);
  const box = useCallback(() => {
    const n = ref.current!;
    return { x: n.x(), y: n.y(), width, height };
  }, [width, height]);

  useEffect(() => {
    ref.current?.position({ x: homeX, y: homeY });
  }, [homeX, homeY]);

  return (
    <Group
      ref={ref}
      x={homeX}
      y={homeY}
      draggable={!disabled}
      opacity={disabled ? 0.4 : 1}
      onMouseEnter={(e) => {
        if (disabled) return;
        e.target.getStage()!.container().style.cursor = "grab";
        if (!ref.current?.isDragging()) ref.current?.to({ scaleX: 1.05, scaleY: 1.05, duration: 0.1 });
      }}
      onMouseLeave={(e) => {
        e.target.getStage()!.container().style.cursor = "default";
        if (!ref.current?.isDragging()) ref.current?.to({ scaleX: 1, scaleY: 1, duration: 0.1 });
      }}
      onDragStart={() => {
        ref.current?.moveToTop();
        ref.current?.to({ scaleX: 1.08, scaleY: 1.08, duration: 0.08 });
      }}
      onDragMove={() => {
        const over = Konva.Util.haveIntersection(box(), targetRect);
        if (over !== overRef.current) {
          overRef.current = over;
          onOver(over ? dropId : null);
        }
      }}
      onDragEnd={() => {
        const hit = Konva.Util.haveIntersection(box(), targetRect);
        overRef.current = false;
        onOver(null);
        if (hit) onDropOnTarget();
        ref.current?.to({ x: homeX, y: homeY, scaleX: 1, scaleY: 1, duration: 0.22, easing: Konva.Easings.BackEaseOut });
      }}
    >
      {children}
    </Group>
  );
}

// ── carta de golpe com ARTE ──────────────────────────────────────────────
function MoveCard({ move, w, h, titleFont }: { move: TableMove; w: number; h: number; titleFont: string }) {
  const art = useHtmlImage(moveArtUrl(move.type));
  const tc = typeColor(move.type);
  const artH = h - 68;
  return (
    <>
      <Rect width={w} height={h} fill={COLORS.panel2} stroke={COLORS.edge} strokeWidth={1} cornerRadius={6} shadowColor="#000" shadowBlur={10} shadowOpacity={0.5} shadowOffsetY={4} />
      {art ? (
        <KImage image={art} x={6} y={6} width={w - 12} height={artH} cornerRadius={4} />
      ) : (
        <Rect x={6} y={6} width={w - 12} height={artH} fill="#0d1320" cornerRadius={4} />
      )}
      <Rect x={6} y={6} width={w - 12} height={artH} stroke={COLORS.edge} strokeWidth={1} cornerRadius={4} />
      <Rect x={6} y={artH + 8} width={w - 12} height={3} fill={tc} />
      <Text text={move.name.replace(/-/g, " ").toUpperCase()} x={10} y={artH + 16} width={w - 20} fontFamily={titleFont} fontSize={15} fill={COLORS.ink} ellipsis wrap="none" />
      <Text text={move.type.toUpperCase()} x={10} y={artH + 38} fontSize={10} fontStyle="bold" fill={tc} />
      <Text text={`PODER ${move.power ?? "—"}  ·  ${move.accuracy ?? 100}%`} x={10} y={artH + 52} width={w - 20} fontSize={10} fontStyle="bold" fill={COLORS.inkDim} />
    </>
  );
}

// ── token do banco ───────────────────────────────────────────────────────
function BenchToken({ mon, w, h, titleFont }: { mon: TablePokemon; w: number; h: number; titleFont: string }) {
  const sprite = useHtmlImage(mon.spriteUrl);
  const hpPct = Math.max(0, Math.min(1, mon.currentHp / mon.maxHp));
  const s = h - 22;
  return (
    <>
      <Rect width={w} height={h} fill={COLORS.panel2} stroke={mon.fainted ? COLORS.edge : COLORS.energy} strokeWidth={1} cornerRadius={5} shadowColor="#000" shadowBlur={6} shadowOpacity={0.4} shadowOffsetY={2} />
      {sprite && <KImage image={sprite} x={5} y={4} width={s} height={s} opacity={mon.fainted ? 0.4 : 1} />}
      <Text text={mon.name.toUpperCase()} x={s + 12} y={8} width={w - s - 16} fontFamily={titleFont} fontSize={11} fill={COLORS.ink} wrap="word" lineHeight={1.05} />
      <Rect x={s + 12} y={h - 15} width={w - s - 18} height={5} fill="#0a0f18" stroke={COLORS.edge} strokeWidth={1} />
      <Rect x={s + 13} y={h - 14} width={(w - s - 20) * hpPct} height={3} fill={hpColor(mon.currentHp, mon.maxHp)} />
      <Text text={mon.fainted ? "K.O." : `${mon.currentHp}/${mon.maxHp}`} x={s + 12} y={h - 26} width={w - s - 16} fontSize={9} fontStyle="bold" fill={COLORS.inkDim} />
    </>
  );
}

// ── painel de placar/turno (direita) ─────────────────────────────────────
function InfoPanel({ x, width, H, turnNumber, waiting, needsSwitch, score, titleFont }: {
  x: number; width: number; H: number; turnNumber: number; waiting: boolean; needsSwitch: boolean; score: TableScore; titleFont: string;
}) {
  const statusText = waiting ? "AGUARDANDO INIMIGO" : needsSwitch ? "TROQUE SEU POKÉMON" : "SEU TURNO";
  const statusColor = waiting ? COLORS.inkDim : needsSwitch ? COLORS.warn : COLORS.energy;
  const dot = (n: number, total: number, cy: number, color: string) => (
    <Group y={cy}>
      {Array.from({ length: total }, (_, i) => (
        <Circle key={i} x={16 + i * 18} y={0} radius={6} fill={i < n ? color : "#26324c"} />
      ))}
    </Group>
  );
  return (
    <Group x={x} y={16}>
      <Rect width={width} height={H - 32} fill={COLORS.panel} stroke={COLORS.edge} strokeWidth={1} cornerRadius={6} />
      <Text text="PLACAR" x={16} y={16} fontFamily={titleFont} fontSize={13} fill={COLORS.inkDim} letterSpacing={2} />
      <Text text={`TURNO ${String(turnNumber).padStart(2, "0")}`} x={16} y={38} fontFamily={titleFont} fontSize={28} fill={COLORS.ink} />
      <Rect x={16} y={80} width={width - 32} height={26} fill={COLORS.panel2} cornerRadius={4} />
      <Text text={statusText} x={16} y={87} width={width - 32} align="center" fontSize={12} fontStyle="bold" fill={statusColor} />

      <Text text="INIMIGO" x={16} y={132} fontSize={11} fontStyle="bold" fill={COLORS.enemy} letterSpacing={1} />
      {dot(score.oppAlive, score.oppTotal, 156, COLORS.enemy)}
      <Text text={`${score.oppAlive}/${score.oppTotal} vivos`} x={16} y={168} fontSize={10} fill={COLORS.inkDim} />

      <Text text="VOCÊ" x={16} y={200} fontSize={11} fontStyle="bold" fill={COLORS.energy} letterSpacing={1} />
      {dot(score.myAlive, score.myTotal, 224, COLORS.energy)}
      <Text text={`${score.myAlive}/${score.myTotal} vivos`} x={16} y={236} fontSize={10} fill={COLORS.inkDim} />
    </Group>
  );
}

export default function BattleTable({
  myActive, oppActive, bench, moves, locked, needsSwitch, waiting, turnNumber, score, lastTurnEvents, lastTurnNumber, onAttack, onSwitch,
}: BattleTableProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [overDrop, setOverDrop] = useState<DropId | null>(null);
  const titleFont = useTitleFont();

  const myMonRef = useRef<Konva.Group>(null);
  const oppMonRef = useRef<Konva.Group>(null);
  const fxLayerRef = useRef<Konva.Layer>(null);
  const animatedTurnRef = useRef(0);
  const posRef = useRef({ enemyCx: 0, enemyY: 0, activeCx: 0, activeY: 0 });

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // hit graph pode ficar stale quando o Stage muda de tamanho
  useEffect(() => {
    stageRef.current?.getLayers().forEach((l) => l.drawHit());
  }, [size]);

  // ── animações do turno (avanço, tremor, dano flutuante) ────────────────
  useEffect(() => {
    if (!lastTurnEvents || lastTurnNumber === animatedTurnRef.current) return;
    if (posRef.current.enemyY === 0) return;
    animatedTurnRef.current = lastTurnNumber;
    const P = posRef.current;

    const spawnDamage = (targetMine: boolean, ev: TableAttackEvent, delay: number) => {
      const layer = fxLayerRef.current;
      if (!layer) return;
      const cx = targetMine ? P.activeCx : P.enemyCx;
      const cy = targetMine ? P.activeY : P.enemyY;
      const label = ev.missed ? "ERROU" : `-${ev.damage}${ev.isCrit ? " CRIT!" : ""}`;
      const color = ev.missed ? COLORS.inkDim : ev.isCrit ? COLORS.gold : ev.effectiveness > 1 ? COLORS.ok : COLORS.ink;
      window.setTimeout(() => {
        const text = new Konva.Text({ x: cx - 60, y: cy + 20, width: 120, align: "center", text: label, fontFamily: titleFont, fontSize: ev.isCrit ? 32 : 26, fill: color, shadowColor: "#000", shadowBlur: 6, shadowOpacity: 0.8 });
        layer.add(text);
        text.to({ y: cy - 24, opacity: 0, duration: 0.9, easing: Konva.Easings.EaseOut, onFinish: () => text.destroy() });
      }, delay);
    };

    lastTurnEvents.forEach((ev, i) => {
      const delay = i * 550;
      const attacker = ev.bySide === "mine" ? myMonRef.current : oppMonRef.current;
      const target = ev.bySide === "mine" ? oppMonRef.current : myMonRef.current;
      const baseY = ev.bySide === "mine" ? P.activeY : P.enemyY;
      const dir = ev.bySide === "mine" ? -1 : 1;
      window.setTimeout(() => {
        attacker?.to({ y: baseY + dir * 42, duration: 0.14, easing: Konva.Easings.EaseIn, onFinish: () => attacker?.to({ y: baseY, duration: 0.2, easing: Konva.Easings.BackEaseOut }) });
      }, delay);
      if (!ev.missed) {
        window.setTimeout(() => {
          target?.to({ x: -9, duration: 0.05, onFinish: () => target?.to({ x: 9, duration: 0.05, onFinish: () => target?.to({ x: 0, duration: 0.06 }) }) });
        }, delay + 150);
      }
      spawnDamage(ev.bySide === "enemy", ev, delay + 170);
    });
  }, [lastTurnEvents, lastTurnNumber, titleFont]);

  const canAttack = !locked && !needsSwitch;
  const { w: W, h: H } = size;

  const L: Layout | null = W > 0 && H > 0 ? computeLayout(W, H) : null;

  // posições dos sprites pras animações lerem (fora do render)
  useEffect(() => {
    if (!L) return;
    posRef.current = { enemyCx: L.cCx, enemyY: L.enemyY, activeCx: L.cCx, activeY: L.activeY };
  }, [L]);

  return (
    <div ref={containerRef} className="h-full w-full">
      {L && (
        <Stage ref={stageRef} width={W} height={H}>
          {/* fundo / cenário */}
          <Layer listening={false}>
            <Rect width={W} height={H} fill={COLORS.table} />
            {/* faixas das regiões */}
            <Rect x={0} y={0} width={L.leftW} height={L.topH} fill={COLORS.bg} opacity={0.4} />
            <Rect x={W - L.rightW} y={0} width={L.rightW} height={L.topH} fill={COLORS.bg} opacity={0.4} />
            <Rect x={0} y={L.topH} width={W} height={L.deckH} fill={COLORS.bg} opacity={0.55} />
            {/* plataformas sob os pokémon */}
            <Circle x={L.cCx} y={L.enemyY + L.sprite - 6} radius={L.sprite * 0.66} scaleY={0.26} fill="#0a0f1a" />
            <Circle x={L.cCx} y={L.activeY + L.sprite - 6} radius={L.sprite * 0.66} scaleY={0.26} fill="#0a0f1a" />
            {/* divisor da arena */}
            <Rect x={L.leftW + L.PAD} y={(L.enemyY + L.activeY + L.sprite) / 2} width={W - L.leftW - L.rightW - 2 * L.PAD} height={1} fill={COLORS.edge} opacity={0.6} />
            {/* rótulos das regiões */}
            <Text text="SEU BANCO" x={0} y={L.PAD} width={L.leftW} align="center" fontFamily={titleFont} fontSize={12} fill={COLORS.inkDim} />
            <Text text="SEUS GOLPES — arraste um pra cima do inimigo pra atacar" x={0} y={L.topH + 6} width={W} align="center" fontSize={12} fontStyle="bold" fill={COLORS.inkDim} opacity={canAttack ? 0.9 : 0.35} />
          </Layer>

          {/* arena + interação */}
          <Layer>
            <Group ref={oppMonRef}>
              <MonSprite mon={oppActive} cx={L.cCx} y={L.enemyY} size={L.sprite} mirrored />
            </Group>
            <Group ref={myMonRef}>
              <MonSprite mon={myActive} cx={L.cCx} y={L.activeY} size={L.sprite} />
            </Group>

            {canAttack && (
              <TargetRing cx={L.cCx} cy={L.enemyY + L.sprite / 2} r={L.sprite / 2} color={COLORS.enemy} active={overDrop === "enemy"} label={overDrop === "enemy" ? "SOLTAR PRA ATACAR" : "ALVO"} />
            )}
            {!locked && needsSwitch && (
              <TargetRing cx={L.cCx} cy={L.activeY + L.sprite / 2} r={L.sprite / 2} color={COLORS.energy} active={overDrop === "mine"} label={overDrop === "mine" ? "SOLTAR PRA ENTRAR" : "TROQUE AQUI"} />
            )}

            <Nameplate mon={oppActive} cx={L.cCx} y={L.enemyY - 26} width={Math.min(320, (W - L.leftW - L.rightW) * 0.5)} tone="enemy" titleFont={titleFont} />
            <Nameplate mon={myActive} cx={L.cCx} y={L.activeY + L.sprite + 4} width={Math.min(320, (W - L.leftW - L.rightW) * 0.5)} tone="mine" titleFont={titleFont} />

            {/* banco (esquerda) — arrasta pro seu ativo */}
            {bench.map((mon, i) => (
              <Draggable
                key={mon.slot}
                homeX={L.PAD}
                homeY={L.arenaTop + 28 + i * (L.tokH + L.tokGap)}
                width={L.tokW}
                height={L.tokH}
                disabled={locked || mon.fainted}
                dropId="mine"
                targetRect={{ x: L.cCx - L.sprite * 0.75, y: L.activeY - 16, width: L.sprite * 1.5, height: L.sprite + 60 }}
                onOver={setOverDrop}
                onDropOnTarget={() => onSwitch(mon.slot)}
              >
                <BenchToken mon={mon} w={L.tokW} h={L.tokH} titleFont={titleFont} />
              </Draggable>
            ))}

            {/* deck (baixo) — arrasta pro inimigo */}
            {!needsSwitch &&
              (() => {
                const total = moves.length * L.moveW + (moves.length - 1) * L.moveGap;
                const startX = W / 2 - total / 2;
                return moves.map((move, i) => (
                  <Draggable
                    key={`${move.name}-${i}`}
                    homeX={startX + i * (L.moveW + L.moveGap)}
                    homeY={L.deckY}
                    width={L.moveW}
                    height={L.moveH}
                    disabled={locked}
                    dropId="enemy"
                    targetRect={{ x: L.cCx - L.sprite * 0.75, y: L.enemyY - 20, width: L.sprite * 1.5, height: L.sprite + 60 }}
                    onOver={setOverDrop}
                    onDropOnTarget={() => onAttack(i)}
                  >
                    <MoveCard move={move} w={L.moveW} h={L.moveH} titleFont={titleFont} />
                  </Draggable>
                ));
              })()}

            {/* placar (direita) */}
            <InfoPanel x={W - L.rightW + L.PAD} width={L.rightW - 2 * L.PAD} H={L.topH} turnNumber={turnNumber} waiting={waiting} needsSwitch={needsSwitch} score={score} titleFont={titleFont} />
          </Layer>

          {/* efeitos */}
          <Layer ref={fxLayerRef} listening={false} />
        </Stage>
      )}
    </div>
  );
}
