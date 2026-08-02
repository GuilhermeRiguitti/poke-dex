"use client";

import { useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Grid, Html } from "@react-three/drei";
import * as THREE from "three";
import DuelCallout from "./DuelCallout";
import { duelCalloutFor, type DuelTurnFx } from "./battleView";

// O PALCO 3D da batalha (three.js via R3F). Agora ele é O FUNDO: ocupa a tela
// inteira e a UI flutua por cima (ver DuelArena). O grid infinito vai até o
// horizonte, e os dois Pokémon são o SPRITE 2D em pé no palco, como billboard
// (não existe modelo 3D dos 1025 — é o jeito clássico dos jogos).
//
// A câmera está calibrada pra COMPOSIÇÃO: o oponente cai à direita e um pouco
// acima do meio, eu à esquerda e um pouco abaixo — a diagonal deixa o centro
// livre pro balão de dano e as quinas livres pras placas do HUD. Mexer em
// CAM_POS/LOOK_AT/FOV desmonta esse enquadramento.
//
// A regra das animações continua pura em battleView.ts (DuelTurnFx / callout);
// aqui só desenhamos o gatilho. Carrega lazy e tem fallback HTML se o WebGL
// falhar.

interface Side {
  spriteUrl: string | null;
  fainted: boolean;
  name: string;
}

// estado da animação corrente, lido no loop de render sem re-montar a cena
interface AnimState {
  fx: DuelTurnFx;
  t0: number;
}

const DURATION = 900; // ms da animação de turno

/**
 * Carrega o sprite SEM suspender. Parece detalhe e não é: o `useLoader` do R3F
 * suspende, e o Canvas repassa essa suspensão pro Suspense de FORA (ele joga uma
 * promise que nunca resolve enquanto a árvore estiver suspensa). Resultado: uma
 * imagem lenta — ou uma URL morta — apagava a arena INTEIRA e deixava o
 * "Montando arena…" pra sempre. Como o palco agora é a tela toda, isso não é um
 * quadrado vazio, é o jogo sem cenário. Carregando na mão, o grid aparece na
 * hora e o sprite entra quando chega (ou nunca, sem levar o resto junto).
 */
function useSpriteTexture(url: string): THREE.Texture | null {
  const [tex, setTex] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    let alive = true;
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin("anonymous");
    loader.load(
      url,
      (t) => {
        if (!alive) {
          t.dispose();
          return;
        }
        t.colorSpace = THREE.SRGBColorSpace;
        setTex(t);
      },
      undefined,
      () => {
        // sprite quebrado: fica sem a figura, o palco segue de pé
      },
    );
    return () => {
      alive = false;
    };
  }, [url]);

  useEffect(() => () => tex?.dispose(), [tex]);

  return tex;
}

const ME_POS: [number, number, number] = [-2.35, 1.15, 1.6];
const OPP_POS: [number, number, number] = [2.2, 1.15, -2.2];
const CAM_POS: [number, number, number] = [0, 3, 13];
const LOOK_AT: [number, number, number] = [0, 1.2, 0];
const FOV = 30;

function SpritePlane({
  url,
  basePos,
  side,
  fainted,
  animRef,
}: {
  url: string;
  basePos: [number, number, number];
  side: "me" | "opp";
  fainted: boolean;
  animRef: React.RefObject<AnimState | null>;
}) {
  const tex = useSpriteTexture(url);
  const group = useRef<THREE.Group>(null);
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  const phase = side === "me" ? 0 : 1.6;

  useFrame((state) => {
    const g = group.current;
    if (!g) return;
    const t = state.clock.elapsedTime;

    let [x, y, z] = basePos;
    let rotZ = 0;
    let scale = 1;
    let opacity = 1;

    if (fainted) {
      rotZ = side === "me" ? 0.5 : -0.5;
      y = basePos[1] - 0.5;
      opacity = 0.25;
    } else {
      y += Math.sin(t * 1.6 + phase) * 0.06; // respiro idle

      const a = animRef.current;
      if (a) {
        const p = Math.min(1, (performance.now() - a.t0) / DURATION);
        const fx = a.fx;
        const isActor = fx.kind === "attack" && fx.actor === side;
        const isTarget = fx.kind === "attack" && fx.target === side && !fx.missed && fx.effectiveness > 0;
        if (isActor) {
          const lunge = Math.sin(p * Math.PI); // 0→1→0
          z += (side === "me" ? -1 : 1) * lunge * 1.6;
          y += lunge * 0.35;
          scale = 1 + lunge * 0.09;
        }
        if (isTarget) {
          const amt = Math.max(0, 1 - p * 1.7);
          x += Math.sin(performance.now() * 0.05) * amt * 0.22;
        }
      }
    }

    g.position.set(x, y, z);
    g.rotation.z = rotZ;
    g.scale.setScalar(scale);
    if (mat.current) mat.current.opacity = opacity;
  });

  return (
    <group ref={group} position={basePos}>
      {tex && (
        <mesh>
          <planeGeometry args={[2.1, 2.1]} />
          <meshBasicMaterial ref={mat} map={tex} transparent alphaTest={0.04} toneMapped={false} fog={false} />
        </mesh>
      )}
    </group>
  );
}

