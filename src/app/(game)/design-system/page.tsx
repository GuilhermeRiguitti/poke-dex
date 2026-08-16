
// Página viva de design system — usa os tokens e componentes REAIS do jogo.
// Direção: MMORPGs 2000s da Level Up × HUD futurista de Overwatch.
//
// A seção da carta importa o PokeCard de verdade, o mesmo que a coleção, o
// catálogo, o pacote e a batalha usam. Nada de cópia "parecida": se a carta
// mudar, esta página muda junto, sem ninguém lembrar de vir aqui. As variações
// abaixo são só props do mesmo componente.

import PokeCard from "@/src/modules/pokemon/ui/PokeCard";
import { CARD_WIDTH, cardMetal, type PokeCardSize } from "@/src/modules/pokemon/ui/pokeCardView";
import { dexNumber } from "@/src/modules/pokemon/ui/pokeCardView";
import { bstOf, rarityTier, type RarityTier } from "@/src/modules/pokemon";
import { holoIntensity, rarityLabel } from "@/src/modules/pokemon/ui/rarityView";
import type { BaseStats } from "@/src/modules/pokemon";
import HpBar from "@/src/layout/HpBar";
import { PokeballIcon, SwordsIcon, CardsIcon } from "@/src/layout/icons";
import TypeBadge from "@/src/layout/TypeBadge";
import { TYPE_COLORS } from "@/src/lib/typeColors";
import { MoveCellGallery, MoveConsoleDemo } from "./MoveConsoleShowcase";

const SWATCHES = [
  { name: "bg", cls: "bg-bg", use: "fundo do jogo" },
  { name: "panel", cls: "bg-panel", use: "janelas e cards" },
  { name: "panel-2", cls: "bg-panel-2", use: "superfície elevada" },
  { name: "edge", cls: "bg-edge", use: "bordas" },
  { name: "energy", cls: "bg-energy", use: "aliado · info · foco" },
  { name: "flare", cls: "bg-flare", use: "CTA · ação" },
  { name: "gold", cls: "bg-gold", use: "level · raridade" },
  { name: "enemy", cls: "bg-enemy", use: "lado inimigo" },
  { name: "ok / warn / bad", cls: "bg-ok", use: "estados semânticos" },
];

const TYPE_SCALE = [
  { name: "Display XL", cls: "font-title text-5xl uppercase tracking-widest", spec: "Anton · 48px" },
  { name: "Título de tela", cls: "font-title text-3xl uppercase tracking-wide", spec: "Anton · 30px" },
  { name: "Nameplate", cls: "font-title text-lg uppercase tracking-wide", spec: "Anton · 18px" },
  { name: "Corpo", cls: "font-semibold text-sm", spec: "Rajdhani 600 · 14px" },
  { name: "Dados/números", cls: "font-title text-sm tracking-wider tabular-nums", spec: "Anton · tabular-nums" },
];

// Espécies de exemplo — uma por faixa de raridade. Os base stats são os reais
// da série, então a raridade sai da MESMA regra do jogo (rarityTier(bstOf(id))),
// não de um valor escrito à mão que poderia mentir.
interface Specimen {
  id: number;
  name: string;
  types: string[];
  level: number;
  baseStats: BaseStats;
}

const PIKACHU: Specimen = {
  id: 25,
  name: "pikachu",
  types: ["electric"],
  level: 12,
  baseStats: { hp: 35, atk: 55, def: 40, spa: 50, spd: 50, spe: 90 },
};
const CHARMELEON: Specimen = {
  id: 5,
  name: "charmeleon",
  types: ["fire"],
  level: 24,
  baseStats: { hp: 58, atk: 64, def: 58, spa: 80, spd: 65, spe: 80 },
};
const CHARIZARD: Specimen = {
  id: 6,
  name: "charizard",
  types: ["fire", "flying"],
  level: 41,
  baseStats: { hp: 78, atk: 84, def: 78, spa: 109, spd: 85, spe: 100 },
};
const MEWTWO: Specimen = {
  id: 150,
  name: "mewtwo",
  types: ["psychic"],
  level: 62,
  baseStats: { hp: 106, atk: 110, def: 90, spa: 154, spd: 90, spe: 130 },
};

