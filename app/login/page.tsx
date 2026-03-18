"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type LoginType = "trainer" | "client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loginType, setLoginType] = useState<LoginType>("trainer");
  const [isSignUp, setIsSignUp] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function check() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) router.replace("/dashboard");
    }
    check();
  }, [router, supabase.auth]);

  async function ensureProfile(userId: string, role: "client" | "trainer", name: string, userEmail: string) {
    try {
      await fetch("/api/ensure-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          role,
          fullName: name,
          email: userEmail,
        }),
      });
    } catch {
      // ignore
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) return;
    setLoading(true);

    const normalizedEmail = email.trim();
    const normalizedName = fullName.trim();

    // 1) Pre-check email existence in profiles
    if (!isSignUp) {
      const { data: existing, error: existsErr } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", normalizedEmail)
        .maybeSingle();

      if (existsErr && !existing) {
        console.error("login profiles email check failed:", existsErr);
        setLoading(false);
        setError("Не удалось проверить почту. Попробуйте позже.");
        return;
      }

      if (!existing) {
        setLoading(false);
        setError("Пользователь с такой почтой не зарегистрирован");
        return;
      }
    }

    if (isSignUp) {
      if (!normalizedName) {
        setLoading(false);
        setError("Введите имя");
        return;
      }

      const { data, error: err } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
      });

      setLoading(false);
      if (err) {
        setError(err.message ?? "Ошибка регистрации");
        return;
      }

      const userId = data.user?.id;
      if (userId) {
        const role: "client" | "trainer" = loginType === "trainer" ? "trainer" : "client";
        await ensureProfile(userId, role, normalizedName, data.user?.email ?? normalizedEmail);
        router.replace(role === "client" ? "/client/me" : "/dashboard");
        router.refresh();
        return;
      }

      // If email confirmation is required, userId may be null until confirmed
      router.replace("/login");
      router.refresh();
      return;
    }

    const { data, error: err } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    setLoading(false);
    if (err) {
      const msg = err.message ?? "Ошибка входа";
      if (msg.toLowerCase().includes("invalid login credentials")) {
        setError("Неверный пароль. Попробуйте еще раз");
      } else {
        setError(msg);
      }
      return;
    }

    const userId = data.user?.id;
    if (userId) {
      const { data: profile, error: profileErr } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .maybeSingle();

      if (profileErr) {
        console.error("profiles role load failed:", profileErr);
      }

      let role = (profile as { role?: string | null } | null)?.role ?? null;

      // If profile is missing or role is null, recover it "on the fly"
      if (!role) {
        if (loginType === "trainer") {
          await ensureProfile(userId, "trainer", normalizedName || "", normalizedEmail);
          role = "trainer";
        } else {
          role = "client";
        }
      }

      if (role === "client") {
        router.replace("/client/me");
        router.refresh();
        return;
      }
    }

    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-black px-4">
      <div className="absolute left-4 top-4 sm:left-6 sm:top-6">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="rounded-full text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-100"
        >
          <Link href="/">На главную</Link>
        </Button>
      </div>
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 shadow-sm" />
          <h1 className="text-xl font-semibold tracking-tight text-zinc-50">
            {isSignUp ? "Регистрация" : "Вход"}
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            {isSignUp ? "Создайте аккаунт, чтобы начать" : "Войдите, чтобы продолжить"}
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-6 shadow-xl">
          <div className="mb-5 flex items-center justify-center">
            <div className="inline-flex rounded-full border border-zinc-800 bg-zinc-900/70 p-1">
              <button
                type="button"
                onClick={() => setLoginType("trainer")}
                className={[
                  "rounded-full px-4 py-2 text-xs font-semibold transition",
                  loginType === "trainer"
                    ? "bg-zinc-100 text-black"
                    : "text-zinc-400 hover:text-zinc-200",
                ].join(" ")}
              >
                Войти как Тренер
              </button>
              <button
                type="button"
                onClick={() => setLoginType("client")}
                className={[
                  "rounded-full px-4 py-2 text-xs font-semibold transition",
                  loginType === "client"
                    ? "bg-zinc-100 text-black"
                    : "text-zinc-400 hover:text-zinc-200",
                ].join(" ")}
              >
                Войти как Клиент
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div className="space-y-2">
                <Label htmlFor="fullName" className="text-xs font-medium text-zinc-300">
                  Имя
                </Label>
                <Input
                  id="fullName"
                  type="text"
                  autoComplete="name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Иван"
                  className="h-10 rounded-xl border-zinc-700 bg-zinc-900 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-zinc-400"
                />
              </div>
            )}
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
                placeholder={loginType === "trainer" ? "trainer@example.com" : "client@example.com"}
                className="h-10 rounded-xl border-zinc-700 bg-zinc-900 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-zinc-400"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs font-medium text-zinc-300">
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
              disabled={loading || !email.trim() || !password || (isSignUp && !fullName.trim())}
              className="w-full rounded-xl bg-zinc-100 py-2.5 text-sm font-medium text-black hover:bg-white disabled:opacity-50"
            >
              {loading ? (isSignUp ? "Регистрация..." : "Вход...") : isSignUp ? "Зарегистрироваться" : "Войти"}
            </Button>
          </form>

          <div className="mt-5 text-center">
            <button
              type="button"
              className="text-sm font-medium text-zinc-400 hover:text-zinc-200"
              onClick={() => {
                setError(null);
                setIsSignUp((v) => !v);
              }}
            >
              {isSignUp ? "Уже есть аккаунт? Войти" : "Нет аккаунта? Зарегистрироваться"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
