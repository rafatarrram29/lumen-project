import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-md rounded-2xl border border-bdr bg-surf p-8 text-center shadow-xl">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber to-[#d68820] text-2xl font-bold text-bg">
          L
        </div>
        <h1 className="mb-1 text-2xl font-semibold">Lumen</h1>
        <p className="mb-6 text-sm font-medium text-amber">Territory Decision Engine</p>
        <p className="mb-8 text-sm leading-relaxed text-muted">
          Upload your monthly sales export and get territory-level decisions —
          which areas really moved, whether it&apos;s one area&apos;s problem or a
          cluster-wide pattern, which product family is driving it, and what
          to do about it.
        </p>
        <Link
          href="/lumen"
          className="block w-full rounded-lg bg-gradient-to-br from-amber to-[#d68820] py-3 text-sm font-semibold text-bg transition-opacity hover:opacity-90"
        >
          Start analysis →
        </Link>
        <p className="mt-5 truncate text-xs text-muted">{user.email}</p>
      </div>
    </div>
  );
}
