"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Ask Your Data" },
  { href: "/lumen", label: "Territory Decision Engine" },
] as const;

export default function Sidebar({
  userEmail,
  active,
  children,
}: {
  userEmail: string;
  active: "/dashboard" | "/lumen";
  children?: ReactNode;
}) {
  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <aside className="flex w-full shrink-0 flex-col border-b border-bdr bg-surf p-4 sm:w-72 sm:border-b-0 sm:border-r">
      <div className="mb-6 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber to-[#d68820] font-bold text-bg">
          L
        </div>
        <div className="font-semibold">Lumen</div>
      </div>

      <nav className="mb-4 space-y-1">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
              active === item.href
                ? "bg-surf2 font-medium text-amber"
                : "text-muted hover:bg-surf2 hover:text-white"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {children}

      <div className="mt-4 border-t border-bdr pt-4">
        <div className="mb-2 truncate text-xs text-muted">{userEmail}</div>
        <button onClick={handleLogout} className="text-sm text-muted hover:text-red">
          Sign out
        </button>
      </div>
    </aside>
  );
}
