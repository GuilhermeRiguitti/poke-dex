import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// O vitest não lê o `paths` do tsconfig sozinho. Sem este alias, qualquer
// módulo alcançado por um teste que importe "@/..." DE VERDADE quebra com
// "Cannot find package '@/...'".
//
// Até agora isso não aparecia por acidente: os testes que tocavam em código com
// "@/src/lib/prisma" faziam vi.mock() nesse caminho exato, e o vi.mock resolve
// pelo texto do especificador — o módulo real nunca chegava a ser resolvido.
// O primeiro import "@/" honesto num teste (pokedexView -> deck/domain/rules)
// caiu em cima disso.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
      // `server-only` é um pacote-marcador: o `exports` dele manda pro
      // `empty.js` só quando a condição "react-server" está ligada (o bundler do
      // Next), e pro `index.js` — que LANÇA de propósito — em qualquer outro
      // lugar. Vitest roda em Node puro, então sem este alias todo teste que
      // alcançasse `lib/prisma` ou `lib/rateLimit` de verdade morreria no
      // import, e o erro não teria nada a ver com o que o teste está provando.
      "server-only": fileURLToPath(new URL("./node_modules/server-only/empty.js", import.meta.url)),
    },
  },
});