function Shadow({ pos }: { pos: [number, number, number] }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[pos[0], 0.02, pos[2]]} scale={[1.15, 0.62, 1]}>
      <circleGeometry args={[0.85, 32]} />
      <meshBasicMaterial color="#000000" transparent opacity={0.38} fog={false} />
    </mesh>
  );
}

// Enquadramento + tremida do impacto. O lookAt é reaplicado TODO frame de
// propósito: a tremida move a posição da câmera, e sem reapontar ela sairia
// olhando pro lado errado (o R3F só aponta a câmera padrão uma vez, ao criar).
function CameraRig({ animRef }: { animRef: React.RefObject<AnimState | null> }) {
  useFrame((state) => {
    const a = animRef.current;
    const cam = state.camera;
    let ox = 0;
    let oy = 0;
    if (a && (a.fx.isCrit || a.fx.fainted) && !a.fx.missed) {
      const p = (performance.now() - a.t0) / 320;
      if (p < 1) {
        const amt = (1 - p) * 0.13;
        ox = Math.sin(performance.now() * 0.06) * amt;
        oy = Math.cos(performance.now() * 0.05) * amt;
      }
    }
    cam.position.set(CAM_POS[0] + ox, CAM_POS[1] + oy, CAM_POS[2]);
    cam.lookAt(LOOK_AT[0], LOOK_AT[1], LOOK_AT[2]);
  });
  return null;
}

// O balão de dano ancorado NA CABEÇA do pokémon: o drei projeta a posição 3D em
// pixels a cada frame, então ele acompanha o palco em qualquer proporção de
// tela (posicionar por porcentagem em CSS erraria o alvo ao redimensionar).
function Callout({
  fx,
  side,
  name,
  pos,
}: {
  fx: DuelTurnFx | null;
  side: "me" | "opp";
  name: string;
  pos: [number, number, number];
}) {
  const callout = duelCalloutFor(fx, side, name);
  if (!callout) return null;
  return (
    <Html
      position={[pos[0], pos[1] + 1.5, pos[2]]}
      center
      zIndexRange={[30, 0]}
      style={{ pointerEvents: "none", userSelect: "none" }}
    >
      <DuelCallout callout={callout} />
    </Html>
  );
}

function Scene({
  me,
  opp,
  fx,
  animRef,
}: {
  me: Side;
  opp: Side;
  fx: DuelTurnFx | null;
  animRef: React.RefObject<AnimState | null>;
}) {
  return (
    <>
      <ambientLight intensity={1.15} />
      <directionalLight position={[3, 8, 5]} intensity={1.3} />
      <pointLight position={[-4.5, 1.6, 3]} intensity={2.4} distance={16} decay={0} color="#23c9ff" />
      <pointLight position={[4.5, 1.6, -3]} intensity={2.4} distance={16} decay={0} color="#ff5c5c" />

      {/* chão da arena — grande o bastante pra cobrir a tela inteira */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[90, 90]} />
        <meshStandardMaterial color="#0a1120" metalness={0.3} roughness={0.85} />
      </mesh>
      <Grid
        position={[0, 0.01, 0]}
        args={[90, 90]}
        cellSize={1}
        cellThickness={0.6}
        cellColor="#233149"
        sectionSize={5}
        sectionThickness={1.2}
        sectionColor="#23c9ff"
        fadeDistance={46}
        fadeStrength={1.6}
        infiniteGrid
      />

      <Shadow pos={ME_POS} />
      <Shadow pos={OPP_POS} />

      {me.spriteUrl && <SpritePlane url={me.spriteUrl} basePos={ME_POS} side="me" fainted={me.fainted} animRef={animRef} />}
      {opp.spriteUrl && <SpritePlane url={opp.spriteUrl} basePos={OPP_POS} side="opp" fainted={opp.fainted} animRef={animRef} />}

      <Callout fx={fx} side="me" name={me.name} pos={ME_POS} />
      <Callout fx={fx} side="opp" name={opp.name} pos={OPP_POS} />

      <CameraRig animRef={animRef} />
    </>
  );
}

export default function DuelStage3D({
  me,
  opp,
  fx,
  nonce,
}: {
  me: Side;
  opp: Side;
  fx: DuelTurnFx | null;
  nonce: number;
}) {
  const animRef = useRef<AnimState | null>(null);

  // dispara a animação quando o turno muda (nonce vem da DuelArena, que já
  // compara o turnNumber). Guarda no ref pra o loop de render ler sem re-montar.
  useEffect(() => {
    if (nonce > 0 && fx) {
      animRef.current = { fx, t0: performance.now() };
      const id = setTimeout(() => {
        animRef.current = null;
      }, DURATION + 200);
      return () => clearTimeout(id);
    }
  }, [nonce, fx]);

  return (
    <Canvas
      camera={{ position: CAM_POS, fov: FOV }}
      dpr={[1, 2]}
      gl={{ alpha: true, antialias: true }}
      style={{ position: "absolute", inset: 0 }}
    >
      <Scene me={me} opp={opp} fx={fx} animRef={animRef} />
    </Canvas>
  );
}
