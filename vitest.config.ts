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
    },
  },
});
