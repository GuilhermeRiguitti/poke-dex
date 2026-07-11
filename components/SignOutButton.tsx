"use client";

import { useRouter } from "next/navigation";
import { signOut } from "@/lib/auth-client";

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
      className="text-sm text-ink-dim hover:text-ink border border-edge hover:border-ink-dim rounded-lg px-3 py-1.5 cursor-pointer bg-transparent transition-colors"
    >
      Sair
    </button>
  );
}
