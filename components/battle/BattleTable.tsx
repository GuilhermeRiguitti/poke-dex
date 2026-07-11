"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Konva from "konva";
import { Group, Image as KImage, Layer, Rect, Stage, Text } from "react-konva";
import { typeColor } from "@/lib/typeColors";
import { useHtmlImage } from "./useHtmlImage";

// ── mesa em coordenadas de design (escalada pro container) ──────────────
const TABLE_W = 900;
const TABLE_H = 600;

const CARD_W = 170;
const CARD_H = 220;
const ENEMY_POS = { x: TABLE_W / 2 - CARD_W / 2, y: 36 };
const ACTIVE_POS = { x: TABLE_W / 2 - CARD_W / 2, y: 290 };

const MOVE_W = 150;
const MOVE_H = 72;
const HAND_Y = TABLE_H - MOVE_H - 14;

const BENCH_W = 92;
const BENCH_H = 118;
const BENCH_X = 18;

const COLORS = {
  table: "#131a27",
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

interface BattleTableProps {
  myActive: TablePokemon;
  oppActive: TablePokemon;
  bench: TablePokemon[]; // meus não-ativos (inclui desmaiados, que ficam travados)
  moves: TableMove[];
  /** trava toda interação (aguardando oponente / enviando / partida encerrada) */
  locked: boolean;
  /** ativo desmaiado: só troca é válida */
  needsSwitch: boolean;
  /** eventos do último turno, pra animação de dano — null enquanto não há */
  lastTurnEvents: TableAttackEvent[] | null;
  lastTurnNumber: number;
  onAttack: (moveSlot: number) => void;
  onSwitch: (slot: number) => void;
}

function hpColor(current: number, max: number): string {
  const pct = (current / max) * 100;
  return pct > 50 ? COLORS.ok : pct > 20 ? COLORS.warn : COLORS.bad;
}

/** Fonte display real (next/font injeta o nome com hash na CSS var).
 *  Este componente só carrega no client (dynamic ssr:false), então dá pra
 *  ler o DOM direto no inicializador do estado. */
function useTitleFont(): string {
  const [font] = useState(() => {
    const value = getComputedStyle(document.documentElement)
      .getPropertyValue("--font-anton")
      .trim();
    return value ? value.replace(/["']/g, "").split(",")[0] : "sans-serif";
  });
  return font;
}

// ── carta de pokémon (ativo/inimigo) ─────────────────────────────────────
function PokemonCard({
  mon,
  x,
  y,
  tone,
  mirrored,
  titleFont,
}: {
  mon: TablePokemon;
  x: number;
  y: number;
  tone: "mine" | "enemy";
  mirrored?: boolean;
  titleFont: string;
}) {
  const sprite = useHtmlImage(mon.spriteUrl);
  const accent = tone === "mine" ? COLORS.energy : COLORS.enemy;
  const hpPct = Math.max(0, Math.min(1, mon.currentHp / mon.maxHp));

  return (
    <Group x={x} y={y} opacity={mon.fainted ? 0.45 : 1}>
      <Rect
        width={CARD_W}
        height={CARD_H}
        fill={COLORS.panel2}
        stroke={COLORS.edge}
        strokeWidth={1}
        cornerRadius={4}
        shadowColor="#000"
        shadowBlur={12}
        shadowOpacity={0.5}
        shadowOffsetY={5}
      />
      <Rect width={CARD_W} height={4} fill={typeColor(mon.types[0] ?? "normal")} cornerRadius={2} />
      <Rect x={0} y={CARD_H - 3} width={CARD_W} height={3} fill={accent} />
      {sprite && (
        <KImage
          image={sprite}
          x={mirrored ? CARD_W - 20 : 20}
          y={26}
          width={130}
          height={130}
          scaleX={mirrored ? -1 : 1}
        />
      )}
      {mon.fainted && (
        <Text
          text="✗"
          x={0}
          y={60}
          width={CARD_W}
          align="center"
          fontSize={64}
          fill={COLORS.bad}
        />
      )}
      <Text
        text={mon.name.toUpperCase()}
        x={8}
        y={160}
        width={CARD_W - 16}
        fontFamily={titleFont}
        fontSize={17}
        fill={COLORS.ink}
        ellipsis
        wrap="none"
      />
      <Text
        text={mon.types.join(" / ").toUpperCase()}
        x={8}
        y={180}
        fontSize={10}
        fontStyle="bold"
        fill={COLORS.inkDim}
      />
      {/* barra de HP */}
      <Rect x={8} y={196} width={CARD_W - 16} height={9} fill="#0b0f16" stroke={COLORS.edge} strokeWidth={1} />
      <Rect x={9} y={197} width={(CARD_W - 18) * hpPct} height={7} fill={hpColor(mon.currentHp, mon.maxHp)} />
      <Text
        text={`${mon.currentHp}/${mon.maxHp}`}
        x={8}
        y={207}
        width={CARD_W - 16}
        align="right"
        fontSize={10}
        fontStyle="bold"
        fill={COLORS.inkDim}
      />
    </Group>
  );
}

// ── carta arrastável genérica (move ou banco) ────────────────────────────
function DraggableCard({
  homeX,
  homeY,
  disabled,
  onDropOnTarget,
  targetRect,
  children,
  width,
  height,
}: {
  homeX: number;
  homeY: number;
  disabled: boolean;
  targetRect: { x: number; y: number; width: number; height: number };
  onDropOnTarget: () => void;
  children: React.ReactNode;
  width: number;
  height: number;
}) {
  const ref = useRef<Konva.Group>(null);

  const springHome = useCallback(() => {
    ref.current?.to({
      x: homeX,
      y: homeY,
      scaleX: 1,
      scaleY: 1,
      duration: 0.22,
      easing: Konva.Easings.BackEaseOut,
    });
  }, [homeX, homeY]);

  // se a "casa" da carta mudar (ex: banco reordenado), reposiciona
  useEffect(() => {
    ref.current?.position({ x: homeX, y: homeY });
  }, [homeX, homeY]);

  return (
    <Group
      ref={ref}
      x={homeX}
      y={homeY}
      draggable={!disabled}
      opacity={disabled ? 0.45 : 1}
      onMouseEnter={(e) => {
        if (disabled) return;
        e.target.getStage()!.container().style.cursor = "grab";
        ref.current?.to({ scaleX: 1.05, scaleY: 1.05, duration: 0.1 });
      }}
      onMouseLeave={(e) => {
        e.target.getStage()!.container().style.cursor = "default";
        if (!ref.current?.isDragging()) {
          ref.current?.to({ scaleX: 1, scaleY: 1, duration: 0.1 });
        }
      }}
      onDragStart={() => {
        ref.current?.moveToTop();
        ref.current?.to({ scaleX: 1.08, scaleY: 1.08, duration: 0.08 });
      }}
      onDragEnd={() => {
        const node = ref.current;
        if (!node) return;
        const box = { x: node.x(), y: node.y(), width, height };
        if (Konva.Util.haveIntersection(box, targetRect)) {
          onDropOnTarget();
        }
        springHome();
      }}
    >
      {children}
    </Group>
  );
}

export default function BattleTable({
  myActive,
  oppActive,
  bench,
  moves,
  locked,
  needsSwitch,
  lastTurnEvents,
  lastTurnNumber,
  onAttack,
  onSwitch,
}: BattleTableProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const [scale, setScale] = useState(1);
  const titleFont = useTitleFont();

  const myCardRef = useRef<Konva.Group>(null);
  const oppCardRef = useRef<Konva.Group>(null);
  const fxLayerRef = useRef<Konva.Layer>(null);
  const animatedTurnRef = useRef(0);

  // escala responsiva
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setScale(el.clientWidth / TABLE_W);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // O hit canvas do Konva fica stale quando o Stage muda de tamanho/escala
  // depois do primeiro draw — sem isso, cliques e drags erram o alvo.
  useEffect(() => {
    stageRef.current?.getLayers().forEach((layer) => layer.drawHit());
  }, [scale]);

  // ── animações predefinidas do turno: lunge, shake e dano flutuante ─────
  useEffect(() => {
    if (!lastTurnEvents || lastTurnNumber === animatedTurnRef.current) return;
    animatedTurnRef.current = lastTurnNumber;

    const spawnDamageText = (targetMine: boolean, ev: TableAttackEvent, delay: number) => {
      const layer = fxLayerRef.current;
      if (!layer) return;
      const pos = targetMine ? ACTIVE_POS : ENEMY_POS;
      const label = ev.missed
        ? "MISS"
        : `-${ev.damage}${ev.isCrit ? " CRIT!" : ""}`;
      const color = ev.missed
        ? COLORS.inkDim
        : ev.isCrit
          ? COLORS.gold
          : ev.effectiveness > 1
            ? COLORS.ok
            : COLORS.ink;
      window.setTimeout(() => {
        const text = new Konva.Text({
          x: pos.x + CARD_W / 2 - 50,
          y: pos.y + 40,
          width: 100,
          align: "center",
          text: label,
          fontFamily: titleFont,
          fontSize: ev.isCrit ? 30 : 24,
          fill: color,
          shadowColor: "#000",
          shadowBlur: 6,
          shadowOpacity: 0.7,
        });
        layer.add(text);
        text.to({
          y: pos.y - 20,
          opacity: 0,
          duration: 0.9,
          easing: Konva.Easings.EaseOut,
          onFinish: () => text.destroy(),
        });
      }, delay);
    };

    lastTurnEvents.forEach((ev, i) => {
      const delay = i * 550;
      const attacker = ev.bySide === "mine" ? myCardRef.current : oppCardRef.current;
      const target = ev.bySide === "mine" ? oppCardRef.current : myCardRef.current;
      const dir = ev.bySide === "mine" ? -1 : 1;

      // avanço do atacante
      window.setTimeout(() => {
        attacker?.to({
          y: (ev.bySide === "mine" ? ACTIVE_POS.y : ENEMY_POS.y) + dir * 46,
          duration: 0.14,
          easing: Konva.Easings.EaseIn,
          onFinish: () =>
            attacker?.to({
              y: ev.bySide === "mine" ? ACTIVE_POS.y : ENEMY_POS.y,
              duration: 0.2,
              easing: Konva.Easings.BackEaseOut,
            }),
        });
      }, delay);

      // tremor do alvo (só se acertou)
      if (!ev.missed) {
        window.setTimeout(() => {
          const baseX = ev.bySide === "mine" ? ENEMY_POS.x : ACTIVE_POS.x;
          target?.to({
            x: baseX - 9,
            duration: 0.05,
            onFinish: () =>
              target?.to({
                x: baseX + 9,
                duration: 0.05,
                onFinish: () => target?.to({ x: baseX, duration: 0.06 }),
              }),
          });
        }, delay + 150);
      }

      spawnDamageText(ev.bySide === "enemy", ev, delay + 170);
    });
  }, [lastTurnEvents, lastTurnNumber, titleFont]);

  // zonas de drop (coordenadas de design)
  const enemyRect = { x: ENEMY_POS.x, y: ENEMY_POS.y, width: CARD_W, height: CARD_H };
  const activeRect = { x: ACTIVE_POS.x, y: ACTIVE_POS.y, width: CARD_W, height: CARD_H };

  // mão de moves centralizada
  const handStartX = useMemo(() => {
    const total = moves.length * MOVE_W + (moves.length - 1) * 12;
    return TABLE_W / 2 - total / 2;
  }, [moves.length]);

  const benchSwitchable = bench.filter((b) => !b.fainted);

  return (
    <div ref={containerRef} className="clip-card w-full overflow-hidden border border-edge">
      <Stage ref={stageRef} width={TABLE_W * scale} height={TABLE_H * scale} scaleX={scale} scaleY={scale}>
        {/* mesa */}
        <Layer listening={false}>
          <Rect width={TABLE_W} height={TABLE_H} fill={COLORS.table} />
          {/* linha central da arena */}
          <Rect x={0} y={TABLE_H / 2 - 39} width={TABLE_W} height={1} fill={COLORS.edge} />
          <Text
            text="ARENA"
            x={TABLE_W - 84}
            y={TABLE_H / 2 - 34}
            fontFamily={titleFont}
            fontSize={13}
            fill={COLORS.edge}
          />
          {/* zona do banco */}
          <Text
            text="BANCO"
            x={BENCH_X}
            y={8}
            fontFamily={titleFont}
            fontSize={13}
            fill={COLORS.edge}
          />
          {/* hint contextual */}
          <Text
            text={
              locked
                ? ""
                : needsSwitch
                  ? "Arraste uma carta do banco até o seu slot pra trocar"
                  : "Arraste uma carta de golpe até o inimigo pra atacar"
            }
            x={0}
            y={TABLE_H / 2 - 14}
            width={TABLE_W}
            align="center"
            fontSize={13}
            fontStyle="bold"
            fill={COLORS.inkDim}
            opacity={0.8}
          />
        </Layer>

        <Layer>
          {/* inimigo */}
          <Group ref={oppCardRef} x={ENEMY_POS.x} y={ENEMY_POS.y}>
            <PokemonCard mon={oppActive} x={0} y={0} tone="enemy" mirrored titleFont={titleFont} />
          </Group>

          {/* meu ativo (zona de drop de troca) */}
          <Group ref={myCardRef} x={ACTIVE_POS.x} y={ACTIVE_POS.y}>
            {needsSwitch && (
              <Rect
                x={-5}
                y={-5}
                width={CARD_W + 10}
                height={CARD_H + 10}
                stroke={COLORS.energy}
                strokeWidth={2}
                dash={[8, 6]}
                cornerRadius={6}
              />
            )}
            <PokemonCard mon={myActive} x={0} y={0} tone="mine" titleFont={titleFont} />
          </Group>

          {/* banco (esquerda) */}
          {bench.map((mon, i) => (
            <DraggableCard
              key={mon.slot}
              homeX={BENCH_X}
              homeY={28 + i * (BENCH_H + 10)}
              width={BENCH_W}
              height={BENCH_H}
              disabled={locked || mon.fainted}
              targetRect={activeRect}
              onDropOnTarget={() => onSwitch(mon.slot)}
            >
              <BenchCard mon={mon} titleFont={titleFont} />
            </DraggableCard>
          ))}

          {/* mão de golpes */}
          {!needsSwitch &&
            moves.map((move, i) => (
              <DraggableCard
                key={`${move.name}-${i}`}
                homeX={handStartX + i * (MOVE_W + 12)}
                homeY={HAND_Y}
                width={MOVE_W}
                height={MOVE_H}
                disabled={locked}
                targetRect={enemyRect}
                onDropOnTarget={() => onAttack(i)}
              >
                <MoveCard move={move} titleFont={titleFont} />
              </DraggableCard>
            ))}
        </Layer>

        {/* camada de efeitos (números de dano) */}
        <Layer ref={fxLayerRef} listening={false} />
      </Stage>
    </div>
  );
}

function BenchCard({ mon, titleFont }: { mon: TablePokemon; titleFont: string }) {
  const sprite = useHtmlImage(mon.spriteUrl);
  return (
    <>
      <Rect
        width={BENCH_W}
        height={BENCH_H}
        fill={COLORS.panel2}
        stroke={mon.fainted ? COLORS.edge : COLORS.energy}
        strokeWidth={1}
        cornerRadius={4}
        shadowColor="#000"
        shadowBlur={8}
        shadowOpacity={0.4}
        shadowOffsetY={3}
      />
      {sprite && <KImage image={sprite} x={13} y={8} width={66} height={66} />}
      <Text
        text={mon.name.toUpperCase()}
        x={4}
        y={78}
        width={BENCH_W - 8}
        align="center"
        fontFamily={titleFont}
        fontSize={10}
        fill={COLORS.ink}
        ellipsis
        wrap="none"
      />
      <Rect x={6} y={94} width={BENCH_W - 12} height={6} fill="#0b0f16" stroke={COLORS.edge} strokeWidth={1} />
      <Rect
        x={7}
        y={95}
        width={(BENCH_W - 14) * Math.max(0, Math.min(1, mon.currentHp / mon.maxHp))}
        height={4}
        fill={hpColor(mon.currentHp, mon.maxHp)}
      />
      <Text
        text={mon.fainted ? "K.O." : `${mon.currentHp}/${mon.maxHp}`}
        x={4}
        y={103}
        width={BENCH_W - 8}
        align="center"
        fontSize={9}
        fontStyle="bold"
        fill={COLORS.inkDim}
      />
    </>
  );
}

function MoveCard({ move, titleFont }: { move: TableMove; titleFont: string }) {
  return (
    <>
      <Rect
        width={MOVE_W}
        height={MOVE_H}
        fill={COLORS.panel2}
        stroke={COLORS.edge}
        strokeWidth={1}
        cornerRadius={4}
        shadowColor="#000"
        shadowBlur={8}
        shadowOpacity={0.4}
        shadowOffsetY={3}
      />
      <Rect width={4} height={MOVE_H} fill={typeColor(move.type)} cornerRadius={2} />
      <Text
        text={move.name.replace(/-/g, " ").toUpperCase()}
        x={12}
        y={12}
        width={MOVE_W - 20}
        fontFamily={titleFont}
        fontSize={14}
        fill={COLORS.ink}
        ellipsis
        wrap="none"
      />
      <Text
        text={`${move.type.toUpperCase()} · PODER ${move.power ?? "—"} · ${move.accuracy ?? 100}%`}
        x={12}
        y={40}
        width={MOVE_W - 20}
        fontSize={9}
        fontStyle="bold"
        fill={COLORS.inkDim}
      />
    </>
  );
}
