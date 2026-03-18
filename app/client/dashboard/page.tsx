"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-client";

export default function ClientDashboardRedirect() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    async function go() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login?type=client");
        return;
      }
      router.replace(`/client/${user.id}`);
    }
    go();
  }, [router]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center text-zinc-400">
      Загружаем...
    </div>
  );
}

