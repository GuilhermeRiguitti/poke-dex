# UI 3D — carta holográfica (coleção + pacote)

> **Status: implementado (branch `ui-3d-implement`), verificado, NÃO commitado.**
> Data: 2026-07-31.

## Objetivo

Melhorar a **interação** do jogo com efeito 3D, sem virar enfeite. Escopo
travado com o dono: só **montagem de deck (coleção)** e **abertura de pacote**.
O palco 3D de batalha foi discutido e **ficou de fora** (ver "Não feito").

## Decisão-chave: CSS 3D, não three.js

O efeito holográfico (a carta inclina e o brilho/foil desliza seguindo o
ponteiro) é **CSS 3D puro** — `perspective`, `transform: rotateX/rotateY`,
`transform-style: preserve-3d`, e duas camadas com `mix-blend-mode`. Não usa
WebGL/three.js.

Por quê: é mais leve, o texto fica nítido (é DOM, não textura), roda liso no
mobile, e não carrega ~200KB de three.js numa tela que não precisa de cena 3D.
O three.js só se justificaria no **palco de batalha** (câmera, profundidade,
partículas) — que não faz parte deste escopo.

Outra decisão do dono: a carta colecionável passa a representar o **Pokémon**
(como no TCG real), não a skill. No banco a coleção já é o Pokémon
(`UserPokemon`), então isso é **só apresentação** — sem schema, sem migration,
sem `command`/`query` novo.

## O que foi feito

- **`src/components/holoTilt.ts`** — regra pura: `computeHoloTilt(px, py, maxDeg)`
  → `{rotateX, rotateY, glareX, glareY}`, com clamp em `[0,1]` e fallback no
  centro pra `NaN`. Testada (`tests/components/holoTilt.test.ts`).
- **`src/components/HoloCard.tsx`** — envelope cliente (`"use client"`). Mede o
  ponteiro no `pointermove` (via `requestAnimationFrame`), escreve custom
  properties CSS (`--holo-rx/ry/mx/my`) e liga `data-active`. O visual mora no
  CSS. Recebe `children` server-rendered — a fronteira do cliente é só o
  HoloCard. Prop `intense` (brilho/inclinação maiores) pra raridade alta.
- **`src/app/globals.css`** — classes `.holo-scene` / `.holo-card` /
  `.holo-foil` / `.holo-glare`. O foil é um arco-íris que desliza com o ponteiro
  (`background-position` = `--holo-mx/my`), revelado só em `data-active`.
- **`src/modules/pokedex/ui/PokemonCard.tsx`** — a moldura da coleção (e da dex)
  passou a ser envelopada pelo HoloCard. Segue Server Component.
- **`src/modules/packs/ui/PackRevealCard.tsx`** — carta revelada do pacote
  envelopada, com `intense` quando a raridade é top (legendary).

## Degradação (sem motion / touch)

O HoloCard desliga a inclinação sozinho quando
`(hover: hover) and (pointer: fine)` é falso (touch) ou quando
`prefers-reduced-motion: reduce` está ligado — aí `data-active` nunca liga e a
carta fica reta (sem tilt, sem brilho em movimento). O `globals.css` já zera
durações de animação/transição em reduced-motion.

## Verificação

- `tsc` · `vitest` (209, +6 do holoTilt) · `eslint` · `next build` — verdes.
- Prova do efeito no browser (estilos computados): `transform` vira `matrix3d`
  real ao inclinar; `foil`/`glare` revelam (`opacity` 0→0.45/0.8); grid mantém
  cards de altura igual e a moldura preenche a cena. Zero erro de console.
- ⚠️ Print visual não foi capturado (o pane do navegador não estava sendo
  exibido do lado do agente). A prova acima é por medição de DOM.

## Limpar antes de commitar

- **`src/app/holo-preview/page.tsx`** — página TEMP de verificação visual
  (pública, fora do grupo `(game)`). **APAGAR** antes do commit.

## Não feito (fora do escopo desta fatia)

- **Palco de batalha 3D** (three.js/R3F, sprites billboard, câmera, FX de
  impacto) + **barra de comando** dos golpes. Desenhado na conversa, mas o dono
  reduziu o escopo pra só coleção + pacote. Retomar como fatia própria se quiser.
