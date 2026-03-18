"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase-client";
import { Button } from "@/components/ui/button";

const supabase = createClient();

type Profile = {
  id: string;
  full_name: string | null;
};

type WorkoutTemplate = {
  id: string;
  title: string;
};

export default function ClientProgramPage() {
  const params = useParams<{ id: string; programId: string }>();
  const router = useRouter();
  const clientId = params?.id as string | undefined;
  const programId = params?.programId as string | undefined;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [template, setTemplate] = useState<WorkoutTemplate | null>(null);
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [paymentLoading, setPaymentLoading] = useState(false);

  useEffect(() => {
    if (!clientId || !programId) {
      setHasAccess(false);
      setLoading(false);
      return;
    }

    async function checkAccess() {
      setLoading(true);
      const [profileRes, templateRes, assignedRes, clientProgramsRes] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("id, full_name")
            .eq("id", clientId)
            .single(),
          supabase
            .from("workout_templates")
            .select("id, title")
            .eq("id", programId)
            .single(),
          supabase
            .from("assigned_programs")
            .select("id")
            .eq("client_id", clientId)
            .eq("template_id", programId)
            .eq("status", "active")
            .maybeSingle(),
          supabase
            .from("client_programs")
            .select("id")
            .eq("client_id", clientId)
            .eq("template_id", programId)
            .limit(1)
            .maybeSingle(),
        ]);

      if (profileRes.data) setProfile(profileRes.data as Profile);
      if (templateRes.data) setTemplate(templateRes.data as WorkoutTemplate);
      const access =
        !!assignedRes.data || !!clientProgramsRes.data;
      setHasAccess(access);
      setLoading(false);
    }

    checkAccess();
  }, [clientId, programId]);

  async function handleBuyProgram() {
    if (!clientId || !programId) return;
    setPaymentLoading(true);
    try {
      const res = await fetch("/api/create-payment-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, programId }),
      });
      const data = await res.json().catch(() => ({}));
      const url = data?.url;
      if (url && typeof url === "string") {
        window.location.href = url;
      } else {
        console.error("No payment URL in response", data);
        setPaymentLoading(false);
      }
    } catch (e) {
      console.error("create-payment-link error:", e);
      setPaymentLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-foreground">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-600 border-t-zinc-100" />
      </div>
    );
  }

  if (!template || hasAccess === false) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4 text-foreground">
        <div className="text-center text-zinc-400">
          {!template ? "Программа не найдена." : "Нет доступа к этой программе."}
        </div>
      </div>
    );
  }

  if (hasAccess) {
    router.replace(`/client/${clientId}?program=${programId}`);
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-foreground">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-600 border-t-zinc-100" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 pb-28 pt-6">
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-zinc-900/95 to-zinc-950/95 p-8 shadow-2xl shadow-black/50 backdrop-blur-xl md:p-10">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-emerald-500/5 pointer-events-none" />
        <div className="absolute -top-24 -right-24 h-48 w-48 rounded-full bg-amber-400/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 h-48 w-48 rounded-full bg-emerald-400/10 blur-3xl pointer-events-none" />
        <div className="relative flex flex-col items-center text-center">
          <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400/20 to-amber-600/20 ring-1 ring-amber-400/30">
            <Sparkles className="h-7 w-7 text-amber-400/90" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-50 md:text-3xl">
            Программа: {template.title}
          </h1>
          <p className="mt-3 text-sm text-zinc-400">
            Купи доступ к этой программе тренировок и занимайся по плану.
          </p>
          <Button
            type="button"
            disabled={paymentLoading}
            onClick={() => void handleBuyProgram()}
            className="mt-10 w-full rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 py-6 text-base font-semibold text-black shadow-lg shadow-amber-500/25 transition hover:from-amber-400 hover:to-amber-500 hover:shadow-amber-500/30 disabled:opacity-70"
          >
            {paymentLoading ? "Перенаправление на оплату..." : "Купить программу"}
          </Button>
          <Link
            href={`/client/${clientId}`}
            className="mt-4 text-sm text-zinc-500 hover:text-zinc-300"
          >
            Назад к моему плану
          </Link>
        </div>
      </div>
    </div>
  );
}
