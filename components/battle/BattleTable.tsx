"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Konva from "konva";
import { Circle, Group, Image as KImage, Layer, Rect, Stage, Text } from "react-konva";
import { typeColor } from "@/lib/typeColors";
import { moveArtUrl } from "@/lib/storage";
import { useHtmlImage } from "./useHtmlImage";

// ── mesa em coordenadas de design (escalada pro container) ──────────────
const TABLE_W = 900;
const TABLE_H = 620;

// pokémon vivem no centro como SPRITES (não são mais cartas)
const SPRITE = 132;
const ENEMY = { cx: TABLE_W / 2, y: 32 };
const MINE = { cx: TABLE_W / 2, y: 182 };
// zonas de drop generosas (aim assist) em volta de cada sprite
const ENEMY_DROP = { x: TABLE_W / 2 - 105, y: 24, width: 210, height: 156 };
const MINE_DROP = { x: TABLE_W / 2 - 105, y: 174, width: 210, height: 156 };

// cartas de golpe (formato retrato, com arte)
const MOVE_W = 150;
const MOVE_H = 172;
const MOVE_GAP = 14;
const HAND_Y = TABLE_H - MOVE_H - 12;

// tokens do banco (tray horizontal)
const TOK_W = 78;
const TOK_H = 66;
const TOK_GAP = 8;
const BENCH_Y = 350;

