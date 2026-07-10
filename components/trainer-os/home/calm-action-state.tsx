import Link from "next/link";
import { CheckCircle2, Users } from "lucide-react";

import { Button } from "@/components/ui/button";

export function CalmActionState() {
  return (
    <div className="mt-5 rounded-[1.5rem] border border-lime-300/12 bg-lime-300/[0.045] p-5">
      <div className="flex size-11 items-center justify-center rounded-full border border-lime-300/16 bg-lime-300/10 text-lime-100">
        <CheckCircle2 className="size-5" />
      </div>
      <h3 className="mt-4 text-lg font-semibold tracking-tight text-zinc-50">У всех клиентов есть следующий шаг</h3>
      <p className="mt-2 text-sm leading-relaxed text-zinc-500">
        Команда движется по плану. Можно спокойно перейти к общей карте или проверить плановые задачи.
      </p>
      <Button asChild className="mt-5 rounded-full bg-lime-300 px-4 text-black hover:bg-lime-200">
        <Link href="/trainer/dashboard">
          <Users className="size-4" />
          Посмотреть команду
        </Link>
      </Button>
    </div>
  );
}
