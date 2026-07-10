import Link from "next/link";
import { ArrowRight } from "lucide-react";

import type { SecondaryAttentionItem } from "./types";

type SecondaryAttentionPanelProps = {
  items: SecondaryAttentionItem[];
};

export function SecondaryAttentionPanel({ items }: SecondaryAttentionPanelProps) {
  return (
    <section className="rounded-[2rem] border border-zinc-800/70 bg-zinc-950/60 p-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-600">Мягкое внимание</p>
        <h2 className="mt-2 text-xl font-semibold tracking-tight text-zinc-50">Полезно проверить</h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-500">
          Эти сигналы важны, но не конкурируют с заблокированными тренировками.
        </p>
      </div>

      <div className="mt-4 space-y-2">
        {items.map((item) => {
          const Icon = item.icon;

          return (
            <Link
              key={item.id}
              href={`/trainer/clients?filter=${item.id}`}
              className="group flex items-center justify-between gap-3 rounded-2xl border border-zinc-800/60 bg-black/14 p-3 transition hover:border-zinc-700 hover:bg-zinc-900/60"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-zinc-400 ring-1 ring-zinc-800">
                  <Icon className="size-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-zinc-200">
                    {item.label} — {item.count} клиента
                  </p>
                  <p className="mt-1 truncate text-xs text-zinc-600">{item.helper}</p>
                </div>
              </div>
              <ArrowRight className="size-4 shrink-0 text-zinc-700 transition group-hover:text-zinc-400" />
            </Link>
          );
        })}
      </div>
    </section>
  );
}
