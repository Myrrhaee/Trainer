import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";

import type { NeedAssignmentItem, TrainerOperatingClient } from "./types";

type NeedAssignmentRowProps = {
  item: NeedAssignmentItem;
  client: TrainerOperatingClient | undefined;
  onQuickAssign: (client: TrainerOperatingClient) => void;
};

export function NeedAssignmentRow({ item, client, onQuickAssign }: NeedAssignmentRowProps) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-zinc-800/80 py-3 first:border-t-0">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-zinc-100">{item.client}</p>
        <p className="mt-1 line-clamp-1 text-xs text-zinc-500">{item.reason}</p>
        <p className="mt-1 truncate text-xs text-lime-100/75">Recommended: {item.recommendedTemplate}</p>
      </div>
      <Button
        type="button"
        size="sm"
        disabled={!client}
        onClick={() => client && onQuickAssign(client)}
        className="h-8 rounded-full bg-lime-300 px-3 text-xs text-black hover:bg-lime-200"
      >
        Assign
        <ArrowRight className="size-3.5" />
      </Button>
    </div>
  );
}
