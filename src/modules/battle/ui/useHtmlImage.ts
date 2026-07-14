"use client";

import { useEffect, useState } from "react";

/**
 * Carrega uma URL de sprite como HTMLImageElement pro Konva.Image.
 * Guarda o par {src, img} e deriva o retorno — se o src atual ainda não
 * carregou, devolve null sem precisar de setState síncrono no efeito.
 */
export function useHtmlImage(src: string | null | undefined): HTMLImageElement | null {
  const [loaded, setLoaded] = useState<{ src: string; img: HTMLImageElement } | null>(null);

  useEffect(() => {
    if (!src) return;
    const image = new window.Image();
    image.src = src;
    image.onload = () => setLoaded({ src, img: image });
    return () => {
      image.onload = null;
    };
  }, [src]);

  return src && loaded?.src === src ? loaded.img : null;
}
