// Matemática pura do efeito holográfico: dada a posição do ponteiro sobre a
// carta (px, py normalizados em 0..1), devolve a inclinação 3D e onde o brilho
// deve ficar. Fica separada do componente pra ter teste — o HoloCard só costura
// isto no DOM (custom properties CSS).

export interface HoloTilt {
  /** rotação no eixo X (graus) — topo positivo, base negativo */
  rotateX: number;
  /** rotação no eixo Y (graus) — direita positivo, esquerda negativo */
  rotateY: number;
  /** posição horizontal do brilho, em % (0..100) */
  glareX: number;
  /** posição vertical do brilho, em % (0..100) */
  glareY: number;
}

/** Estado neutro: carta reta, brilho no centro. */
export const HOLO_REST: HoloTilt = { rotateX: 0, rotateY: 0, glareX: 50, glareY: 50 };

function clamp01(v: number): number {
  if (Number.isNaN(v)) return 0.5;
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/**
 * @param px posição horizontal do ponteiro na carta (0 = esquerda, 1 = direita)
 * @param py posição vertical do ponteiro na carta (0 = topo, 1 = base)
 * @param maxDeg amplitude máxima da inclinação, em graus
 */
export function computeHoloTilt(px: number, py: number, maxDeg: number): HoloTilt {
  const x = clamp01(px);
  const y = clamp01(py);
  return {
    rotateY: (x - 0.5) * 2 * maxDeg,
    rotateX: (0.5 - y) * 2 * maxDeg,
    glareX: x * 100,
    glareY: y * 100,
  };
}
