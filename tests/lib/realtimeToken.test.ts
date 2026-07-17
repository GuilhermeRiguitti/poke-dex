import { describe, expect, it } from "vitest";
import { jwtVerify } from "jose";
import { signRealtimeToken, REALTIME_TOKEN_TTL_SECONDS } from "@/src/lib/realtimeToken";

// O Supabase Realtime valida HS256 com o legacy JWT secret usado como string
// CRUA. A policy em realtime.messages lê o `sub` como TEXTO (ids são cuid) e
// o `role` precisa ser `authenticated` — errar qualquer um desses nega o
// canal EM SILÊNCIO, então as claims são contrato, não detalhe.
const SECRET = "super-secret-jwt-token-with-at-least-32-characters-long";

describe("signRealtimeToken", () => {
  it("assina HS256 verificável com o mesmo secret, com sub/role/exp certos", async () => {
    const nowMs = 1_752_710_400_000; // fixo → exp determinístico
    const token = await signRealtimeToken("cmuser123", SECRET, nowMs);

    const { payload, protectedHeader } = await jwtVerify(token, new TextEncoder().encode(SECRET), {
      currentDate: new Date(nowMs), // congela o relógio da verificação junto com o da assinatura
    });

    expect(protectedHeader.alg).toBe("HS256");
    expect(payload.sub).toBe("cmuser123"); // cuid como texto, não uuid
    expect(payload.role).toBe("authenticated");
    expect(payload.iat).toBe(nowMs / 1000);
    expect(payload.exp).toBe(nowMs / 1000 + REALTIME_TOKEN_TTL_SECONDS);
  });

  it("não valida com outro secret (a assinatura importa)", async () => {
    const token = await signRealtimeToken("cmuser123", SECRET);
    await expect(jwtVerify(token, new TextEncoder().encode("outro-secret-de-32-caracteres-no-minimo!"))).rejects.toThrow();
  });
});
