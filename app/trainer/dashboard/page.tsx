"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-client";

export default function TrainerDashboardRedirect() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    async function go() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login?type=trainer");
        return;
      }
      router.replace("/dashboard");
    }
    go();
  }, [router]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center text-zinc-400">
      Загружаем...
    </div>
  );
}

