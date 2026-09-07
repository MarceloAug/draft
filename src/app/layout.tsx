import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import NavBar from "@/components/NavBar";

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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-transparent text-slate-100">
        <header className="sticky top-0 z-20 border-b border-white/5 bg-slate-950/80 backdrop-blur-lg">
          <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3.5 sm:px-6">
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-orange-500 to-amber-400 text-lg shadow-lg shadow-orange-500/30">
                🏐
              </span>
              <div className="leading-tight">
                <h1 className="text-base font-bold tracking-tight text-white sm:text-lg">
                  Sorteio de Times
                </h1>
                <p className="text-[11px] font-medium text-slate-400">
                  vôlei de fim de semana
                </p>
              </div>
            </div>
            <NavBar variant="top" />
          </div>
        </header>

        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-5 pb-24 sm:px-6 sm:pb-8">
          {children}
        </main>

        <NavBar variant="bottom" />
      </body>
    </html>
  );
}
