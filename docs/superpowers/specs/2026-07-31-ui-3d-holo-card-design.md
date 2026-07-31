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

## Refinamento da carta (2026-07-31, 2ª leva)

O dono pediu carta "estilo TCG" e holo "mais metálico e vivo", escalado pela
**mesma fortitude (BST) que define a raridade no pacote**. Feito:

- **Layout TCG** (`.tcg-card` no globals.css): janela de arte no topo (borda
  interna por tipo, fundo em gradiente, scanlines), infos no rodapé (tipos +
  raridade + BST/dex), borda tingida pela raridade (`--rarity-c`), bisel
  metálico. `PokemonCard` e `PackRevealCard` reescritos pra ela.
- **Holo metálico** (`.holo-foil`): faixa especular prateada + arco-íris de
  difração, com parallax entre as camadas; força escala com `--holo-strength`
  (0..1). Sheen lento em repouso (mais forte quanto maior a raridade) pra dar
  vida; o ponteiro assume quando ativo.
- **Intensidade pela fortitude**: `holoIntensity(rarity)` (packs/ui/packView,
  testado) mapeia raridade→0..1. O `HoloCard` virou `intensity` (era `intense`
  booleano). A coleção passou a levar `bst`/`rarity` no DTO
  (`getCollection` usa `bstOf`→`rarityTier`, a MESMA fonte do pacote); a dex
  calcula na hora. Lendário ganha aura externa (`.tcg-card[data-legendary]`).
- Verificado (tsc·vitest 211·eslint·next build) + prova no browser: a borda pega
  a cor da raridade e o foil (repouso e ativo) cresce do comum ao lendário.

## Refinamento da carta (2026-07-31, 3ª leva — feedback com referência)

O dono mandou uma referência (cartas "Prism Monsters" estilo Yu-Gi-Oh) e pedi:
- **Fundo mais claro e vívido.** `.tcg-card` deixou de ser quase-preto: agora é um
  gradiente CLARO puxado por tipo + raridade, com texto escuro e um painel claro
  no rodapé (legível sobre qualquer moldura). A janela de arte continua ESCURA
  pro sprite saltar.
- **Fundo prismático único só no topo.** Só a raridade **legendary** (a mais
  forte/rara, "quase não tem no deck") ganha `.tcg-card[data-prismatic]`: um
  arco-íris animado (`prismatic-drift`). As demais ficam no fundo claro comum.
  Ligado por `isTopRarity(rarity)` em `PokemonCard` e `PackRevealCard`.
- **Holo SEMPRE visível.** O foil deixou de aparecer só no hover: opacity em
  repouso subiu (~0.18 comum → ~0.34 lendário, escala com a raridade) e o sheen
  lento roda sempre; ao passar o ponteiro, o movimento continua (parallax). O
  blend virou `overlay` (o `color-dodge` estourava em branco no fundo claro).
- Verificado (tsc·eslint·next build + medição no browser): fundo claro, prismático
  só no lendário, foil always-on por raridade, zero erro de console.
- ⚠️ Ainda sem print visual (pane do navegador não exibido do lado do agente) —
  o dono precisa olhar em `/holo-preview` e calibrar o gosto.

## Não feito — próxima fatia: a BATALHA (three.js ENTRA aqui)

O dono confirmou que era **A + B juntos** (o "só coleção+pacote" foi engano de
escrita). Falta a fatia da batalha, e o three.js é bem-vindo nela:

- **Palco de batalha 3D** (React Three Fiber + drei, `next/dynamic` ssr:false,
  fallback pra `DuelTable` HTML): sprites billboard, câmera, luz, FX de impacto.
- **Golpes na batalha** com info clara pra quem nunca jogou — sem exagerar no
  texto (o jogador não é burro). Barra de comando (decidida na conversa).
- **Relatório de combate mais interativo** — dano/animações, podendo usar
  three.js. Reusar a lógica pura de `battle/ui/battleView.ts` (`DuelTurnFx`).
