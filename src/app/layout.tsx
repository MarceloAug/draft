import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Sorteio de Times",
  description: "Sorteio de times de vôlei balanceado por gênero",
};

const navItems = [
  { href: "/", label: "Sorteio" },
  { href: "/jogadores", label: "Jogadores" },
  { href: "/ranking", label: "Ranking" },
];

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900">
        <header className="sticky top-0 z-10 bg-orange-600 text-white shadow">
          <div className="mx-auto max-w-md px-4 py-3">
            <h1 className="text-lg font-bold">🏐 Sorteio de Times</h1>
          </div>
        </header>
        <main className="flex-1 mx-auto w-full max-w-md px-4 py-4 pb-20">
          {children}
        </main>
        <nav className="fixed bottom-0 inset-x-0 z-10 bg-white border-t border-slate-200">
          <div className="mx-auto max-w-md grid grid-cols-3">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center gap-0.5 py-2.5 text-sm font-medium text-slate-600 active:bg-slate-100"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </nav>
      </body>
    </html>
  );
}
