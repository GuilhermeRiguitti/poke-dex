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
    "rounded-xl border border-edge bg-surface-2 px-4 py-2.5 text-ink placeholder-ink-dim/60 focus:outline-none focus:border-poke transition-colors";

  return (
    <>
      <div className="mb-6 grid grid-cols-2 overflow-hidden rounded-xl border border-edge">
        <button
          onClick={() => setModo("login")}
          className={`py-2.5 text-sm font-bold cursor-pointer border-0 transition-colors ${
            modo === "login" ? "bg-poke text-white" : "bg-transparent text-ink-dim hover:text-ink"
          }`}
        >
          Entrar
        </button>
        <button
          onClick={() => setModo("cadastro")}
          className={`py-2.5 text-sm font-bold cursor-pointer border-0 transition-colors ${
            modo === "cadastro" ? "bg-poke text-white" : "bg-transparent text-ink-dim hover:text-ink"
          }`}
        >
          Criar conta
        </button>
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

        {erro && <p className="text-center text-sm text-bad">{erro}</p>}

        <button
          type="submit"
          disabled={carregando}
          className="mt-1 rounded-xl bg-poke py-3 font-bold text-white hover:bg-poke-dark disabled:opacity-50 cursor-pointer border-0 transition-colors"
        >
          {carregando ? "Aguarde..." : modo === "login" ? "Entrar" : "Começar a jornada"}
        </button>
      </form>
    </>
  );
}
