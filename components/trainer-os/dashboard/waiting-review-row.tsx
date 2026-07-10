import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";

import type { WaitingReviewItem } from "./types";

type WaitingReviewRowProps = {
  item: WaitingReviewItem;
};

export function WaitingReviewRow({ item }: WaitingReviewRowProps) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-zinc-800/80 py-3 first:border-t-0">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-zinc-100">{item.client}</p>
        <p className="mt-1 truncate text-xs text-zinc-500">
          {item.workout} · {item.completedAt} · RPE {item.rpe}
        </p>
        <p className="mt-1 truncate text-xs text-cyan-100/75">{item.signal}</p>
      </div>
      <Button asChild size="sm" className="h-8 rounded-full bg-zinc-100 px-3 text-xs text-black hover:bg-white">
        <Link href={item.href}>
          Review
          <ArrowRight className="size-3.5" />
        </Link>
      </Button>
    </div>
  );
}
