"use client";

import { Suspense, useEffect, useRef } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { Grid } from "@react-three/drei";
import * as THREE from "three";
import type { DuelTurnFx } from "./battleView";

// O PALCO 3D da batalha (three.js via R3F). Arena com chão em grid + luzes de
// arena (ciano do meu lado, vermelho do oponente); os dois Pokémon são o SPRITE
// 2D como billboard em pé no palco (não existe modelo 3D dos 1025 — é o jeito
// clássico dos jogos). A REGRA das animações continua pura em battleView.ts
// (DuelTurnFx); aqui só desenhamos o gatilho. Carrega lazy (só na batalha) e tem
// fallback HTML (DuelStageFallback) se o WebGL falhar.

interface Side {
  spriteUrl: string | null;
  fainted: boolean;
}

// estado da animação corrente, lido no loop de render sem re-montar a cena
interface AnimState {
  fx: DuelTurnFx;
  t0: number;
}

const DURATION = 900; // ms da animação de turno

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
  const tex = useLoader(THREE.TextureLoader, url);
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
          z += (side === "me" ? -1 : 1) * lunge * 1.3;
          y += lunge * 0.35;
          scale = 1 + lunge * 0.09;
        }
        if (isTarget) {
          const amt = Math.max(0, 1 - p * 1.7);
          x += Math.sin(performance.now() * 0.05) * amt * 0.18;
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
      <mesh>
        <planeGeometry args={[2.1, 2.1]} />
        <meshBasicMaterial ref={mat} map={tex} transparent alphaTest={0.04} toneMapped={false} />
      </mesh>
    </group>
  );
}

function Shadow({ pos }: { pos: [number, number, number] }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[pos[0], 0.02, pos[2]]} scale={[1.15, 0.62, 1]}>
      <circleGeometry args={[0.85, 32]} />
      <meshBasicMaterial color="#000000" transparent opacity={0.38} />
    </mesh>
  );
}

function CameraShake({ animRef }: { animRef: React.RefObject<AnimState | null> }) {
  useFrame((state) => {
    const a = animRef.current;
    const cam = state.camera;
    if (a && (a.fx.isCrit || a.fx.fainted) && !a.fx.missed) {
      const p = (performance.now() - a.t0) / 320;
      if (p < 1) {
        const amt = (1 - p) * 0.09;
        cam.position.x = Math.sin(performance.now() * 0.06) * amt;
        cam.position.y = 2.4 + Math.cos(performance.now() * 0.05) * amt;
        return;
      }
    }
    // volta suave ao lugar
    cam.position.x += (0 - cam.position.x) * 0.2;
    cam.position.y += (2.4 - cam.position.y) * 0.2;
  });
  return null;
}

const ME_POS: [number, number, number] = [-1.5, 1.05, 1.4];
const OPP_POS: [number, number, number] = [1.5, 1.15, -1.7];

function Scene({ me, opp, animRef }: { me: Side; opp: Side; animRef: React.RefObject<AnimState | null> }) {
  return (
    <>
      <ambientLight intensity={1.15} />
      <directionalLight position={[3, 8, 5]} intensity={1.3} />
      <pointLight position={[-3.5, 1.6, 2.5]} intensity={2.2} distance={13} decay={0} color="#23c9ff" />
      <pointLight position={[3.5, 1.6, -2.5]} intensity={2.2} distance={13} decay={0} color="#ff5c5c" />

      {/* chão da arena */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[26, 26]} />
        <meshStandardMaterial color="#0c1320" metalness={0.25} roughness={0.85} />
      </mesh>
      <Grid
        position={[0, 0.01, 0]}
        args={[26, 26]}
        cellSize={1}
        cellThickness={0.7}
        cellColor="#233149"
        sectionSize={4}
        sectionThickness={1.2}
        sectionColor="#23c9ff"
        fadeDistance={20}
        fadeStrength={2}
        infiniteGrid
      />

      <Shadow pos={ME_POS} />
      <Shadow pos={OPP_POS} />

      <Suspense fallback={null}>
        {me.spriteUrl && <SpritePlane url={me.spriteUrl} basePos={ME_POS} side="me" fainted={me.fainted} animRef={animRef} />}
      </Suspense>
      <Suspense fallback={null}>
        {opp.spriteUrl && <SpritePlane url={opp.spriteUrl} basePos={OPP_POS} side="opp" fainted={opp.fainted} animRef={animRef} />}
      </Suspense>

      <CameraShake animRef={animRef} />
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

  // dispara a animação quando o turno muda (nonce vem do DuelTable, que já
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
      camera={{ position: [0, 2.4, 6.2], fov: 34 }}
      dpr={[1, 2]}
      gl={{ alpha: true, antialias: true }}
      style={{ position: "absolute", inset: 0 }}
    >
      <Scene me={me} opp={opp} animRef={animRef} />
    </Canvas>
  );
}
