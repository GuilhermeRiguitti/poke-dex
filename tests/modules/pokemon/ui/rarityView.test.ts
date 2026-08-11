import { describe, expect, it } from "vitest";
import {
  holoIntensity,
  isTopRarity,
  rarityColor,
  rarityLabel,
} from "@/src/modules/pokemon/ui/rarityView";

describe("rarityLabel / rarityColor", () => {
  it("rotula em PT", () => {
    expect(rarityLabel("common")).toBe("Comum");
    expect(rarityLabel("legendary")).toBe("Lendário");
  });
  it("cor é um token do design system", () => {
    expect(rarityColor("legendary")).toBe("var(--color-gold)");
  });
});

describe("isTopRarity", () => {
  it("só o lendário ganha a aura extra", () => {
    expect(isTopRarity("legendary")).toBe(true);
    expect(isTopRarity("rare")).toBe(false);
  });
});

describe("holoIntensity", () => {
  it("cresce com a raridade (0..1), lendário no máximo", () => {
    expect(holoIntensity("common")).toBeLessThan(holoIntensity("uncommon"));
    expect(holoIntensity("uncommon")).toBeLessThan(holoIntensity("rare"));
    expect(holoIntensity("rare")).toBeLessThan(holoIntensity("legendary"));
    expect(holoIntensity("legendary")).toBe(1);
  });
  it("fica no intervalo [0,1]", () => {
    for (const t of ["common", "uncommon", "rare", "legendary"] as const) {
      expect(holoIntensity(t)).toBeGreaterThanOrEqual(0);
      expect(holoIntensity(t)).toBeLessThanOrEqual(1);
    }
  });
});
