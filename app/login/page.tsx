"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Info } from "lucide-react";
import { createClient } from "@/lib/supabase-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type LoginType = "trainer" | "client";
const TEST_ADMIN_LOGIN = "admin";
const TEST_TRAINER_EMAIL = "admin.trainer@local.test";
const TEST_CLIENT_EMAIL = "admin.client@local.test";
const TEST_LOGIN_SET = new Set([TEST_ADMIN_LOGIN, TEST_TRAINER_EMAIL, TEST_CLIENT_EMAIL]);

function resolveLoginEmail(raw: string, loginType: LoginType): string {
  const normalized = raw.trim().toLowerCase();
  if (normalized === TEST_ADMIN_LOGIN) {
    return loginType === "trainer" ? TEST_TRAINER_EMAIL : TEST_CLIENT_EMAIL;
  }
  return normalized;
}

function roleFromSearchParams(searchParams: URLSearchParams | null): LoginType {
  if (!searchParams) return "client";
  return searchParams.get("role") === "trainer" ? "trainer" : "client";
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);
  if (supabaseRef.current === null) supabaseRef.current = createClient();
  const supabase = supabaseRef.current;

  const [loginType, setLoginType] = useState<LoginType>(() =>
    roleFromSearchParams(searchParams)
  );

  // Синхронизация вкладки с URL при загрузке и при смене параметров (назад/вперёд)
  useEffect(() => {
    setLoginType(roleFromSearchParams(searchParams));
  }, [searchParams]);

  const urlMessage = useMemo(() => {
    const raw = searchParams.get("message");
    if (raw == null || !String(raw).trim()) return null;
    try {
      return decodeURIComponent(String(raw).replace(/\+/g, " "));
    } catch {
      return String(raw).replace(/\+/g, " ");
    }
  }, [searchParams]);

  const trainerIdFromUrl = useMemo(
    () => searchParams.get("trainer_id")?.trim() || null,
    [searchParams]
  );

  function setRoleAndUrl(role: LoginType) {
    setLoginType(role);
    const params = new URLSearchParams();
    params.set("role", role);
    const msg = searchParams.get("message");
    if (msg) params.set("message", msg);
    const tid = searchParams.get("trainer_id");
    if (tid) params.set("trainer_id", tid);
    router.replace(`/login?${params.toString()}`);
  }
  const [isSignUp, setIsSignUp] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ensureProfile(
    userId: string,
    role: "client" | "trainer",
    name: string,
    userEmail: string,
    inviteTrainerId?: string | null
  ) {
    try {
      await fetch("/api/ensure-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          role,
          fullName: name,
          email: userEmail,
          ...(role === "client" && inviteTrainerId ? { trainerId: inviteTrainerId } : {}),
        }),
      });
    } catch {
      // ignore
    }
  }

  async function linkToTrainerFromInvite(accessToken: string, trainerId: string): Promise<{ ok: true } | { ok: false; error: string }> {
    const res = await fetch("/api/link-trainer", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ trainerId }),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      return { ok: false, error: json.error ?? "Не удалось присоединиться к тренеру" };
    }
    return { ok: true };
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) return;
    setLoading(true);

    try {
      const typedLogin = email.trim().toLowerCase();
      const normalizedEmail = resolveLoginEmail(email, loginType);
      const normalizedName = fullName.trim();

      // If user enters any test login, ensure test users + profiles exist.
      if (!isSignUp && TEST_LOGIN_SET.has(typedLogin)) {
        try {
          await fetch("/api/seed-test-users", { method: "POST" });
        } catch (seedErr) {
          console.error("seed-test-users call failed:", seedErr);
        }
      }

      // 1) Pre-check email existence in profiles
      if (!isSignUp) {
        const { data: existing, error: existsErr } = await supabase
          .from("profiles")
          .select("id")
          .eq("email", normalizedEmail)
          .maybeSingle();

        if (existsErr && !existing) {
          console.error("login profiles email check failed:", existsErr);
          setError("Не удалось проверить почту. Попробуйте позже.");
          return;
        }

        if (!existing) {
          setError("Пользователь с такой почтой не зарегистрирован");
          return;
        }
      }

      if (isSignUp) {
        if (!normalizedName) {
          setError("Введите имя");
          return;
        }

        const { data, error: err } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
        });

        if (err) {
          setError(err.message ?? "Ошибка регистрации");
          return;
        }

        const userId = data.user?.id;
        if (userId) {
          const role: "client" | "trainer" = loginType === "trainer" ? "trainer" : "client";
          const inviteTid = role === "client" ? trainerIdFromUrl : null;
          await ensureProfile(
            userId,
            role,
            normalizedName,
            data.user?.email ?? normalizedEmail,
            inviteTid
          );
          router.refresh();
          router.push(role === "client" ? "/client/me" : "/dashboard");
          return;
        }

        router.refresh();
        router.push("/login");
        return;
      }

      const { data, error: err } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

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
        const PROFILE_SYNC_TIMEOUT_MS = 10_000;

        const { data: profile, error: profileErr } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", userId)
          .maybeSingle();

        if (profileErr) {
          console.error("profiles role load failed:", profileErr);
        }

        let role = (profile as { role?: string | null } | null)?.role ?? null;

        // Если профиля нет — принудительно вызываем ensure-profile и ждём появления профиля (таймаут 10 с)
        if (!role) {
          const newRole = loginType === "trainer" ? "trainer" : "client";
          const inviteTid = newRole === "client" ? trainerIdFromUrl : null;
          await ensureProfile(userId, newRole, normalizedName || "", normalizedEmail, inviteTid);

          const deadline = Date.now() + PROFILE_SYNC_TIMEOUT_MS;
          while (Date.now() < deadline) {
            const { data: retryProfile } = await supabase
              .from("profiles")
              .select("role")
              .eq("id", userId)
              .maybeSingle();
            const retryRole = (retryProfile as { role?: string | null } | null)?.role ?? null;
            if (retryRole) {
              role = retryRole;
              break;
            }
            await new Promise((r) => setTimeout(r, 1000));
          }

          if (!role) {
            setError("Ошибка синхронизации профиля");
            return;
          }
        }

        console.log("Профиль найден, роль:", role);

        if (role === "client" && trainerIdFromUrl) {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          const token = session?.access_token;
          if (token) {
            const linked = await linkToTrainerFromInvite(token, trainerIdFromUrl);
            if (!linked.ok) {
              setError(linked.error);
              return;
            }
          }
        }

        router.refresh();
        if (role === "client") {
          router.push("/client/me");
          return;
        }
        router.push("/dashboard");
        return;
      }

      router.refresh();
      router.push("/dashboard");
    } finally {
      setLoading(false);
    }
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
                onClick={() => setRoleAndUrl("client")}
                className={[
                  "rounded-full px-4 py-2 text-xs font-semibold transition",
                  loginType === "client"
                    ? "bg-zinc-100 text-black"
                    : "text-zinc-400 hover:text-zinc-200",
                ].join(" ")}
              >
                Войти как Клиент
              </button>
              <button
                type="button"
                onClick={() => setRoleAndUrl("trainer")}
                className={[
                  "rounded-full px-4 py-2 text-xs font-semibold transition",
                  loginType === "trainer"
                    ? "bg-zinc-100 text-black"
                    : "text-zinc-400 hover:text-zinc-200",
                ].join(" ")}
              >
                Войти как Тренер
              </button>
            </div>
          </div>

          {trainerIdFromUrl && loginType === "client" && (
            <div
              role="status"
              className="mb-5 rounded-xl border border-sky-900/45 bg-sky-950/25 px-4 py-3 text-left text-sm text-sky-100/95 ring-1 ring-sky-500/10"
            >
              <p className="font-medium text-sky-50">Приглашение тренера</p>
              <p className="mt-1 text-xs leading-relaxed text-sky-200/80">
                {isSignUp
                  ? "Создайте аккаунт — вы автоматически станете клиентом этого тренера. Уже есть аккаунт? Переключитесь на вход."
                  : "Войдите в аккаунт — после входа вы будете присоединены к тренеру. Нет аккаунта? Нажмите «Зарегистрироваться» ниже."}
              </p>
            </div>
          )}

          {urlMessage && !isSignUp && (
            <div
              role="status"
              className="mb-5 flex gap-3 rounded-xl border border-emerald-900/50 bg-emerald-950/25 px-4 py-3 text-left ring-1 ring-emerald-500/10"
            >
              <Info
                className="mt-0.5 size-4 shrink-0 text-emerald-400/90"
                aria-hidden
              />
              <p className="text-sm leading-relaxed text-emerald-100/95">{urlMessage}</p>
            </div>
          )}

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
                autoCapitalize="none"
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
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={isSignUp ? "new-password" : "current-password"}
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
                setShowPassword(false);
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

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-black">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-600 border-t-zinc-100" />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
