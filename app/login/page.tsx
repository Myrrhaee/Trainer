"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = getSupabaseClient();

  useEffect(() => {
    async function checkUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        router.replace("/dashboard");
      }
    }
    checkUser();
  }, [router, supabase.auth]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) return;
    setLoading(true);

    const { error: err } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setLoading(false);
    if (err) {
      setError(err.message ?? "Ошибка входа");
      return;
    }
    router.replace("/dashboard");
    router.refresh();
  }

  async function handleGoogleSignIn() {
    setError(null);
    setOauthLoading(true);

    const origin =
      typeof window !== "undefined"
        ? window.location.origin
        : process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    const redirectTo = `${origin}/`;

    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });

    if (err) {
      setError(err.message ?? "Ошибка входа через Google");
      setOauthLoading(false);
      return;
    }
    // Редирект выполнит Supabase
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-black px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 shadow-sm" />
          <h1 className="text-xl font-semibold tracking-tight text-zinc-50">
            Вход для тренера
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Войдите, чтобы управлять клиентами и программами
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-6 shadow-xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs font-medium text-zinc-300">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="trainer@example.com"
                className="h-10 rounded-xl border-zinc-700 bg-zinc-900 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-zinc-400"
              />
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="password"
                className="text-xs font-medium text-zinc-300"
              >
                Пароль
              </Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="h-10 rounded-xl border-zinc-700 bg-zinc-900 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-zinc-400"
              />
            </div>
            {error && (
              <p className="text-sm text-rose-400" role="alert">
                {error}
              </p>
            )}
            <Button
              type="submit"
              disabled={loading || !email.trim() || !password}
              className="w-full rounded-xl bg-zinc-100 py-2.5 text-sm font-medium text-black hover:bg-white disabled:opacity-50"
            >
              {loading ? "Вход..." : "Войти"}
            </Button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-zinc-700" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-zinc-950 px-2 text-zinc-500">или</span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={handleGoogleSignIn}
            disabled={oauthLoading}
            className="w-full rounded-xl border-zinc-700 bg-zinc-900/80 py-2.5 text-sm font-medium text-zinc-100 hover:bg-zinc-800 hover:text-white disabled:opacity-50"
          >
            {oauthLoading ? "Перенаправление..." : "Войти через Google"}
          </Button>
        </div>

        <p className="text-center text-xs text-zinc-500">
          Доступ только для зарегистрированных тренеров
        </p>
      </div>
    </div>
  );
}
