import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white gap-4">
      <h1 className="text-6xl font-bold text-green-400">404</h1>
      <p className="text-xl">Página não encontrada</p>
      <Link
        href="/"
        className="mt-4 px-6 py-2 bg-green-600 rounded hover:bg-green-500 text-white"
      >
        Voltar para a Home
      </Link>
    </div>
  );
}
