import type { DuelCardView } from "@/src/modules/battle/ui/battleView";

// Golpes de exemplo pro design system. São `DuelCardView` de verdade — o mesmo
// tipo que `selectDuelView` devolve — pra que a página não possa mostrar uma
// célula que a batalha não conseguiria montar. Loadout plausível de um
// Exeggutor lv 12: os quatro primeiros custam caro, os últimos são o que sobra
// quando a energia acaba.

const base: Pick<DuelCardView, "accuracy" | "disabled" | "disabledReason" | "effectiveness"> = {
  accuracy: null,
  disabled: false,
  disabledReason: null,
  effectiveness: null,
};

export const DEMO_CARDS: DuelCardView[] = [
  {
    ...base,
    slot: 0,
    name: "leaf-storm",
    type: "grass",
    power: 130,
    damageClass: "special",
    accuracy: 90,
    currentPp: 5,
    maxPp: 5,
    energyCost: 3,
    effectLabel: "Atq. Esp. −2 do alvo",
    effectiveness: 2,
  },
  {
    ...base,
    slot: 1,
    name: "solar-beam",
    type: "grass",
    power: 120,
    damageClass: "special",
    currentPp: 10,
    maxPp: 10,
    energyCost: 3,
    effectLabel: null,
    effectiveness: 2,
  },
  {
    ...base,
    slot: 2,
    name: "wood-hammer",
    type: "grass",
    power: 120,
    damageClass: "physical",
    currentPp: 15,
    maxPp: 15,
    energyCost: 3,
    effectLabel: "Recuo de 33% do dano",
    effectiveness: 2,
  },
  {
    ...base,
    slot: 3,
    name: "uproar",
    type: "normal",
    power: 90,
    damageClass: "special",
    currentPp: 7,
    maxPp: 10,
    energyCost: 2,
    effectLabel: null,
  },
  {
    ...base,
    slot: 4,
    name: "seed-bomb",
    type: "grass",
    power: 80,
    damageClass: "physical",
    currentPp: 13,
    maxPp: 15,
    energyCost: 2,
    effectLabel: null,
    effectiveness: 2,
  },
  {
    ...base,
    slot: 5,
    name: "psyshock",
    type: "psychic",
    power: 80,
    damageClass: "special",
    currentPp: 0,
    maxPp: 10,
    energyCost: 2,
    effectLabel: "Dano na Defesa física",
    disabled: true,
    disabledReason: "pp",
    effectiveness: 0.5,
  },
];

/** As quatro leituras da célula — é o que a página mostra isolado. */
export const DEMO_STATES: { label: string; tone: string; card: DuelCardView; armed?: boolean }[] = [
  { label: "Jogável", tone: "text-ink-dim", card: DEMO_CARDS[2] },
  { label: "Armada · Enter confirma", tone: "text-flare", card: DEMO_CARDS[0], armed: true },
  {
    label: "Sem energia",
    tone: "text-bad",
    card: { ...DEMO_CARDS[1], disabled: true, disabledReason: "energy" },
  },
  { label: "Sem PP", tone: "text-bad", card: DEMO_CARDS[5] },
];
