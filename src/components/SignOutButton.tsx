"use client";

import { useRouter } from "next/navigation";
import { signOut } from "@/src/lib/auth-client";

export default function SignOutButton() {
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <button
      onClick={handleSignOut}
      className="clip-btn cursor-pointer border border-edge bg-transparent px-3 py-1.5 text-sm font-semibold uppercase tracking-wide text-ink-dim transition-colors hover:border-bad/60 hover:text-bad"
    >
      Sair
    </button>
  );
}
