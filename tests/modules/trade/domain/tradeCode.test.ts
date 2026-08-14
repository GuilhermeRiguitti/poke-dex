import { describe, expect, it } from "vitest";
import {
  TRADE_CODE_ALPHABET,
  TRADE_CODE_LENGTH,
  expiryFrom,
  generateTradeCode,
  isExpired,
  isValidCodeShape,
  normalizeTradeCode,
} from "@/src/modules/trade/domain/tradeCode";

describe("alfabeto do código", () => {
  it("não tem nenhum dos caracteres que se confundem ao ler ou ditar", () => {
    // Se um destes voltar pro alfabeto, um erro de leitura do jogador vira uma
    // tentativa perdida no freio de força bruta.
    for (const ambiguo of ["I", "L", "O", "U", "0", "1"]) {
      expect(TRADE_CODE_ALPHABET).not.toContain(ambiguo);
    }
  });

  it("é grande o bastante pra força bruta não valer a pena", () => {
    // 30^8 ≈ 6,5e11. Com o teto de 10 tentativas/10min, varrer 1% disso levaria
    // mais de mil anos por conta.
    expect(TRADE_CODE_ALPHABET.length ** TRADE_CODE_LENGTH).toBeGreaterThan(1e11);
  });
});

describe("generateTradeCode", () => {
  it("gera só com caracteres do alfabeto, no tamanho certo", () => {
    const code = generateTradeCode(Math.random);
    expect(code).toHaveLength(TRADE_CODE_LENGTH);
    expect(isValidCodeShape(code)).toBe(true);
  });

  it("aceita rng cravado — é o que torna o teste determinístico", () => {
    expect(generateTradeCode(() => 0)).toBe("2".repeat(TRADE_CODE_LENGTH));
  });

  it("rng devolvendo 1 não estoura o índice e vira 'undefined' no código", () => {
    // Math.floor(1 * 30) = 30, que está FORA do array. Sem o clamp, o código
    // sairia com "undefined" no meio e nem seria um código.
    const code = generateTradeCode(() => 1);
    expect(code).toHaveLength(TRADE_CODE_LENGTH);
    expect(code).not.toContain("undefined");
    expect(isValidCodeShape(code)).toBe(true);
  });
});

describe("normalizeTradeCode", () => {
  it("conserta o que o jogador faz sem querer: caixa, espaço e hífen", () => {
    expect(normalizeTradeCode("  a2b4-c6d8 ")).toBe("A2B4C6D8");
  });

  it("NÃO adivinha caractere parecido — chutar viraria a oferta de um terceiro", () => {
    // `0` não existe no alfabeto. Mapear pra `O` (que também não existe) ou pra
    // qualquer letra válida transformaria um erro de digitação em OUTRO código
    // válido. Recusar é a resposta certa.
    const normalizado = normalizeTradeCode("02B4C6D8");
    expect(normalizado).toBe("02B4C6D8");
    expect(isValidCodeShape(normalizado)).toBe(false);
  });
});

describe("isValidCodeShape", () => {
  it("recusa tamanho errado e caractere de fora", () => {
    expect(isValidCodeShape("A2B4C6D")).toBe(false); // curto
    expect(isValidCodeShape("A2B4C6D89")).toBe(false); // longo
    expect(isValidCodeShape("A2B4C6D0")).toBe(false); // tem `0`
    expect(isValidCodeShape("A2B4C6D8")).toBe(true);
  });
});

describe("expiração", () => {
  const now = new Date("2026-08-14T12:00:00.000Z");

  it("vence exatamente na borda, não um instante depois", () => {
    const expiresAt = expiryFrom(now);
    expect(isExpired(expiresAt, now)).toBe(false);
    expect(isExpired(expiresAt, new Date(expiresAt.getTime() - 1))).toBe(false);
    expect(isExpired(expiresAt, expiresAt)).toBe(true);
  });

  it("o prazo é de 24h", () => {
    expect(expiryFrom(now).getTime() - now.getTime()).toBe(24 * 60 * 60 * 1000);
  });
});
