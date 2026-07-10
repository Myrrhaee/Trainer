"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-client";

export default function ClientDashboardRedirect() {
  const router = useRouter();

  useEffect(() => {
    async function go() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login?role=client");
        return;
      }
      router.replace("/client/me");
    }
    void go();
  }, [router]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center text-zinc-400">
      Загружаем...
    </div>
  );
}
