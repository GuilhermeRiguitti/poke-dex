"use client";

import { useRef } from "react";
import { computeHoloTilt } from "../../../layout/holoTilt";

// Envelope 3D de qualquer carta: inclina seguindo o ponteiro. É a ÚNICA parte
// cliente da carta — o conteúdo (children) vem renderizado do servidor.
//
// Aqui NÃO existe visual: só medimos o ponteiro e escrevemos custom properties
// CSS no nó. O prisma em si é desenhado pelo PokeCard, dentro da moldura, onde
// o chanfro dos cantos já o recorta. Como custom property é herdada, o que
// escrevemos aqui chega em qualquer descendente.
//
// Escrever no nó em vez de usar setState é o ponto: um grid de 20 cartas não
// pode re-renderizar o React a cada mousemove.
//
// A regra de inclinação é pura e testada (holoTilt.ts). Desliga sozinho em
// touch (sem hover fino) e em prefers-reduced-motion — aí a carta fica reta.
//
// `intensity` (0..1) escala o brilho e a inclinação: vem da fortitude/raridade
// (holoIntensity) — pokémon mais forte, carta mais metálica e viva.

const MAX_DEG_MIN = 8;
const MAX_DEG_MAX = 15;

// Saturação do arco-íris. O handoff usa 0.2–1; abaixo de 0.2 o prisma some.
const HOLO_I_MIN = 0.2;
const HOLO_I_RANGE = 0.8;

export default function HoloCard({
  className = "",
  intensity = 0.55,
  children,
}: {
  /** classes extras no wrapper (ex.: a coluna do grid) */
  className?: string;
  /** 0..1 — força do holo/inclinação (raridade). Default meio-termo. */
  intensity?: number;
  children: React.ReactNode;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const raf = useRef<number | null>(null);
  const strength = Math.min(1, Math.max(0, intensity));
  const maxDeg = MAX_DEG_MIN + (MAX_DEG_MAX - MAX_DEG_MIN) * strength;

  function tiltEnabled(): boolean {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return (
      window.matchMedia("(hover: hover) and (pointer: fine)").matches &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }

  function handleMove(e: React.PointerEvent<HTMLDivElement>) {
    const el = cardRef.current;
    if (!el || !tiltEnabled()) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    if (raf.current !== null) cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      const t = computeHoloTilt(px, py, maxDeg);
      el.style.setProperty("--holo-rx", `${t.rotateY}deg`);
      el.style.setProperty("--holo-ry", `${t.rotateX}deg`);
      el.style.setProperty("--holo-mx", `${t.glareX}%`);
      el.style.setProperty("--holo-my", `${t.glareY}%`);
      // versão CENTRADA (-50..+50): é o que desloca o arco-íris e gira a matiz.
      el.style.setProperty("--holo-mx-n", String(t.glareX - 50));
      el.style.setProperty("--holo-my-n", String(t.glareY - 50));
      el.dataset.active = "true";
    });
  }

  function reset() {
    const el = cardRef.current;
    if (!el) return;
    if (raf.current !== null) cancelAnimationFrame(raf.current);
    el.style.setProperty("--holo-rx", "0deg");
    el.style.setProperty("--holo-ry", "0deg");
    el.style.setProperty("--holo-mx", "50%");
    el.style.setProperty("--holo-my", "50%");
    el.style.setProperty("--holo-mx-n", "0");
    el.style.setProperty("--holo-my-n", "0");
    delete el.dataset.active;
  }

  return (
    <div className={`holo-scene ${className}`} onPointerMove={handleMove} onPointerLeave={reset}>
      <div
        ref={cardRef}
        className="holo-card"
        style={
          {
            "--holo-strength": strength,
            "--holo-i": HOLO_I_MIN + strength * HOLO_I_RANGE,
          } as React.CSSProperties
        }
      >
        {children}
      </div>
    </div>
  );
}