const COLORS = {
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

interface BattleTableProps {
  myActive: TablePokemon;
  oppActive: TablePokemon;
  bench: TablePokemon[];
  moves: TableMove[];
  locked: boolean;
  needsSwitch: boolean;
  lastTurnEvents: TableAttackEvent[] | null;
  lastTurnNumber: number;
  onAttack: (moveSlot: number) => void;
  onSwitch: (slot: number) => void;
}

type DropId = "enemy" | "mine";

function hpColor(current: number, max: number): string {
  const pct = (current / max) * 100;
  return pct > 50 ? COLORS.ok : pct > 20 ? COLORS.warn : COLORS.bad;
}

/** Fonte display real (next/font injeta o nome com hash na CSS var). */
function useTitleFont(): string {
  const [font] = useState(() => {
    const value = getComputedStyle(document.documentElement)
      .getPropertyValue("--font-anton")
      .trim();
    return value ? value.replace(/["']/g, "").split(",")[0] : "sans-serif";
  });
  return font;
}

// ── nameplate flutuante (nome + Lv + barra de HP), sem moldura de carta ──
function Nameplate({
  mon,
  x,
  y,
  tone,
  titleFont,
}: {
  mon: TablePokemon;
  x: number;
  y: number;
  tone: "mine" | "enemy";
  titleFont: string;
}) {
  const W = 300;
  const accent = tone === "mine" ? COLORS.energy : COLORS.enemy;
  const hpPct = Math.max(0, Math.min(1, mon.currentHp / mon.maxHp));
  return (
    <Group x={x - W / 2} y={y}>
      <Rect width={W} height={44} fill={COLORS.panel} stroke={COLORS.edge} strokeWidth={1} cornerRadius={4} />
      <Rect width={4} height={44} fill={accent} cornerRadius={2} />
      <Text
        text={mon.name.toUpperCase()}
        x={14}
        y={8}
        width={W - 90}
        fontFamily={titleFont}
        fontSize={17}
        fill={COLORS.ink}
        ellipsis
        wrap="none"
      />
      <Text
        text="LV 50"
        x={W - 70}
        y={9}
        width={58}
        align="right"
        fontFamily={titleFont}
        fontSize={13}
        fill={COLORS.gold}
      />
      <Rect x={14} y={28} width={W - 28} height={9} fill="#0a0f18" stroke={COLORS.edge} strokeWidth={1} />
      <Rect x={15} y={29} width={(W - 30) * hpPct} height={7} fill={hpColor(mon.currentHp, mon.maxHp)} />
      <Text
        text={`${mon.currentHp} / ${mon.maxHp}`}
        x={14}
        y={27}
        width={W - 28}
        align="right"
        fontSize={9}
        fontStyle="bold"
        fill={COLORS.ink}
      />
    </Group>
  );
}

// sprite do pokémon "vivo" no centro (opcional espelhado)
function MonSprite({
  mon,
  cx,
  y,
  mirrored,
}: {
  mon: TablePokemon;
  cx: number;
  y: number;
  mirrored?: boolean;
}) {
  const sprite = useHtmlImage(mon.spriteUrl);
  if (!sprite) return null;
  return (
    <KImage
      image={sprite}
      x={mirrored ? cx + SPRITE / 2 : cx - SPRITE / 2}
      y={y}
      width={SPRITE}
      height={SPRITE}
      scaleX={mirrored ? -1 : 1}
      opacity={mon.fainted ? 0.35 : 1}
      shadowColor="#000"
      shadowBlur={16}
      shadowOpacity={0.5}
      shadowOffsetY={8}
    />
  );
}

// anel de alvo em volta de um sprite (dashed = dica; solid+glow = arrastando por cima)
function TargetRing({
  cx,
  y,
  color,
  active,
  label,
}: {
  cx: number;
  y: number;
  color: string;
  active: boolean;
  label: string;
}) {
  return (
    <Group listening={false}>
      <Circle
        x={cx}
        y={y + SPRITE / 2}
        radius={SPRITE / 2 + (active ? 16 : 10)}
        stroke={color}
        strokeWidth={active ? 4 : 2}
        dash={active ? undefined : [7, 7]}
        opacity={active ? 0.95 : 0.5}
        shadowColor={color}
        shadowBlur={active ? 22 : 0}
        shadowOpacity={active ? 0.8 : 0}
      />
      <Text
        x={cx - 80}
        y={y + SPRITE + 6}
        width={160}
        align="center"
        text={label}
        fontSize={12}
        fontStyle="bold"
        fill={color}
        opacity={active ? 1 : 0.7}
      />
    </Group>
  );
}

// ── carta/token arrastável genérico ──────────────────────────────────────
function Draggable({
  homeX,
  homeY,
  width,
  height,
  disabled,
  dropId,
  targetRect,
  onOver,
  onDropOnTarget,
  children,
}: {
  homeX: number;
  homeY: number;
  width: number;
  height: number;
  disabled: boolean;
  dropId: DropId;
  targetRect: { x: number; y: number; width: number; height: number };
  onOver: (id: DropId | null) => void;
  onDropOnTarget: () => void;
  children: React.ReactNode;
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
        ref.current?.to({
          x: homeX,
          y: homeY,
          scaleX: 1,
          scaleY: 1,
          duration: 0.22,
          easing: Konva.Easings.BackEaseOut,
        });
      }}
    >
      {children}
    </Group>
  );
}

// carta de golpe com ARTE
function MoveCard({ move, titleFont }: { move: TableMove; titleFont: string }) {
  const art = useHtmlImage(moveArtUrl(move.type));
  const tc = typeColor(move.type);
  const artH = 100;
  return (
    <>
      <Rect
        width={MOVE_W}
        height={MOVE_H}
        fill={COLORS.panel2}
        stroke={COLORS.edge}
        strokeWidth={1}
        cornerRadius={6}
        shadowColor="#000"
        shadowBlur={10}
        shadowOpacity={0.5}
        shadowOffsetY={4}
      />
      {/* arte */}
      {art ? (
        <KImage image={art} x={6} y={6} width={MOVE_W - 12} height={artH} cornerRadius={4} />
      ) : (
        <Rect x={6} y={6} width={MOVE_W - 12} height={artH} fill="#0d1320" cornerRadius={4} />
      )}
      <Rect x={6} y={6} width={MOVE_W - 12} height={artH} stroke={COLORS.edge} strokeWidth={1} cornerRadius={4} />
      {/* faixa do tipo */}
      <Rect x={6} y={artH + 2} width={MOVE_W - 12} height={3} fill={tc} />
      {/* nome */}
      <Text
        text={move.name.replace(/-/g, " ").toUpperCase()}
        x={10}
        y={artH + 12}
        width={MOVE_W - 20}
        fontFamily={titleFont}
        fontSize={15}
        fill={COLORS.ink}
        ellipsis
        wrap="none"
      />
      {/* tipo badge + stats */}
      <Text
        text={move.type.toUpperCase()}
        x={10}
        y={artH + 34}
        fontSize={10}
        fontStyle="bold"
        fill={tc}
      />
      <Text
        text={`PODER ${move.power ?? "—"}  ·  ${move.accuracy ?? 100}%`}
        x={10}
        y={artH + 50}
        width={MOVE_W - 20}
        fontSize={10}
        fontStyle="bold"
        fill={COLORS.inkDim}
      />
    </>
  );
}

// token pequeno do banco
function BenchToken({ mon, titleFont }: { mon: TablePokemon; titleFont: string }) {
  const sprite = useHtmlImage(mon.spriteUrl);
  const hpPct = Math.max(0, Math.min(1, mon.currentHp / mon.maxHp));
  return (
    <>
      <Rect
        width={TOK_W}
        height={TOK_H}
        fill={COLORS.panel2}
        stroke={mon.fainted ? COLORS.edge : COLORS.energy}
        strokeWidth={1}
        cornerRadius={5}
        shadowColor="#000"
        shadowBlur={6}
        shadowOpacity={0.4}
        shadowOffsetY={2}
      />
      {sprite && <KImage image={sprite} x={7} y={2} width={40} height={40} opacity={mon.fainted ? 0.4 : 1} />}
      <Text
        text={mon.name.toUpperCase()}
        x={48}
        y={8}
        width={TOK_W - 50}
        fontFamily={titleFont}
        fontSize={9}
        fill={COLORS.ink}
        ellipsis
        wrap="char"
        lineHeight={1.1}
      />
      <Rect x={7} y={46} width={TOK_W - 14} height={5} fill="#0a0f18" stroke={COLORS.edge} strokeWidth={1} />
      <Rect x={8} y={47} width={(TOK_W - 16) * hpPct} height={3} fill={hpColor(mon.currentHp, mon.maxHp)} />
      <Text
        text={mon.fainted ? "K.O." : `${mon.currentHp}/${mon.maxHp}`}
        x={7}
        y={53}
        width={TOK_W - 14}
        align="center"
        fontSize={8}
        fontStyle="bold"
        fill={COLORS.inkDim}
      />
    </>
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
  const [overDrop, setOverDrop] = useState<DropId | null>(null);
  const titleFont = useTitleFont();

  const myMonRef = useRef<Konva.Group>(null);
  const oppMonRef = useRef<Konva.Group>(null);
  const fxLayerRef = useRef<Konva.Layer>(null);
  const animatedTurnRef = useRef(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setScale(el.clientWidth / TABLE_W);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // hit canvas fica stale quando o Stage reescala — redesenhar senão o drag erra o alvo
  useEffect(() => {
    stageRef.current?.getLayers().forEach((layer) => layer.drawHit());
  }, [scale]);

  // ── animações do turno: avanço, tremor e dano flutuante ────────────────
  useEffect(() => {
    if (!lastTurnEvents || lastTurnNumber === animatedTurnRef.current) return;
    animatedTurnRef.current = lastTurnNumber;

    const spawnDamage = (targetMine: boolean, ev: TableAttackEvent, delay: number) => {
      const layer = fxLayerRef.current;
      if (!layer) return;
      const anchor = targetMine ? MINE : ENEMY;
      const label = ev.missed ? "ERROU" : `-${ev.damage}${ev.isCrit ? " CRIT!" : ""}`;
      const color = ev.missed
        ? COLORS.inkDim
        : ev.isCrit
          ? COLORS.gold
          : ev.effectiveness > 1
            ? COLORS.ok
            : COLORS.ink;
      window.setTimeout(() => {
        const text = new Konva.Text({
          x: anchor.cx - 60,
          y: anchor.y + 30,
          width: 120,
          align: "center",
          text: label,
          fontFamily: titleFont,
          fontSize: ev.isCrit ? 32 : 26,
          fill: color,
          shadowColor: "#000",
          shadowBlur: 6,
          shadowOpacity: 0.8,
        });
        layer.add(text);
        text.to({ y: anchor.y - 16, opacity: 0, duration: 0.9, easing: Konva.Easings.EaseOut, onFinish: () => text.destroy() });
      }, delay);
    };

    lastTurnEvents.forEach((ev, i) => {
      const delay = i * 550;
      const attacker = ev.bySide === "mine" ? myMonRef.current : oppMonRef.current;
      const target = ev.bySide === "mine" ? oppMonRef.current : myMonRef.current;
      const baseY = ev.bySide === "mine" ? MINE.y : ENEMY.y;
      const dir = ev.bySide === "mine" ? -1 : 1;

      window.setTimeout(() => {
        attacker?.to({
          y: baseY + dir * 42,
          duration: 0.14,
          easing: Konva.Easings.EaseIn,
          onFinish: () => attacker?.to({ y: baseY, duration: 0.2, easing: Konva.Easings.BackEaseOut }),
        });
      }, delay);

      if (!ev.missed) {
        window.setTimeout(() => {
          target?.to({
            x: -9,
            duration: 0.05,
            onFinish: () =>
              target?.to({ x: 9, duration: 0.05, onFinish: () => target?.to({ x: 0, duration: 0.06 }) }),
          });
        }, delay + 150);
      }

      spawnDamage(ev.bySide === "enemy", ev, delay + 170);
    });
  }, [lastTurnEvents, lastTurnNumber, titleFont]);

  const handStartX = useMemo(() => {
    const total = moves.length * MOVE_W + (moves.length - 1) * MOVE_GAP;
    return TABLE_W / 2 - total / 2;
  }, [moves.length]);

  const benchStartX = useMemo(() => {
    const total = bench.length * TOK_W + (bench.length - 1) * TOK_GAP;
    return TABLE_W / 2 - total / 2;
  }, [bench.length]);

  const canAttack = !locked && !needsSwitch;

  return (
    <div ref={containerRef} className="clip-card w-full overflow-hidden border border-edge">
      <Stage ref={stageRef} width={TABLE_W * scale} height={TABLE_H * scale} scaleX={scale} scaleY={scale}>
        {/* fundo / cenário */}
        <Layer listening={false}>
          <Rect width={TABLE_W} height={TABLE_H} fill={COLORS.table} />
          {/* plataformas elípticas sob cada pokémon */}
          <Circle x={ENEMY.cx} y={ENEMY.y + SPRITE - 8} radius={90} scaleY={0.28} fill="#0c1220" />
          <Circle x={MINE.cx} y={MINE.y + SPRITE - 8} radius={90} scaleY={0.28} fill="#0c1220" />
          {/* divisor da arena */}
          <Rect x={40} y={(ENEMY.y + MINE.y + SPRITE) / 2} width={TABLE_W - 80} height={1} fill={COLORS.edge} />
          <Text
            text="SEU BANCO"
            x={0}
            y={BENCH_Y - 16}
            width={TABLE_W}
            align="center"
            fontFamily={titleFont}
            fontSize={11}
            fill={COLORS.edge}
          />
          <Text
            text="SEUS GOLPES  —  arraste um pra cima do inimigo pra atacar"
            x={0}
            y={HAND_Y - 20}
            width={TABLE_W}
            align="center"
            fontSize={12}
            fontStyle="bold"
            fill={COLORS.inkDim}
            opacity={canAttack ? 0.9 : 0.35}
          />
        </Layer>

        {/* pokémon + anéis de alvo */}
        <Layer>
          <Group ref={oppMonRef}>
            <MonSprite mon={oppActive} cx={ENEMY.cx} y={ENEMY.y} mirrored />
          </Group>
          <Group ref={myMonRef}>
            <MonSprite mon={myActive} cx={MINE.cx} y={MINE.y} />
          </Group>

          {/* anel de alvo do inimigo (dica sempre visível no seu turno de ataque) */}
          {canAttack && (
            <TargetRing
              cx={ENEMY.cx}
              y={ENEMY.y}
              color={COLORS.enemy}
              active={overDrop === "enemy"}
              label={overDrop === "enemy" ? "SOLTAR PRA ATACAR" : "ALVO"}
            />
          )}
          {/* anel do seu ativo quando precisa trocar */}
          {!locked && needsSwitch && (
            <TargetRing
              cx={MINE.cx}
              y={MINE.y}
              color={COLORS.energy}
              active={overDrop === "mine"}
              label={overDrop === "mine" ? "SOLTAR PRA ENTRAR" : "TROQUE AQUI"}
            />
          )}

          {/* nameplates */}
          <Nameplate mon={oppActive} x={ENEMY.cx} y={ENEMY.y - 22} tone="enemy" titleFont={titleFont} />
          <Nameplate mon={myActive} x={MINE.cx} y={MINE.y + SPRITE + 2} tone="mine" titleFont={titleFont} />

          {/* banco (tray horizontal) — arrasta pro seu ativo pra trocar */}
          {bench.map((mon, i) => (
            <Draggable
              key={mon.slot}
              homeX={benchStartX + i * (TOK_W + TOK_GAP)}
              homeY={BENCH_Y}
              width={TOK_W}
              height={TOK_H}
              disabled={locked || mon.fainted}
              dropId="mine"
              targetRect={MINE_DROP}
              onOver={setOverDrop}
              onDropOnTarget={() => onSwitch(mon.slot)}
            >
              <BenchToken mon={mon} titleFont={titleFont} />
            </Draggable>
          ))}

          {/* mão de golpes — arrasta pro inimigo pra atacar */}
          {!needsSwitch &&
            moves.map((move, i) => (
              <Draggable
                key={`${move.name}-${i}`}
                homeX={handStartX + i * (MOVE_W + MOVE_GAP)}
                homeY={HAND_Y}
                width={MOVE_W}
                height={MOVE_H}
                disabled={locked}
                dropId="enemy"
                targetRect={ENEMY_DROP}
                onOver={setOverDrop}
                onDropOnTarget={() => onAttack(i)}
              >
                <MoveCard move={move} titleFont={titleFont} />
              </Draggable>
            ))}
        </Layer>

        {/* efeitos (números de dano) */}
        <Layer ref={fxLayerRef} listening={false} />
      </Stage>
    </div>
  );
}
