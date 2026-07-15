import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/src/lib/auth";
import { readPackState } from "@/src/modules/packs";
import PackOpener from "@/src/modules/packs/ui/PackOpener";

// Page é servidor: lê o estado do cofre no banco e passa por prop. O "use
// client" desce só até o PackOpener, que é quem tem clique e cronômetro.
export default async function PacksPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const packState = await readPackState(session.user.id);

  return (
    <div className="pt-8">
      <div className="mb-8 text-center">
        <h1 className="font-title text-3xl uppercase tracking-wide">
          Abrir <span className="text-flare">Pacote</span>
        </h1>
        <p className="text-sm font-semibold text-ink-dim">
          6 cartas por pacote. Pokémon mais fortes são muito mais raros.
        </p>
      </div>

      <PackOpener initialState={packState} />
    </div>
  );
}
