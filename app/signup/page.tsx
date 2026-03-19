"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Mail, UserPlus } from "lucide-react";
import type { User } from "@supabase/supabase-js";
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

type MyProfileRow = {
  role: string | null;
  trainer_id: string | null;
};

type TrainerCardRow = {
  full_name: string | null;
  display_name: string | null;
  role: string | null;
};

function SignupContent() {
  const router = useRouter();
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

  const [authReady, setAuthReady] = useState(false);
  const [sessionUser, setSessionUser] = useState<User | null>(null);
  const [myProfile, setMyProfile] = useState<MyProfileRow | null>(null);
  const [trainerCard, setTrainerCard] = useState<TrainerCardRow | null>(null);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    setRole(roleFromSearchParams(searchParams));
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;

    async function loadAuthAndInviteContext() {
      const r = roleFromSearchParams(searchParams);
      const tid = searchParams.get("trainer_id")?.trim() || null;

      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user ?? null;

      if (cancelled) return;

      if (!user) {
        if (tid && r === "client") {
          router.replace(
            `/login?role=client&trainer_id=${encodeURIComponent(tid)}`
          );
          return;
        }
        setSessionUser(null);
        setMyProfile(null);
        setTrainerCard(null);
        setAuthReady(true);
        return;
      }

      setSessionUser(user);

      const { data: me } = await supabase
        .from("profiles")
        .select("role, trainer_id")
        .eq("id", user.id)
        .maybeSingle();

      if (cancelled) return;
      setMyProfile((me ?? null) as MyProfileRow | null);

      if (tid && r === "client") {
        const { data: tr } = await supabase
          .from("profiles")
          .select("full_name, display_name, role")
          .eq("id", tid)
          .maybeSingle();
        if (cancelled) return;
        const row = tr as TrainerCardRow | null;
        if (row?.role === "trainer") {
          setTrainerCard(row);
        } else {
          setTrainerCard(null);
        }
      } else {
        setTrainerCard(null);
      }

      setAuthReady(true);
    }

    void loadAuthAndInviteContext();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void loadAuthAndInviteContext();
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [searchParams, supabase, router]);

  const showTrainerInviteJoin =
    authReady &&
    !!sessionUser &&
    !!trainerIdFromUrl &&
    role === "client";

  async function handleJoinTrainer() {
    if (!trainerIdFromUrl || !sessionUser) return;
    setJoining(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        toast.error("Сессия недействительна. Войдите снова.");
        return;
      }

      const res = await fetch("/api/link-trainer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ trainerId: trainerIdFromUrl }),
      });

      const data = (await res.json().catch(() => ({}))) as { error?: string };

      if (!res.ok) {
        toast.error(data.error ?? "Не удалось присоединиться к тренеру");
        return;
      }

      toast.success("Вы стали клиентом тренера!");
      router.push("/client/me");
      router.refresh();
    } catch (e) {
      console.error("handleJoinTrainer:", e);
      toast.error("Ошибка сети. Попробуйте позже.");
    } finally {
      setJoining(false);
    }
  }

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

  if (!authReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black px-4">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-600 border-t-zinc-100" />
      </div>
    );
  }

  const trainerInviteTitle =
    trainerCard?.display_name?.trim() ||
    trainerCard?.full_name?.trim() ||
    "тренера";

  if (showTrainerInviteJoin && myProfile?.role === "trainer") {
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
        <div className="w-full max-w-md space-y-6 text-center">
          <div className="rounded-2xl border border-amber-900/40 bg-amber-950/20 px-5 py-6">
            <h1 className="text-lg font-semibold text-zinc-50">Это приглашение для клиентов</h1>
            <p className="mt-2 text-sm text-zinc-400">
              Вы вошли как тренер. Чтобы стать клиентом, выйдите из аккаунта и зарегистрируйтесь или войдите
              клиентским профилем.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button asChild variant="outline" className="rounded-xl border-zinc-700 bg-zinc-950 text-zinc-100">
              <Link href="/dashboard">Кабинет тренера</Link>
            </Button>
            <Button asChild className="rounded-xl bg-zinc-100 text-black hover:bg-white">
              <Link href="/login?role=client">Войти как клиент</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (showTrainerInviteJoin && myProfile?.trainer_id === trainerIdFromUrl) {
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
        <div className="w-full max-w-md space-y-6 text-center">
          <div className="rounded-2xl border border-emerald-900/40 bg-emerald-950/20 px-5 py-6">
            <h1 className="text-lg font-semibold text-zinc-50">Вы уже у этого тренера</h1>
            <p className="mt-2 text-sm text-zinc-400">
              Откройте личный кабинет клиента — программы и тренировки уже привязаны к вам.
            </p>
          </div>
          <Button asChild className="w-full rounded-xl bg-zinc-100 py-2.5 text-sm font-medium text-black hover:bg-white">
            <Link href="/client/me">Перейти в кабинет</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (showTrainerInviteJoin) {
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
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900">
              <UserPlus className="size-6 text-zinc-200" aria-hidden />
            </div>
            <h1 className="text-xl font-semibold tracking-tight text-zinc-50">Приглашение тренера</h1>
            <p className="mt-2 text-sm text-zinc-400">
              Вы вошли как{" "}
              <span className="text-zinc-200">{sessionUser?.email ?? "пользователь"}</span>. Подтвердите, что хотите
              стать клиентом <span className="font-medium text-zinc-200">{trainerInviteTitle}</span>.
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-6 shadow-xl">
            <p className="mb-4 text-center text-xs text-zinc-500">
              Новый аккаунт не нужен — достаточно одного нажатия. Данные профиля останутся вашими.
            </p>
            <Button
              type="button"
              disabled={joining}
              onClick={() => void handleJoinTrainer()}
              className="w-full rounded-xl bg-zinc-100 py-2.5 text-sm font-medium text-black hover:bg-white disabled:opacity-50"
            >
              {joining ? "Подключаем..." : "Стать клиентом тренера"}
            </Button>
            <p className="mt-4 text-center text-xs text-zinc-500">
              Нужен другой аккаунт?{" "}
              <button
                type="button"
                className="font-medium text-zinc-300 underline-offset-2 hover:text-zinc-100 hover:underline"
                onClick={() => void supabase.auth.signOut().then(() => router.refresh())}
              >
                Выйти
              </button>
            </p>
          </div>
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
