"use client";

import { useTheme } from "@/lib/theme/ThemeProvider";

export default function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, setTheme } = useTheme();

  return (
    <div className={`inline-flex overflow-hidden rounded-lg border border-bdr text-xs ${className}`}>
      <button
        onClick={() => setTheme("light")}
        title="Light"
        aria-label="Light mode"
        className={`px-2.5 py-1 transition-colors ${theme === "light" ? "bg-amber/10 text-white" : "text-muted hover:text-white"}`}
      >
        ☀
      </button>
      <button
        onClick={() => setTheme("dark")}
        title="Dark"
        aria-label="Dark mode"
        className={`px-2.5 py-1 transition-colors ${theme === "dark" ? "bg-amber/10 text-white" : "text-muted hover:text-white"}`}
      >
        ☾
      </button>
    </div>
  );
}
