import { CheckCircle2 } from "lucide-react";

import type { RecentDoneItem } from "./types";

type RecentDoneListProps = {
  items: RecentDoneItem[];
};

export function RecentDoneList({ items }: RecentDoneListProps) {
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.id} className="flex gap-3">
          <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-lime-300/10 text-lime-200 ring-1 ring-lime-300/20">
            <CheckCircle2 className="size-3.5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-zinc-100">{item.label}</p>
            <p className="mt-1 text-xs leading-relaxed text-zinc-500">
              {item.time} · {item.detail}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
