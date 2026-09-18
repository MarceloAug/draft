"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "Sorteio", icon: "🎲" },
  { href: "/jogadores", label: "Jogadores", icon: "👥" },
  { href: "/ranking", label: "Ranking", icon: "🏆" },
  { href: "/historico", label: "Histórico", icon: "🗓️" },
];

export default function NavBar({ variant }: { variant: "top" | "bottom" }) {
  const pathname = usePathname();

  if (variant === "top") {
    return (
      <nav className="hidden items-center gap-1 rounded-full border border-white/5 bg-white/[0.03] p-1 sm:flex">
        {navItems.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-orange-500 text-white shadow shadow-orange-500/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <span aria-hidden>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-white/5 bg-slate-950/90 backdrop-blur-lg sm:hidden">
      <div className="mx-auto grid max-w-md grid-cols-4 px-2 pb-[env(safe-area-inset-bottom)]">
        {navItems.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium"
            >
              <span
                className={`grid h-8 w-8 place-items-center rounded-xl text-base transition-colors ${
                  active ? "bg-orange-500/15 text-orange-400" : "text-slate-500"
                }`}
                aria-hidden
              >
                {item.icon}
              </span>
              <span className={active ? "text-orange-400" : "text-slate-500"}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
