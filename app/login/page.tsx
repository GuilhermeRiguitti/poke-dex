"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, signUp } from "@/lib/auth-client";

export default function LoginPage() {
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
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-cover bg-no-repeat"
      style={{ backgroundImage: "url('https://wallpaperaccess.com/full/45664.jpg')" }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-8 shadow-2xl text-white"
        style={{ backgroundColor: "rgba(0,30,120,0.85)" }}
      >
        <div className="flex justify-center mb-6">
          <img
            src="https://upload.wikimedia.org/wikipedia/commons/thumb/9/98/International_Pok%C3%A9mon_logo.svg/2000px-International_Pok%C3%A9mon_logo.svg.png"
            alt="Pokémon"
            className="w-48"
          />
        </div>

        <div className="flex mb-6 rounded-lg overflow-hidden border border-green-500">
          <button
            onClick={() => setModo("login")}
            className={`flex-1 py-2 text-sm font-bold transition-colors cursor-pointer border-0 ${
              modo === "login" ? "bg-green-600 text-white" : "bg-transparent text-green-400"
            }`}
          >
            Entrar
          </button>
          <button
            onClick={() => setModo("cadastro")}
            className={`flex-1 py-2 text-sm font-bold transition-colors cursor-pointer border-0 ${
              modo === "cadastro" ? "bg-green-600 text-white" : "bg-transparent text-green-400"
            }`}
          >
            Cadastrar
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {modo === "cadastro" && (
            <input
              type="text"
              placeholder="Nome"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="bg-white/10 border border-white/30 rounded-lg px-4 py-2 text-white placeholder-white/50 focus:outline-none focus:border-green-400"
            />
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="bg-white/10 border border-white/30 rounded-lg px-4 py-2 text-white placeholder-white/50 focus:outline-none focus:border-green-400"
          />
          <input
            type="password"
            placeholder="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className="bg-white/10 border border-white/30 rounded-lg px-4 py-2 text-white placeholder-white/50 focus:outline-none focus:border-green-400"
          />

          {erro && <p className="text-red-400 text-sm text-center">{erro}</p>}

          <button
            type="submit"
            disabled={carregando}
            className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-bold py-2 rounded-lg transition-colors cursor-pointer border-0"
          >
            {carregando ? "Aguarde..." : modo === "login" ? "Entrar" : "Criar conta"}
          </button>
        </form>
      </div>
    </div>
  );
}
