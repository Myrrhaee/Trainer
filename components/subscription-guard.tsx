"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTrainer } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase-client";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

const TRIAL_DAYS = 7;

type ProfileRow = {
  role: string | null;
  trainer_subscription_status: string | null;
};

function isTrialActive(userCreatedAt: string): boolean {
  const created = new Date(userCreatedAt).getTime();
  const now = Date.now();
  const trialEnd = created + TRIAL_DAYS * 24 * 60 * 60 * 1000;
  return now < trialEnd;
}

export function SubscriptionGuard({ children }: { children: React.ReactNode }) {
  const { user } = useTrainer();
  const pathname = usePathname();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const isSubscribePage = pathname === "/dashboard/subscribe";

  useEffect(() => {
    const userId = user?.id;
    if (!userId) return;

    async function load() {
      const { data, error } = await supabase
        .from("profiles")
        .select("role, trainer_subscription_status")
        .eq("id", userId)
        .maybeSingle();
      if (error) {
        console.error("profiles select failed:", error);
      }
      setProfile((data as ProfileRow) ?? null);
      setLoading(false);
    }

    load();
  }, [user?.id, supabase]);

  if (loading || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-600 border-t-zinc-100" />
      </div>
    );
  }

  const role = profile.role ?? "";
  const isTrainer = role === "trainer";
  const subscriptionActive = profile.trainer_subscription_status === "active";
  const trialActive = user?.created_at
    ? isTrialActive(user.created_at)
    : false;
  const canAccess =
    !isTrainer || subscriptionActive || trialActive || isSubscribePage;

  if (canAccess) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-black px-4">
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-zinc-900/95 to-zinc-950/95 p-8 shadow-2xl shadow-black/50 backdrop-blur-xl md:p-10">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-emerald-500/5 pointer-events-none" />
        <div className="absolute -top-24 -right-24 h-48 w-48 rounded-full bg-amber-400/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 h-48 w-48 rounded-full bg-emerald-400/10 blur-3xl pointer-events-none" />
        <div className="relative flex flex-col items-center text-center">
          <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-800/80 ring-1 ring-zinc-600/50">
            <Sparkles className="h-7 w-7 text-zinc-400" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-50 md:text-3xl">
            Твой рабочий кабинет временно заморожен
          </h1>
          <p className="mt-3 text-sm text-zinc-400">
            Продли подписку, чтобы снова управлять клиентами, программами и
            библиотекой упражнений.
          </p>
          <Button
            asChild
            className="mt-8 w-full rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 py-6 text-base font-semibold text-black shadow-lg shadow-amber-500/25 transition hover:from-amber-400 hover:to-amber-500 hover:shadow-amber-500/30"
          >
            <Link href="/dashboard/subscribe">
              Продлить подписку · $29/мес
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
