import { describe, expect, it } from "vitest";
import { breedingPanelView } from "@/src/modules/pokemon/ui/breedingView";

const base = {
  parentAId: "up-a",
  parentBId: "up-b",
  preview: { compatible: true, childName: "eevee", childSpriteUrl: "u", moveName: "wish" },
  usedToday: false,
  loading: false,
};

describe("breedingPanelView", () => {
  it("libera o botão e diz o que vai nascer", () => {
    const v = breedingPanelView(base);
    expect(v.canBreed).toBe(true);
    expect(v.message).toContain("eevee");
    expect(v.message).toContain("wish");
  });

  it("avisa do limite diário ANTES de qualquer outra coisa", () => {
    // Se viesse depois, o jogador escolheria os pais, leria "vai nascer um
    // Eevee" e só descobriria no clique que hoje não dá.
    const v = breedingPanelView({ ...base, usedToday: true });
    expect(v.canBreed).toBe(false);
    expect(v.message).toContain("já cruzou hoje");
  });

  it("pede duas cartas quando falta escolher", () => {
    expect(breedingPanelView({ ...base, parentBId: null }).canBreed).toBe(false);
    expect(breedingPanelView({ ...base, parentBId: null }).message).toContain("duas cartas");
  });

  it("recusa a mesma carta duas vezes", () => {
    const v = breedingPanelView({ ...base, parentBId: "up-a" });
    expect(v.canBreed).toBe(false);
    expect(v.message).toContain("diferentes");
  });

  it("explica POR QUE não combinam, em vez de só dizer que não", () => {
    const v = breedingPanelView({
      ...base,
      preview: { compatible: false, childName: null, childSpriteUrl: null, moveName: null },
    });
    expect(v.canBreed).toBe(false);
    expect(v.message).toContain("ovo");
  });

  it("não deixa cruzar enquanto o preview está carregando", () => {
    expect(breedingPanelView({ ...base, loading: true }).canBreed).toBe(false);
  });
});
