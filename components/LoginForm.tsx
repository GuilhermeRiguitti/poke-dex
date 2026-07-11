"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, signUp } from "@/lib/auth-client";

export default function LoginForm() {
  const router = useRouter();
  const [modo, setModo] = useState<"login" | "cadastro">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro("");
    setCarregando(true);

    try {
      if (modo === "cadastro") {
        const { error } = await signUp.email({ name, email, password });
        if (error) { setErro(error.message ?? "Erro ao criar conta"); return; }
      } else {
        const { error } = await signIn.email({ email, password });
        if (error) { setErro(error.message ?? "Email ou senha incorretos"); return; }
      }
      router.push("/");
      router.refresh();
    } finally {
      setCarregando(false);
    }
  };

  const inputClass =
    "clip-btn border border-edge bg-panel-2 px-4 py-2.5 font-semibold text-ink placeholder-ink-dim/60 focus:outline-none focus:border-energy transition-colors";

  return (
    <>
      <div className="mb-6 grid grid-cols-2 gap-1">
        {(["login", "cadastro"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setModo(m)}
            className={`clip-btn cursor-pointer border-0 py-2.5 text-sm font-bold uppercase tracking-wide transition-colors ${
              modo === m ? "bg-flare text-white" : "bg-panel-2 text-ink-dim hover:text-ink"
            }`}
          >
            {m === "login" ? "Entrar" : "Criar conta"}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {modo === "cadastro" && (
          <input
            type="text"
            placeholder="Nome de treinador"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className={inputClass}
          />
        )}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className={inputClass}
        />
        <input
          type="password"
          placeholder="Senha (mín. 8 caracteres)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          className={inputClass}
        />

        {erro && <p className="text-center text-sm font-semibold text-bad">{erro}</p>}

        <button
          type="submit"
          disabled={carregando}
          className="clip-btn animate-playable-pulse mt-1 cursor-pointer border-0 bg-flare py-3 font-title text-lg uppercase tracking-wider text-white transition-colors hover:bg-flare-dark disabled:opacity-50"
        >
          {carregando ? "Aguarde..." : modo === "login" ? "Entrar na arena" : "Começar a jornada"}
        </button>
      </form>
    </>
  );
}
