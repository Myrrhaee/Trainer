import Link from "next/link";
import { redirect } from "next/navigation";
import { Dumbbell, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AccessService } from "@/lib/server/access/access-service";
import { resolveRequestActor } from "@/lib/server/auth/actor";

export const dynamic = "force-dynamic";

export default async function WorkspacesPage() {
  const actor = await resolveRequestActor();
  if (!actor) redirect("/login?next=/workspaces");
  const context = await new AccessService().context(actor);
  if (context.destination !== "/workspaces") redirect(context.destination);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-black px-4 text-zinc-100">
      <section className="w-full max-w-lg">
        <h1 className="text-2xl font-semibold tracking-normal">Выберите пространство</h1>
        <p className="mt-2 text-sm text-zinc-400">У аккаунта активны обе рабочие роли.</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Button asChild variant="outline" className="h-20 border-zinc-800 bg-zinc-950">
            <Link href="/trainer/dashboard"><Dumbbell aria-hidden /> Тренер</Link>
          </Button>
          <Button asChild variant="outline" className="h-20 border-zinc-800 bg-zinc-950">
            <Link href="/client/me"><UserRound aria-hidden /> Спортсмен</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
