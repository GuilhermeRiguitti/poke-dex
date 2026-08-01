import type { Metadata } from "next";
import { Anton, Cinzel, Rajdhani } from "next/font/google";
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

// Só a carta usa Cinzel (o nome e o selo de raridade). O --font-title do resto
// do app continua sendo o Anton.
const cinzel = Cinzel({
  weight: ["600", "700", "900"],
  subsets: ["latin"],
  variable: "--font-card",
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
    <html lang="pt-BR" className={`${anton.variable} ${rajdhani.variable} ${cinzel.variable}`}>
      <body>{children}</body>
    </html>
  );
}