const RARITY_ROW = [PIKACHU, CHARMELEON, CHARIZARD, MEWTWO];

// A arte oficial da PokéAPI, o mesmo host que o espelho (Pokemon.spriteUrl)
// guarda — a carta recebe a URL pronta, então aqui basta montar por id.
function artworkOf(id: number): string {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
}

function rarityOf(s: Specimen): RarityTier {
  return rarityTier(bstOf(s.id));
}

export default function DesignSystemPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 pb-24">
      {/* 1. Hero */}
      <section className="flex flex-col items-center gap-4 py-16 text-center">
        <PokeballIcon size={64} />
        <h1 className="plate border border-edge bg-panel px-8 py-3">
          <span className="plate-inner font-title text-5xl tracking-wide">
            POKE<span className="text-flare">DEX</span>
          </span>
        </h1>
        <p className="max-w-lg text-sm font-semibold text-ink-dim">
          Design system do jogo — MMORPGs 2000s da Level Up (badges de level, barras de EXP,
          janelas de inventário) × HUD futurista de Overwatch (placas inclinadas, cantos
          chanfrados, ciano vs. laranja).
        </p>
      </section>

      {/* 2. Tipografia */}
      <Section title="Tipografia">
        <div className="flex flex-col divide-y divide-edge">
          {TYPE_SCALE.map((t) => (
            <div key={t.name} className="flex items-baseline justify-between gap-4 py-4">
              <span className={t.cls}>{t.name}</span>
              <span className="shrink-0 text-xs font-bold uppercase tracking-wider text-ink-dim">
                {t.spec}
              </span>
            </div>
          ))}
        </div>
      </Section>

      {/* 3. Cores */}
      <Section title="Cores e superfícies">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {SWATCHES.map((s) => (
            <div key={s.name} className="clip-btn border border-edge bg-panel p-3">
              <div className={`clip-btn mb-2 h-10 border border-edge ${s.cls}`} />
              <p className="font-title text-sm uppercase tracking-wide">{s.name}</p>
              <p className="text-xs font-semibold text-ink-dim">{s.use}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs font-semibold text-ink-dim">
          Cores por tipo de pokémon (badges e acentos dos cards):
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {Object.keys(TYPE_COLORS).map((t) => (
            <TypeBadge key={t} type={t} small />
          ))}
        </div>
      </Section>

      {/* 4. A carta do jogo */}
      <Section title="A carta">
        <p className="mb-8 max-w-2xl text-sm font-semibold text-ink-dim">
          Existe <strong className="text-ink">uma moldura só</strong>, num componente só:{" "}
          <Code>PokeCard</Code>. Coleção, catálogo, pacote e o leque de reservas da batalha
          desenham a mesma carta — o que muda entre elas são três props (<Code>size</Code>,{" "}
          <Code>details</Code>, <Code>children</Code>) e a raridade, que vem do BST da espécie.
          Esta página importa esse mesmo componente: tudo que você vê abaixo é a carta de
          verdade, não uma imitação.
        </p>

        {/* O tamanho `mini` (96px) existe no PokeCard e é o que a reserva da
            batalha usa hoje, mas está FORA desta página de propósito: ele vai
            embora na refatoração da batalha. Não o traga de volta pra cá. */}
        <Sub title="Tamanhos — prop size">
          A geometria inteira sai de uma variável (<Code>--card-w</Code>), então a carta encolhe
          inteira: fonte, moldura, espaçamento. Não são dois desenhos, é um só em duas larguras.
        </Sub>
        <div className="flex flex-wrap items-end justify-center gap-6">
          <CardDemo
            spec={CHARMELEON}
            size="grid"
            details={{ level: CHARMELEON.level, baseStats: CHARMELEON.baseStats }}
            caption={`grid · ${CARD_WIDTH.grid}px`}
            note="Coleção e catálogo. Cabem 4 por fileira; abaixo disso o texto fica pequeno demais."
          />
          <CardDemo
            spec={CHARIZARD}
            size="full"
            details={{ level: CHARIZARD.level, baseStats: CHARIZARD.baseStats }}
            caption={`full · ${CARD_WIDTH.full}px`}
            note="A abertura do pacote. É a proporção original do desenho — as outras são reduções dela."
          />
        </div>

        <Sub title="O que a carta sabe — prop details">
          <Code>details=&#123;false&#125;</Code> é o catálogo: os dados vêm da PokéAPI ao vivo e não
          trazem stat nenhum, então a carta não mostra Lv nem barras e a janela de arte cresce pra
          ocupar o espaço. Com o objeto, os dados vêm do nosso banco: entra o Lv e entram as 6
          barras. O dado vai <em>dentro</em> da flag de propósito — assim não dá pra ligar a flag e
          esquecer de passar o stat.
        </Sub>
        <div className="flex flex-wrap justify-center gap-6">
          <CardDemo
            spec={CHARIZARD}
            size="grid"
            details={false}
            caption="details={false}"
            note="Catálogo. No lugar do Lv aparece o número da dex."
          >
            <span className="clip-btn bg-ok/25 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-ok">
              ✓ Na coleção
            </span>
          </CardDemo>
          <CardDemo
            spec={CHARIZARD}
            size="grid"
            details={{ level: CHARIZARD.level, baseStats: CHARIZARD.baseStats }}
            caption="details={{ level, baseStats }}"
            note="Coleção, pacote e deck. O número da barra é o stat já derivado pelo nível; o preenchimento é o stat base da espécie."
          />
        </div>

        <Sub title="Raridade — metal, prisma e selo">
          A raridade não é escolhida: é o BST (a soma dos 6 stats base) caindo numa faixa. Ela
          decide o metal da moldura, a força do holográfico e o selo sobre a arte. O lendário ganha
          brilhos e uma aura pulsando.
        </Sub>
        <div className="flex flex-wrap justify-center gap-5">
          {RARITY_ROW.map((s) => (
            <CardDemo
              key={s.id}
              spec={s}
              size="grid"
              details={{ level: s.level, baseStats: s.baseStats }}
              caption={`${rarityLabel(rarityOf(s))} · metal ${cardMetal(rarityOf(s))}`}
              note={`BST ${bstOf(s.id)} · holo ${holoIntensity(rarityOf(s))}`}
            />
          ))}
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-120 text-left text-xs font-semibold">
            <thead className="text-ink-dim">
              <tr className="border-b border-edge">
                <Th>faixa</Th>
                <Th>BST</Th>
                <Th>metal</Th>
                <Th>holo</Th>
                <Th>extra</Th>
              </tr>
            </thead>
            <tbody>
              <RarityRow tier="common" bst="< 350" extra="—" />
              <RarityRow tier="uncommon" bst="350 – 479" extra="—" />
              <RarityRow tier="rare" bst="480 – 579" extra="—" />
              <RarityRow tier="legendary" bst="≥ 580" extra="brilhos + aura + selo em foil" />
            </tbody>
          </table>
        </div>

        <Sub title="Rodapé — prop children">
          O rodapé é a única parte que cada tela escreve. A carta só reserva a linha; quem passa o
          conteúdo é quem usa. Por isso o mesmo desenho serve pra um botão, um selo ou nada.
        </Sub>
        <div className="flex flex-wrap justify-center gap-5">
          <CardDemo
            spec={PIKACHU}
            size="grid"
            details={{ level: PIKACHU.level, baseStats: PIKACHU.baseStats }}
            caption="Coleção"
            note="Botão de montar loadout (CollectionCardActions)."
          >
            {/* réplica estática do botão do CollectionCardActions — aqui não há
                userPokemonId de verdade pra abrir o LoadoutBuilder. */}
            <span className="clip-btn bg-panel-2 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-ink-dim">
              Montar
            </span>
          </CardDemo>
          <CardDemo
            spec={CHARMELEON}
            size="grid"
            details={{ level: CHARMELEON.level, baseStats: CHARMELEON.baseStats }}
            caption="Pacote"
            note="Selo de novidade na revelação."
          >
            <span className="clip-btn bg-flare px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
              Novo
            </span>
          </CardDemo>
          <CardDemo
            spec={MEWTWO}
            size="grid"
            details={false}
            caption="Catálogo"
            note="Só marca o que o jogador ainda não tem."
          >
            <span className="clip-btn bg-black/30 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white/45">
              Não obtido
            </span>
          </CardDemo>
        </div>

        <Sub title="Moldura destacada — prop highlighted">
          Um contorno em laranja pra marcar uma carta escolhida. Existe na carta e está pronto;
          hoje nenhuma tela liga (a coleção esconde quem já está no deck, então não precisa
          marcar).
        </Sub>
        <div className="flex flex-wrap justify-center gap-6">
          <CardDemo
            spec={CHARIZARD}
            size="grid"
            details={{ level: CHARIZARD.level, baseStats: CHARIZARD.baseStats }}
            caption="highlighted"
            note="Contorno em flare por dentro da moldura."
            highlighted
          />
        </div>

        <p className="mt-8 text-xs font-semibold text-ink-dim">
          <strong className="text-ink">Inclinação 3D:</strong> passe o mouse por qualquer carta
          acima. O envelope (<Code>HoloCard</Code>) é a única parte cliente — ele só mede o
          ponteiro e escreve variáveis CSS no nó, sem re-renderizar o React (um grid de 20 cartas
          não aguentaria). Quanto mais rara a carta, mais forte a inclinação e o arco-íris. Em tela
          de toque e com <Code>prefers-reduced-motion</Code> ele se desliga sozinho e a carta fica
          reta.
        </p>
      </Section>

      {/* 5. Componentes de jogo */}
      <Section title="Componentes de jogo">
        <p className="mb-3 text-xs font-bold uppercase tracking-wider text-ink-dim">
          Painel (card-frame) — a moldura genérica das telas, não da carta
        </p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <DemoPanel label="Padrão" typeC={TYPE_COLORS.grass} />
          <DemoPanel label="Hover (passe o mouse)" typeC={TYPE_COLORS.fire} />
          <DemoPanel label="Destacado" typeC={TYPE_COLORS.water} inDeck />
        </div>

        <p className="mb-3 mt-8 text-xs font-bold uppercase tracking-wider text-ink-dim">
          Botões
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <span className="clip-btn bg-flare px-4 py-2 text-sm font-bold uppercase tracking-wide text-white">
            Ação principal
          </span>
          <span className="clip-btn border border-edge px-4 py-2 text-sm font-bold uppercase tracking-wide text-ink-dim">
            Secundário
          </span>
          <span className="clip-btn bg-ok/15 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-ok">
            ✓ Capturado
          </span>
          <span className="lv-badge">
            <span>Lv 50</span>
          </span>
        </div>

        <p className="mb-3 mt-8 text-xs font-bold uppercase tracking-wider text-ink-dim">
          Barras (HP por percentual · stat em ciano)
        </p>
        <div className="flex max-w-md flex-col gap-3">
          <HpBar current={90} max={100} />
          <HpBar current={38} max={100} />
          <HpBar current={12} max={100} />
          <HpBar current={70} max={255} tone="energy" />
        </div>

        <p className="mb-3 mt-8 text-xs font-bold uppercase tracking-wider text-ink-dim">
          Ícones (SVG próprio)
        </p>
        <div className="flex items-center gap-4 text-ink-dim">
          <PokeballIcon size={32} />
          <SwordsIcon size={28} />
          <CardsIcon size={28} />
        </div>
      </Section>

      {/* 5.1 Console de comando */}
      <Section title="Console de comando">
        <p className="mb-8 max-w-2xl text-sm font-semibold text-ink-dim">
          A decisão do round. Os golpes <strong className="text-ink">não são cartas</strong> — a carta
          virou o Pokémon —, e também não são seis botões soltos: são células de{" "}
          <strong className="text-ink">uma máquina só</strong>. Casco chanfrado nos quatro cantos,
          nervura no lugar de borda entre as células e um trilho de energia compartilhado no rodapé.
          Esta página monta o <Code>MoveCommandBar</Code> de verdade, o mesmo que a batalha usa.
        </p>

        <Sub title="A ilha completa">
          O trilho embaixo e o custo dentro da célula usam a{" "}
          <strong className="text-ink">mesma gema</strong>. É de propósito: a pergunta do turno é
          &quot;tenho 3, isso custa 3?&quot;, e comparar duas peças com desenhos diferentes custa um
          segundo que o jogador não tem. O cabeçalho diz o que se espera dele; o rodapé diz com o que
          ele conta.
        </Sub>
        <div className="flex justify-center overflow-x-auto pb-2 pt-4">
          <MoveConsoleDemo />
        </div>
        <p className="mt-4 max-w-2xl text-xs font-semibold text-ink-dim">
          <strong className="text-ink">Sem barra de força.</strong> Poder não tem máximo pra medir —
          uma barra ali seria decoração fingindo que existe teto. Poder é número, PP é contagem, e o
          único medidor da tela é o trilho de energia, que tem máximo real (<Code>energyMax</Code>).
          Teclas <Code>1</Code>–<Code>6</Code> jogam a célula da posição.
        </p>

        <Sub title="A célula — os quatro estados">
          O motivo do bloqueio é <strong className="text-ink">escrito</strong>, não só o botão
          apagado: &quot;sem energia&quot; passa sozinho na próxima rodada, &quot;sem PP&quot; só
          passa trocando de Pokémon. Cinza igual pros dois faz o jogador achar que o jogo travou. A
          célula é exportada à parte (<Code>MoveCell</Code>) — é ela que a página mostra aqui e é ela
          que um casco mobile reaproveitaria.
        </Sub>
        <MoveCellGallery />

        <Sub title="Anatomia">
          Quatro linhas, sempre na mesma ordem — a leitura é vertical e sempre igual, então o olho
          aprende onde olhar depois do primeiro turno.
        </Sub>
        <div className="overflow-x-auto">
          <table className="w-full min-w-120 text-left text-xs font-semibold">
            <thead className="text-ink-dim">
              <tr className="border-b border-edge">
                <Th>linha</Th>
                <Th>o que mostra</Th>
                <Th>por quê</Th>
              </tr>
            </thead>
            <tbody>
              <AnatomyRow
                part="1 · identificação"
                shows="tecla · nome · classe (FÍS/ESP/STA)"
                why="Quem é o golpe e qual stat ele usa pra bater."
              />
              <AnatomyRow
                part="2 · o número"
                shows="emblema do tipo · poder · vantagem"
                why="O dado que decide. O emblema diz o tipo sem depender de ler a palavra."
              />
              <AnatomyRow
                part="3 · usos"
                shows="PP restante · efeito ou precisão"
                why="Contagem, não barra. Tira o golpe de status da inércia."
              />
              <AnatomyRow
                part="4 · custo"
                shows="gemas de energia · rótulo"
                why="Alinha com o trilho do rodapé — é a comparação do turno."
              />
            </tbody>
          </table>
        </div>
      </Section>

      {/* 6. Motion */}
      <Section title="Motion">
        <div className="grid gap-4 sm:grid-cols-2">
          <MotionDemo name="rise" spec="350ms · ease-snap · entrada de cards">
            <div className="animate-rise clip-btn border border-edge bg-panel-2 px-4 py-2 text-sm font-bold">
              Card entrando
            </div>
          </MotionDemo>
          <MotionDemo name="playable-pulse" spec="1.8s · infinito · CTA jogável">
            <span className="clip-btn animate-playable-pulse bg-flare px-4 py-2 text-sm font-bold uppercase text-white">
              Procurar oponente
            </span>
          </MotionDemo>
          <MotionDemo name="slam + ring-burst" spec="550ms ease-snap · vitória">
            <div className="relative flex h-24 items-center justify-center overflow-hidden">
              <span className="animate-ring-burst absolute h-16 w-16 rounded-full border-4 border-gold" />
              <span className="plate animate-slam bg-gold px-6 py-1.5">
                <span className="plate-inner font-title text-2xl uppercase tracking-widest text-[#241a05]">
                  Vitória
                </span>
              </span>
            </div>
          </MotionDemo>
          <MotionDemo name="radar" spec="1.5s · infinito · fila/espera">
            <div className="relative flex h-16 w-16 items-center justify-center">
              <span className="animate-radar absolute inset-0 rounded-full border-2 border-flare" />
              <SwordsIcon size={24} className="text-flare" />
            </div>
          </MotionDemo>
        </div>
        <p className="mt-4 text-xs font-semibold text-ink-dim">
          Easing assinatura: <code>cubic-bezier(0.2, 0.9, 0.3, 1.15)</code> (leve overshoot).
          Todas as animações respeitam <code>prefers-reduced-motion</code>.
        </p>
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-12">
      <h2 className="plate mb-6 inline-block border border-edge bg-panel px-4 py-1.5">
        <span className="plate-inner font-title text-xl uppercase tracking-wider">{title}</span>
      </h2>
      {children}
    </section>
  );
}

function Sub({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4 mt-10 first:mt-0">
      <p className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-dim">{title}</p>
      <p className="max-w-2xl text-sm font-semibold text-ink-dim">{children}</p>
    </div>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return <code className="font-title text-xs tracking-wide text-energy">{children}</code>;
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="py-2 pr-4 font-bold uppercase tracking-wider">{children}</th>;
}

function AnatomyRow({ part, shows, why }: { part: string; shows: string; why: string }) {
  return (
    <tr className="border-b border-edge/60">
      <td className="py-2 pr-4 font-title uppercase tracking-wide">{part}</td>
      <td className="py-2 pr-4 text-ink-dim">{shows}</td>
      <td className="py-2 pr-4 text-ink-dim">{why}</td>
    </tr>
  );
}

function RarityRow({ tier, bst, extra }: { tier: RarityTier; bst: string; extra: string }) {
  return (
    <tr className="border-b border-edge/60">
      <td className="py-2 pr-4 font-title uppercase tracking-wide">{rarityLabel(tier)}</td>
      <td className="py-2 pr-4 tabular-nums text-ink-dim">{bst}</td>
      <td className="py-2 pr-4 text-ink-dim">{cardMetal(tier)}</td>
      <td className="py-2 pr-4 tabular-nums text-ink-dim">{holoIntensity(tier)}</td>
      <td className="py-2 pr-4 text-ink-dim">{extra}</td>
    </tr>
  );
}

// A carta REAL com uma legenda embaixo. Nada de estilo próprio na carta: só as
// props que as telas do jogo passam.
function CardDemo({
  spec,
  size,
  details,
  caption,
  note,
  highlighted,
  children,
}: {
  spec: Specimen;
  size: PokeCardSize;
  details: { level: number; baseStats?: BaseStats } | false;
  caption: string;
  note: string;
  highlighted?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <figure className="flex flex-col items-center gap-3" style={{ width: CARD_WIDTH[size] }}>
      <PokeCard
        dexNumber={dexNumber(spec.id)}
        name={spec.name}
        artworkUrl={artworkOf(spec.id)}
        types={spec.types}
        rarity={rarityOf(spec)}
        size={size}
        details={details}
        highlighted={highlighted}
      >
        {children}
      </PokeCard>
      <figcaption className="text-center">
        <span className="block font-title text-sm uppercase tracking-wide">{caption}</span>
        <span className="mt-1 block text-xs font-semibold leading-snug text-ink-dim">{note}</span>
      </figcaption>
    </figure>
  );
}

function DemoPanel({ label, typeC, inDeck }: { label: string; typeC: string; inDeck?: boolean }) {
  return (
    <div
      data-in-deck={inDeck || undefined}
      className="card-frame clip-card flex flex-col items-center p-3 data-[in-deck]:border-flare/60"
      style={{ "--type-c": typeC } as React.CSSProperties}
    >
      <span className="self-start font-title text-xs tracking-wider text-ink-dim">#0001</span>
      <div className="my-3 flex h-16 w-16 items-center justify-center rounded-full bg-panel-2">
        <PokeballIcon size={36} />
      </div>
      <span className="font-title uppercase tracking-wide">Exemplo</span>
      <span className="mt-1 text-xs font-bold uppercase tracking-wide text-ink-dim">{label}</span>
    </div>
  );
}

function MotionDemo({
  name,
  spec,
  children,
}: {
  name: string;
  spec: string;
  children: React.ReactNode;
}) {
  return (
    <div className="clip-card border border-edge bg-panel p-4">
      <p className="font-title text-sm uppercase tracking-wider">{name}</p>
      <p className="mb-4 text-xs font-semibold text-ink-dim">{spec}</p>
      <div className="flex min-h-20 items-center justify-center">{children}</div>
    </div>
  );
}
