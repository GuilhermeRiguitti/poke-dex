import { describe, expect, it } from "vitest";
import { formatCountdown, packStatusView, rarityColor, rarityLabel } from "@/src/modules/packs/ui/packView";

describe("rarityLabel / rarityColor", () => {
  it("rotula em PT", () => {
    expect(rarityLabel("common")).toBe("Comum");
    expect(rarityLabel("legendary")).toBe("Lendário");
  });
  it("cor é um token do design system", () => {
    expect(rarityColor("legendary")).toBe("var(--color-gold)");
  });
});

describe("formatCountdown", () => {
  it("acima de 1h => horas e minutos", () => {
    expect(formatCountdown((23 * 3600 + 59 * 60) * 1000)).toBe("23h 59m");
  });
  it("abaixo de 1h => minutos e segundos", () => {
    expect(formatCountdown((45 * 60 + 12) * 1000)).toBe("45m 12s");
  });
  it("abaixo de 1min => só segundos", () => {
    expect(formatCountdown(8 * 1000)).toBe("08s");
  });
  it("negativo => 00s (nunca quebra)", () => {
    expect(formatCountdown(-5000)).toBe("00s");
  });
});

describe("packStatusView", () => {
  const now = new Date("2026-07-14T12:00:00Z").getTime();

  it("sem data de próximo => pode abrir agora", () => {
    const v = packStatusView({ canOpen: true, nextFreePackAt: null, extraPacks: 0, loginStreak: 0 }, now);
    expect(v.canOpen).toBe(true);
    expect(v.msUntilNext).toBeNull();
    expect(v.buttonLabel).toBe("Abrir pacote");
  });

  it("próximo no futuro e sem extras => em espera, com cronômetro", () => {
    const next = new Date(now + 3600_000).toISOString();
    const v = packStatusView({ canOpen: false, nextFreePackAt: next, extraPacks: 0, loginStreak: 0 }, now);
    expect(v.canOpen).toBe(false);
    expect(v.msUntilNext).toBe(3600_000);
    expect(v.buttonLabel).toBe("Em espera");
  });

  it("em cooldown MAS com extra => pode abrir (o extra fura o cooldown)", () => {
    const next = new Date(now + 3600_000).toISOString();
    const v = packStatusView({ canOpen: true, nextFreePackAt: next, extraPacks: 2, loginStreak: 0 }, now);
    expect(v.canOpen).toBe(true);
    // ainda mostra o cronômetro do grátis, mas o botão abre (gasta o extra)
    expect(v.msUntilNext).toBe(3600_000);
    expect(v.extraPacks).toBe(2);
  });
});
