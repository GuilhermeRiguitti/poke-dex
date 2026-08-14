// Regra de APRESENTAÇÃO do cruzamento: estado da escolha → o que a tela mostra.
// Função pura, com teste (CLAUDE.md regra 4).

import type { BreedingPreviewDTO } from "../queries/getBreedingPreview";

export interface BreedingPanelView {
  /** Dá pra apertar "Cruzar"? */
  canBreed: boolean;
  /** O texto principal do painel. */
  message: string;
  /** Nome do filhote, quando há. */
  childName: string | null;
  childSpriteUrl: string | null;
  /** Rótulo do botão. */
  buttonLabel: string;
}

export interface BreedingPanelInput {
  parentAId: string | null;
  parentBId: string | null;
  preview: BreedingPreviewDTO | null;
  /** Já cruzou hoje (o servidor recusaria com already_bred_today). */
  usedToday: boolean;
  loading: boolean;
}

export function breedingPanelView(input: BreedingPanelInput): BreedingPanelView {
  const vazio = { canBreed: false, childName: null, childSpriteUrl: null };

  if (input.usedToday) {
    // Dito ANTES de qualquer outra coisa: sem isso o jogador escolhe os pais,
    // vê "vai nascer um Eevee" e só descobre no clique que hoje não dá.
    return {
      ...vazio,
      message: "Você já cruzou hoje. Volte amanhã (a virada é meia-noite UTC).",
      buttonLabel: "Cruzar",
    };
  }

  if (!input.parentAId || !input.parentBId) {
    return { ...vazio, message: "Escolha duas cartas suas.", buttonLabel: "Cruzar" };
  }

  if (input.parentAId === input.parentBId) {
    return { ...vazio, message: "Escolha duas cartas diferentes.", buttonLabel: "Cruzar" };
  }

  if (input.loading) {
    return { ...vazio, message: "Vendo se combinam…", buttonLabel: "Cruzar" };
  }

  if (!input.preview || !input.preview.compatible) {
    return {
      ...vazio,
      message:
        "Essas duas não combinam. Para cruzar, uma delas precisa saber um golpe que a outra aprende por ovo.",
      buttonLabel: "Cruzar",
    };
  }

  return {
    canBreed: true,
    childName: input.preview.childName,
    childSpriteUrl: input.preview.childSpriteUrl,
    message: `Nasce um ${(input.preview.childName ?? "?").replace(/-/g, " ")} nível 1 já sabendo ${(
      input.preview.moveName ?? "?"
    ).replace(/-/g, " ")}.`,
    buttonLabel: "Cruzar",
  };
}
