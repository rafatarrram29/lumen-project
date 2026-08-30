"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";

export default function Sidebar({
  userEmail,
  children,
}: {
  userEmail: string;
  children?: ReactNode;
}) {
  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <aside className="flex w-full shrink-0 flex-col border-b border-bdr bg-surf p-4 sm:w-72 sm:border-b-0 sm:border-r">
      <Link href="/" className="mb-6 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber to-[#d68820] font-bold text-bg">
          L
        </div>
        <div>
          <div className="font-semibold leading-tight">Lumen</div>
          <div className="text-xs leading-tight text-muted">Territory Decision Engine</div>
        </div>
      </Link>

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
