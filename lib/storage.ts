// Resolve a URL da arte de um golpe.
//
// A PokéAPI não fornece imagem de move/habilidade (verificado no /move e
// /ability — nenhum campo de sprite), então as artes são nossas, servidas de
// /public/moves por ora. `NEXT_PUBLIC_MOVE_ART_BASE_URL` permite trocar essa
// base por um storage remoto no futuro sem mexer no código.
//
// Hoje temos arte só para água e fogo; qualquer outro tipo cai no placeholder
// "sem arte". Conforme criarmos mais artes, é só adicionar em ART_BY_TYPE.

const BASE = process.env.NEXT_PUBLIC_MOVE_ART_BASE_URL ?? "/moves";

const ART_BY_TYPE: Record<string, string> = {
  water: "water.svg",
  fire: "fire.svg",
};

const PLACEHOLDER = "placeholder.svg";

/** URL da arte para um golpe do tipo informado (cai no placeholder se não houver). */
export function moveArtUrl(type: string): string {
  const file = ART_BY_TYPE[type] ?? PLACEHOLDER;
  return `${BASE}/${file}`;
}

/** true quando existe arte dedicada para o tipo (não é placeholder). */
export function hasMoveArt(type: string): boolean {
  return type in ART_BY_TYPE;
}
