import Link from "next/link";

export function Footer() {
  const glows = [
    { left: "6%", size: 10, delay: "0s", dur: "12s", uplift: "56px", tint: "bg-amber-500/10" },
    { left: "14%", size: 16, delay: "3s", dur: "14s", uplift: "76px", tint: "bg-emerald-500/8" },
    { left: "22%", size: 12, delay: "6s", dur: "13s", uplift: "64px", tint: "bg-sky-500/8" },
    { left: "30%", size: 22, delay: "9s", dur: "16s", uplift: "92px", tint: "bg-amber-500/8" },
    { left: "38%", size: 14, delay: "12s", dur: "15s", uplift: "70px", tint: "bg-emerald-500/7" },
    { left: "46%", size: 18, delay: "15s", dur: "17s", uplift: "84px", tint: "bg-sky-500/7" },
    { left: "54%", size: 11, delay: "18s", dur: "12.5s", uplift: "60px", tint: "bg-amber-500/9" },
    { left: "62%", size: 24, delay: "21s", dur: "18s", uplift: "104px", tint: "bg-emerald-500/7" },
    { left: "70%", size: 13, delay: "24s", dur: "13.5s", uplift: "66px", tint: "bg-sky-500/8" },
    { left: "78%", size: 20, delay: "27s", dur: "16.5s", uplift: "88px", tint: "bg-amber-500/7" },
    { left: "86%", size: 12, delay: "30s", dur: "14.5s", uplift: "62px", tint: "bg-emerald-500/8" },
    { left: "94%", size: 17, delay: "33s", dur: "15.5s", uplift: "80px", tint: "bg-sky-500/7" },
  ] as const;

  return (
    <footer className="relative mt-16 border-t border-zinc-900 bg-zinc-950">
      {/* decorative floating glows */}
      {glows.map((g, idx) => (
        <div
          key={idx}
          className={`pointer-events-none absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full blur-2xl animate-float-up-slow ${g.tint}`}
          style={{
            left: g.left,
            width: `${g.size}rem`,
            height: `${g.size}rem`,
            animationDelay: g.delay,
            animationDuration: g.dur,
            ["--uplift" as never]: g.uplift,
          }}
          aria-hidden="true"
        />
      ))}

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-10 md:flex-row md:items-center md:justify-between">
        <p className="footer-content">
          © 2026 AI Strength Coach. Все права защищены.
        </p>

        <nav className="flex flex-col gap-2 text-sm text-zinc-500 md:flex-row md:items-center md:gap-6">
          <Link href="/terms" className="hover:text-zinc-200 transition-colors">
            Условия использования
          </Link>
          <Link
            href="/support"
            className="hover:text-zinc-200 transition-colors"
          >
            Поддержка
          </Link>
        </nav>
      </div>
    </footer>
  );
}

