"use client";

import { useRef } from "react";
import { computeHoloTilt } from "./holoTilt";

// Envelope holográfico 3D pra qualquer carta. Inclina seguindo o ponteiro e
// passa um brilho metálico por cima — a "carta = Pokémon" da coleção e do pacote.
//
// É a ÚNICA parte cliente: o conteúdo (children) vem renderizado do servidor
// (a moldura da carta com sprite/tipos/rodapé). Aqui só medimos o ponteiro e
// escrevemos custom properties CSS; o visual mora no globals.css (.holo-*).
//
// A regra de inclinação é pura e testada (holoTilt.ts). Desliga sozinho em
// touch (sem hover fino) e em prefers-reduced-motion — aí a carta fica reta.
//
// `intensity` (0..1) escala o brilho e a inclinação: vem da fortitude/raridade
// (holoIntensity) — pokémon mais forte, carta mais metálica e viva.

const MAX_DEG_MIN = 8;
const MAX_DEG_MAX = 15;

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
    delete el.dataset.active;
  }

  return (
    <div className={`holo-scene ${className}`} onPointerMove={handleMove} onPointerLeave={reset}>
      <div
        ref={cardRef}
        className="holo-card"
        style={{ ["--holo-strength" as string]: strength }}
      >
        {children}
        <div className="holo-foil clip-card" aria-hidden />
        <div className="holo-glare clip-card" aria-hidden />
      </div>
    </div>
  );
}
