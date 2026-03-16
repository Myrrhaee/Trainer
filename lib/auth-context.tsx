"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase-client";
import type { User } from "@supabase/supabase-js";

type TrainerContextValue = {
  trainerId: string | null;
  loading: boolean;
  user: User | null;
  signOut: () => Promise<void>;
};

const TrainerContext = createContext<TrainerContextValue | null>(null);

export function useTrainer() {
  const ctx = useContext(TrainerContext);
  if (ctx == null) {
    throw new Error("useTrainer must be used within AuthGuard");
  }
  return ctx;
}

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = getSupabaseClient();

  useEffect(() => {
    let mounted = true;

    async function init() {
      const {
        data: { user: u },
      } = await supabase.auth.getUser();
      if (mounted) {
        setUser(u ?? null);
        setLoading(false);
        if (!u) {
          router.replace("/login");
          return;
        }
      }
    }

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        setUser(session?.user ?? null);
        if (!session?.user) router.replace("/login");
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [router, supabase.auth]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  }, [supabase.auth, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-600 border-t-zinc-100" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <TrainerContext.Provider
      value={{
        trainerId: user.id,
        loading: false,
        user,
        signOut,
      }}
    >
      {children}
    </TrainerContext.Provider>
  );
}
