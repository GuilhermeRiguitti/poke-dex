import HoloCard from "./HoloCard";
import { CARD_WIDTH, cardMetal, statBars, type PokeCardSize } from "./pokeCardView";
import type { BaseStats } from "@/src/modules/progression/domain/leveling";
import { typeColor } from "@/src/lib/typeColors";
import type { RarityTier } from "@/src/modules/packs/domain/rarity";
import { holoIntensity, isTopRarity, rarityLabel } from "@/src/modules/packs/ui/packView";

// A carta do jogo. UMA moldura pra todas as telas: coleção, catálogo, pacote,
// vaga do deck e reserva na batalha. É Server Component — o único pedaço
// cliente é o HoloCard (o motor de inclinação), que recebe esta face já
// renderizada do servidor.
//
// `details` decide o que a carta SABE. No catálogo os dados vêm da PokéAPI ao
// vivo e não trazem stats (`details={false}`); nas telas que leem o nosso banco
// vêm nível + baseStats. Carregar o dado DENTRO da flag, em vez de um booleano
// solto, é de propósito: assim o TypeScript impede o caso "liguei a flag e
// esqueci de passar o stat".
//
// O prisma (.pcard-foil / .pcard-glare) é desenhado aqui dentro, e não pelo
// HoloCard, porque só dentro do .pcard-inner ele é recortado pelo chanfro dos
// cantos — como irmão da carta, formaria um retângulo por cima do chanfro.

export interface PokeCardDetails {
  level: number;
  /**
   * Os base stats crus da espécie. A carta deriva pelo nível pro número e usa a
   * base pra barra (ver statBars).
   *
   * OPCIONAL porque a batalha não manda: lá a carta é `mini` (que nem desenha
   * barras) e o DTO do duelo carrega os pokémon dos DOIS lados — mandar stat
   * por ali entregaria os números exatos do oponente.
   */
  baseStats?: BaseStats;
}

export interface PokeCardProps {
  /** "#0025" — o rodapé e (sem details) o lugar do Lv */
  dexNumber: string;
  name: string;
  artworkUrl: string | null;
  types: string[];
  /** raridade pela fortitude (BST): metal da moldura, prisma e selo */
  rarity: RarityTier;
  size: PokeCardSize;
  /** false = catálogo (sem Lv, sem barras). Objeto = veio do nosso banco. */
  details: PokeCardDetails | false;
  /** posição no grid — escalona a animação de entrada */
  index?: number;
  /** moldura destacada (a coleção marca quem está no deck) */
  highlighted?: boolean;
  /** classes extras no wrapper (o HoloCard repassa) */
  className?: string;
  /** o rodapé: os botões. É a única parte que difere entre as telas. */
  children?: React.ReactNode;
}

// Posições fixas (%) de propósito: sortear quebraria o SSR — servidor e cliente
// sortiriam diferente e o React acusaria hydration mismatch.
const SPARKLES = [
  { left: 12, top: 10, size: 3, delay: 0 },
  { left: 85, top: 18, size: 2, delay: 0.6 },
  { left: 70, top: 8, size: 2, delay: 1.2 },
  { left: 20, top: 55, size: 2, delay: 0.3 },
  { left: 90, top: 60, size: 3, delay: 1.5 },
  { left: 55, top: 20, size: 2, delay: 0.9 },
  { left: 35, top: 42, size: 2, delay: 1.8 },
];

