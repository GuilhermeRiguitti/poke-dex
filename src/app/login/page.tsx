import { PokeballIcon } from "@/src/components/icons";
import LoginForm from "@/src/components/LoginForm";
import { auth } from "@/src/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function LoginPage() {
  // Já logado? Vai direto pro jogo.
  const session = await auth.api.getSession({ headers: await headers() });
  if (session) redirect("/");

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* tela de título */}
        <div className="mb-8 flex flex-col items-center gap-4">
          <PokeballIcon size={72} />
          <h1 className="plate border border-edge bg-panel px-6 py-2">
            <span className="plate-inner font-title text-4xl tracking-wide">
              POKE<span className="text-flare">DEX</span>
            </span>
          </h1>
          <p className="max-w-xs text-center text-sm font-semibold text-ink-dim">
            Capture pokémons, monte seu deck e batalhe contra outros treinadores.
          </p>
        </div>

        <div className="clip-card border border-edge bg-panel p-6">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
