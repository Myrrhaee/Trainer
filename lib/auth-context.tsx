"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-client";
import type { User } from "@supabase/supabase-js";
import {
  clearDemoSession,
  createDemoSupabaseUser,
  isDemoModeEnabled,
  readDemoSession,
} from "@/lib/demo-mode";

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
  const demoMode = isDemoModeEnabled();
  const [user, setUser] = useState<User | null>(() => {
    if (!demoMode) return null;
    const session = readDemoSession();
    return session ? createDemoSupabaseUser(session.role) : null;
  });
  const [loading, setLoading] = useState(() => !demoMode);
  const supabase = createClient();

  useEffect(() => {
    if (demoMode) {
      if (!user) {
        router.replace("/login");
      }
      return;
    }

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
  }, [demoMode, router, supabase, user]);

  const signOut = useCallback(async () => {
    if (demoMode) {
      clearDemoSession();
      router.replace("/login");
      return;
    }

    await supabase.auth.signOut();
    router.replace("/login");
  }, [demoMode, router, supabase]);

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
