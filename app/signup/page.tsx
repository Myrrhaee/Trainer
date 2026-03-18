"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type SignupRole = "trainer" | "client";

function roleFromSearchParams(searchParams: URLSearchParams | null): SignupRole {
  if (!searchParams) return "client";
  return searchParams.get("role") === "trainer" ? "trainer" : "client";
}

function SignupContent() {
  const searchParams = useSearchParams();
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);
  if (supabaseRef.current === null) supabaseRef.current = createClient();
  const supabase = supabaseRef.current;
  const [role, setRole] = useState<SignupRole>(() => roleFromSearchParams(searchParams));
  const [fullName, setFullName] = useState("");
  const [teamName, setTeamName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    setRole(roleFromSearchParams(searchParams));
  }, [searchParams]);

  async function handleSignUp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedFullName = fullName.trim();
    const normalizedTeamName = teamName.trim();
    if (!normalizedEmail || !password) {
      setError("Заполните email и пароль");
      return;
    }
    if (!normalizedFullName) {
      setError("Введите имя и фамилию");
      return;
    }

    setLoading(true);

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
    });

    if (signUpError) {
      setLoading(false);
      setError(signUpError.message ?? "Ошибка регистрации");
      return;
    }

    const userId = data.user?.id;
    if (userId) {
      try {
        await fetch("/api/ensure-profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId,
            email: normalizedEmail,
            fullName: normalizedFullName,
            teamName: normalizedTeamName || undefined,
            role,
          }),
        });
      } catch (err) {
        console.error("ensure-profile call failed:", err);
      }
    }

    setLoading(false);
    setSuccess(true);
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black px-4">
        <div className="w-full max-w-sm space-y-6 text-center">
          <p className="text-lg font-medium text-zinc-100">
            Проверьте почту для подтверждения
          </p>
          <p className="text-sm text-zinc-400">
            Перейдите по ссылке из письма, чтобы активировать аккаунт. До активации вход в кабинет недоступен.
          </p>
          <Button asChild variant="outline" className="rounded-xl">
            <Link href="/login">На страницу входа</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-black px-4">
      <div className="absolute left-4 top-4 sm:left-6 sm:top-6">
        <Button asChild variant="ghost" size="sm" className="rounded-full text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-100">
          <Link href="/">На главную</Link>
        </Button>
      </div>
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <h1 className="text-xl font-semibold tracking-tight text-zinc-50">Регистрация</h1>
          <p className="mt-1 text-sm text-zinc-400">
            {role === "trainer" ? "Создание профиля тренера" : "Создание профиля клиента"}
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-6 shadow-xl">
          <form onSubmit={handleSignUp} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName" className="text-xs font-medium text-zinc-300">
                Имя и Фамилия
              </Label>
              <Input
                id="fullName"
                type="text"
                autoComplete="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Иван Иванов"
                className="h-10 rounded-xl border-zinc-700 bg-zinc-900 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-zinc-400"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="teamName" className="text-xs font-medium text-zinc-300">
                Название команды
              </Label>
              <Input
                id="teamName"
                type="text"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="Strong Team / Твой Псевдоним"
                className="h-10 rounded-xl border-zinc-700 bg-zinc-900 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-zinc-400"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs font-medium text-zinc-300">Email</Label>
              <Input
                id="email"
                type="email"
                autoCapitalize="none"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
                className="h-10 rounded-xl border-zinc-700 bg-zinc-900 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-zinc-400"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs font-medium text-zinc-300">Пароль</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="h-10 rounded-xl border-zinc-700 bg-zinc-900 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-zinc-400"
              />
            </div>
            {error && (
              <p className="text-sm text-rose-400" role="alert">{error}</p>
            )}
            <Button
              type="submit"
              disabled={loading || !email.trim() || !password || !fullName.trim()}
              className="w-full rounded-xl bg-zinc-100 py-2.5 text-sm font-medium text-black hover:bg-white disabled:opacity-50"
            >
              {loading ? "Регистрация..." : "Зарегистрироваться"}
            </Button>
          </form>
          <p className="mt-4 text-center text-xs text-zinc-500">
            Уже есть аккаунт?{" "}
            <Link href={`/login?role=${role}`} className="text-zinc-300 hover:text-zinc-100">
              Войти
            </Link>
            {role === "trainer" ? (
              <> · <Link href="/signup?role=client" className="text-zinc-400 hover:text-zinc-200">Регистрация клиента</Link></>
            ) : (
              <> · <Link href="/signup?role=trainer" className="text-zinc-400 hover:text-zinc-200">Регистрация тренера</Link></>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-black">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-600 border-t-zinc-100" />
        </div>
      }
    >
      <SignupContent />
    </Suspense>
  );
}
