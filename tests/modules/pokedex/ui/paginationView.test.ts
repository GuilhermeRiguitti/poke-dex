import { describe, expect, it } from "vitest";
import { paginationView } from "@/src/modules/pokedex/ui/paginationView";

describe("paginationView", () => {
  it("na primeira página, o anterior está travado", () => {
    const v = paginationView(1, 5);
    expect(v.prevDisabled).toBe(true);
    expect(v.nextDisabled).toBe(false);
    expect(v.nextPage).toBe(2);
  });

  it("na última, o próximo está travado", () => {
    const v = paginationView(5, 5);
    expect(v.prevDisabled).toBe(false);
    expect(v.nextDisabled).toBe(true);
    expect(v.prevPage).toBe(4);
  });

  it("com uma página só, os dois travam", () => {
    const v = paginationView(1, 1);
    expect(v.prevDisabled).toBe(true);
    expect(v.nextDisabled).toBe(true);
  });

  it("página além do fim trava o próximo", () => {
    // Acontece de verdade: o parser não recorta o teto (só a query sabe o
    // total), então ?page=99 numa coleção de 2 páginas chega aqui.
    expect(paginationView(99, 2).nextDisabled).toBe(true);
  });

  it("formata os rótulos com dois dígitos", () => {
    const v = paginationView(3, 12);
    expect(v.label).toBe("03");
    expect(v.totalLabel).toBe("12");
  });
});
