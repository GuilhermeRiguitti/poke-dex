import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { PokeballIcon } from "@/components/icons";
import LoginForm from "@/components/LoginForm";

export default async function LoginPage() {
  // Já logado? Vai direto pro jogo.
  const session = await auth.api.getSession({ headers: await headers() });
  if (session) redirect("/");

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <PokeballIcon size={64} />
          <h1 className="text-3xl font-extrabold tracking-tight">
            Poké<span className="text-poke">Arena</span>
          </h1>
          <p className="text-center text-sm text-ink-dim">
            Capture pokémons, monte seu deck e batalhe contra outros treinadores.
          </p>
        </div>

        <div className="rounded-2xl border border-edge bg-surface p-6">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
