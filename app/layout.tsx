import type { Metadata } from "next";
import { Anton, Rajdhani } from "next/font/google";
import "./globals.css";

const anton = Anton({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-anton",
});

const rajdhani = Rajdhani({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-rajdhani",
});

export const metadata: Metadata = {
  title: "PokéArena",
  description: "Capture pokémons, monte seu deck e batalhe contra outros treinadores.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={`${anton.variable} ${rajdhani.variable}`}>
      <body>{children}</body>
    </html>
  );
}
