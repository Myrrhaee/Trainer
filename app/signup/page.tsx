"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Eye, EyeOff, Mail } from "lucide-react";
import { toast } from "sonner";
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
  const trainerIdFromUrl = useMemo(
    () => searchParams.get("trainer_id")?.trim() || null,
    [searchParams]
  );
  const [fullName, setFullName] = useState("");
  const [teamName, setTeamName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState("");

  useEffect(() => {
    setRole(roleFromSearchParams(searchParams));
  }, [searchParams]);

  async function handleSignUp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedFullName = fullName.trim();
    const normalizedTeamName = teamName.trim();
    if (!normalizedEmail || !password) {
      toast.error("Заполните email и пароль");
      return;
    }
    if (!normalizedFullName) {
      toast.error("Введите имя и фамилию");
      return;
    }

    setLoading(true);

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
    });

    if (signUpError) {
      setLoading(false);
      toast.error(signUpError.message ?? "Ошибка регистрации");
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
            trainerId: trainerIdFromUrl,
          }),
        });
      } catch (err) {
        console.error("ensure-profile call failed:", err);
      }
    }

    setLoading(false);
    toast.success("Успешно! Инструкции отправлены на почту");
    setSubmittedEmail(normalizedEmail);
    setIsSubmitted(true);
  }

  if (isSubmitted) {
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
        <div className="w-full max-w-md space-y-8 text-center">
          <div className="flex flex-col items-center gap-6">
            <div className="relative flex h-24 w-24 items-center justify-center">
              <span
                className="absolute inline-flex h-20 w-20 animate-ping rounded-full bg-zinc-500/25"
                aria-hidden
              />
              <span className="absolute inline-flex h-16 w-16 animate-pulse rounded-full bg-zinc-400/10" aria-hidden />
              <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-zinc-700 bg-zinc-900 shadow-lg shadow-black/40">
                <Mail className="size-8 text-zinc-200" strokeWidth={1.75} aria-hidden />
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
                Подтвердите почту
              </p>
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
                Письмо отправлено!
              </h1>
            </div>
            <p className="max-w-sm text-sm leading-relaxed text-zinc-400">
              Мы отправили ссылку для подтверждения на{" "}
              <span className="break-all font-medium text-zinc-200">{submittedEmail}</span>. Пожалуйста,
              проверьте папку Входящие или Спам.
            </p>
          </div>
          <Button
            asChild
            className="w-full rounded-xl bg-zinc-100 py-2.5 text-sm font-medium text-black hover:bg-white sm:w-auto sm:min-w-[200px]"
          >
            <Link href="/login">Вернуться к логину</Link>
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
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-10 rounded-xl border-zinc-700 bg-zinc-900 pr-10 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-zinc-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 rounded-lg p-2 text-zinc-500 transition-colors hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/60"
                  aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
                >
                  {showPassword ? (
                    <EyeOff className="size-4 shrink-0" aria-hidden />
                  ) : (
                    <Eye className="size-4 shrink-0" aria-hidden />
                  )}
                </button>
              </div>
            </div>
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