export default function PokeCard({
  dexNumber,
  name,
  artworkUrl,
  types,
  rarity,
  size,
  details,
  index = 0,
  highlighted,
  className,
  children,
}: PokeCardProps) {
  const top = isTopRarity(rarity);
  const bars = details && details.baseStats ? statBars(details.baseStats, details.level) : [];
  const label = name.replace(/-/g, " ");

  return (
    <HoloCard intensity={holoIntensity(rarity)} className={className}>
      <div
        className="pcard animate-rise"
        data-metal={cardMetal(rarity)}
        data-size={size}
        data-details={details ? "true" : "false"}
        data-top={top || undefined}
        data-highlighted={highlighted || undefined}
        style={
          {
            "--card-w": `${CARD_WIDTH[size]}px`,
            animationDelay: `${index * 25}ms`,
          } as React.CSSProperties
        }
      >
        <div className="pcard-inner">
          <div className="pcard-grid" aria-hidden />
          <div className="pcard-hud pcard-hud-tr" aria-hidden />
          <div className="pcard-hud pcard-hud-bl" aria-hidden />
          <div className="pcard-artbg" aria-hidden />
          {top &&
            SPARKLES.map((s, i) => (
              <span
                key={i}
                className="pcard-sparkle"
                aria-hidden
                style={{
                  left: `${s.left}%`,
                  top: `${s.top}%`,
                  width: s.size,
                  height: s.size,
                  animationDelay: `${s.delay}s`,
                }}
              />
            ))}
          <div className="pcard-scrim" aria-hidden />

          <div className="pcard-content">
            <div className="pcard-head">
              <span className="pcard-name">{label}</span>
              <span className="pcard-lv">{details ? `Lv ${details.level}` : dexNumber}</span>
            </div>
            <div className="pcard-rule" aria-hidden />

            {/* só a moldura da janela; o PNG mora no .pcard-over (ver abaixo) */}
            <div className="pcard-art" aria-hidden />

            <div className="pcard-types">
              {types.map((type) => (
                <span
                  key={type}
                  className="pcard-type"
                  style={{ "--t-bg": typeColor(type) } as React.CSSProperties}
                >
                  {type}
                </span>
              ))}
              {/* O SELO de raridade. Era uma bolinha sobre a arte E um texto
                  aqui — duas vezes a mesma informação, e a bolinha ficava com
                  ~5px no grid. Virou um só: o selo (moldura em foil + miolo
                  escuro) encaixado nesta linha. */}
              <span className="pcard-rarity">
                <span>{rarityLabel(rarity)}</span>
              </span>
            </div>

            {bars.length > 0 && (
              <div className="pcard-stats">
                {bars.map((bar) => (
                  <div key={bar.key} className="pcard-stat">
                    <span className="pcard-stat-label">{bar.label}</span>
                    <span className="pcard-stat-track">
                      <span className="pcard-stat-fill" style={{ width: `${bar.pct}%` }} />
                    </span>
                    <span className="pcard-stat-value">{bar.value}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="pcard-foot">
              <span className="pcard-dex">{dexNumber}</span>
              {children}
            </div>
          </div>

          {/* O PRISMA (z9/z10): cobre a moldura, o fundo da arte e o texto — o
              scrim é que mantém as barras legíveis por baixo dele, como no
              handoff. Quem escapa é só a arte, logo abaixo. */}
          <div className="pcard-foil" aria-hidden />
          <div className="pcard-glare" aria-hidden />

          {/* A ARTE (z11), ACIMA do prisma. Irmã dele de propósito: dentro do
              .pcard-content ela ficaria presa no contexto de empilhamento
              daquele z-index e o arco-íris tingiria o pokémon. */}
          <div className="pcard-over">
            {artworkUrl && (
              // `draggable={false}`: `<img>` nasce arrastável no browser, e esse
              // drag NATIVO rouba o gesto do nosso (ver DeckSlotCard).
              // eslint-disable-next-line @next/next/no-img-element -- sprites vêm da PokéAPI (host externo dinâmico)
              <img src={artworkUrl} alt={label} loading="lazy" draggable={false} />
            )}
            <span className="pcard-seal" aria-hidden>
              <span>
                <span>★</span>
                <span>{rarityLabel(rarity).toUpperCase()}</span>
              </span>
            </span>
          </div>
        </div>
      </div>
    </HoloCard>
  );
}
