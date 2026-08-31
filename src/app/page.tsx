import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-bdr bg-surf p-4 text-left">
      <div className="mb-2 text-xl">{icon}</div>
      <div className="mb-1 text-sm font-semibold text-white">{title}</div>
      <div className="text-xs leading-relaxed text-muted">{description}</div>
    </div>
  );
}

export default async function HomePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-bg px-4 py-16">
      <div className="pointer-events-none absolute -top-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-amber/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 right-0 h-72 w-72 rounded-full bg-cyan/10 blur-3xl" />

      <div className="relative w-full max-w-2xl text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber to-[#d68820] text-3xl font-bold text-bg shadow-lg shadow-amber/20">
          L
        </div>
        <h1 className="mb-3 text-4xl font-semibold tracking-tight sm:text-5xl">Lumen</h1>
        <p className="mb-2 text-lg font-medium text-amber">Territory Decision Engine</p>
        <p className="mx-auto mb-10 max-w-lg text-base leading-relaxed text-muted">
          More data, simpler decisions. Upload your monthly sales export and turn
          territory numbers into clear, confident actions.
        </p>

        <div className="mb-10 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <FeatureCard
            icon="📈"
            title="Trend-aware"
            description="Compares the last 3 months, not just one, before calling anything a real move."
          />
          <FeatureCard
            icon="🔍"
            title="Root cause"
            description="Breaks every change down by product family to find what's actually driving it."
          />
          <FeatureCard
            icon="🎯"
            title="Real decisions"
            description="Every finding ends in one concrete action, never just a number."
          />
        </div>

        <Link
          href="/lumen"
          className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-br from-amber to-[#d68820] px-8 py-3.5 text-sm font-semibold text-bg shadow-lg shadow-amber/20 transition-opacity hover:opacity-90"
        >
          Start analysis <span aria-hidden>→</span>
        </Link>

        <p className="mt-6 truncate text-xs text-muted">{user.email}</p>
      </div>
    </div>
  );
}
