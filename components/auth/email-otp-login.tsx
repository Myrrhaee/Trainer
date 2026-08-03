"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Check, Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FederatedLoginOptions } from "@/components/auth/federated-login-options";
import { safeReturnPath } from "@/lib/server/http/safe-return-path";

type Step = "email" | "code" | "complete";

interface RequestResponse {
  ok?: boolean;
  challengeId?: string;
  retryAfterSeconds?: number;
  developmentCode?: string;
  error?: string;
}

interface VerifyResponse {
  ok?: boolean;
  remainingAttempts?: number | null;
  error?: string;
}

export function EmailOtpLogin() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState<Step>(() => (
    searchParams.get("federated") === "complete" ? "complete" : "email"
  ));
  const [email, setEmail] = useState("");
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [developmentCode, setDevelopmentCode] = useState<string | null>(null);
  const [retryAfter, setRetryAfter] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const returnPath = safeReturnPath(searchParams.get("next"), "/auth/continue");

  const urlMessage = useMemo(() => {
    const value = searchParams.get("message")?.trim();
    if (value) return value;
    if (searchParams.get("federated") === "error") {
      return "Не удалось завершить вход через провайдера. Используйте email.";
    }
    return null;
  }, [searchParams]);

  useEffect(() => {
    if (retryAfter <= 0) return;
    const timer = window.setInterval(() => {
      setRetryAfter((value) => Math.max(0, value - 1));
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [retryAfter]);

  async function requestCode() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/email/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const payload = await response.json().catch(() => ({})) as RequestResponse;
      if (!response.ok || !payload.challengeId) {
        setError("Сервис входа временно недоступен. Попробуйте ещё раз.");
        return;
      }

      setChallengeId(payload.challengeId);
      setDevelopmentCode(payload.developmentCode ?? null);
      setRetryAfter(payload.retryAfterSeconds ?? 60);
      setCode("");
      setStep("code");
    } catch {
      setError("Не удалось подключиться к сервису входа.");
    } finally {
      setLoading(false);
    }
  }

  async function handleEmailSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim()) return;
    await requestCode();
  }

  async function handleCodeSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!challengeId || code.length !== 6) return;

    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/email/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, challengeId, code }),
      });
      const payload = await response.json().catch(() => ({})) as VerifyResponse;
      if (!response.ok) {
        const suffix = typeof payload.remainingAttempts === "number" && payload.remainingAttempts > 0
          ? ` Осталось попыток: ${payload.remainingAttempts}.`
          : " Запросите новый код.";
        setError(`Код не подошёл или истёк.${suffix}`);
        return;
      }

      setStep("complete");
      setDevelopmentCode(null);
      router.refresh();
    } catch {
      setError("Не удалось проверить код. Попробуйте ещё раз.");
    } finally {
      setLoading(false);
    }
  }

  function changeEmail() {
    setStep("email");
    setCode("");
    setChallengeId(null);
    setDevelopmentCode(null);
    setRetryAfter(0);
    setError(null);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-4 py-16 text-zinc-100">
      <div className="absolute left-4 top-4 sm:left-6 sm:top-6">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-100"
        >
          <Link href="/">
            <ArrowLeft aria-hidden />
            На главную
          </Link>
        </Button>
      </div>

      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-lg bg-zinc-100 text-black shadow-sm">
            {step === "complete" ? <Check aria-hidden /> : <Mail aria-hidden />}
          </div>
          <h1 className="text-xl font-semibold tracking-normal text-zinc-50">
            {step === "complete" ? "Email подтверждён" : "Вход или регистрация"}
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            {step === "email" && "Новый аккаунт создастся после подтверждения email"}
            {step === "code" && `Код отправлен на ${email.trim()}`}
            {step === "complete" && "Безопасная сессия создана"}
          </p>
        </div>

        <section className="rounded-lg border border-zinc-800 bg-zinc-950/80 p-6 shadow-xl">
          {urlMessage && step === "email" && (
            <p className="mb-5 rounded-lg border border-emerald-900/50 bg-emerald-950/25 px-4 py-3 text-sm text-emerald-100" role="status">
              {urlMessage}
            </p>
          )}

          {step === "email" && (
            <div className="space-y-5">
              <FederatedLoginOptions
                returnPath={returnPath}
                onAuthenticated={() => {
                  setStep("complete");
                  router.refresh();
                }}
              />

              <div className="flex items-center gap-3" aria-hidden>
                <span className="h-px flex-1 bg-zinc-800" />
                <span className="text-xs text-zinc-500">или email</span>
                <span className="h-px flex-1 bg-zinc-800" />
              </div>

              <form onSubmit={handleEmailSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="otp-email" className="text-xs font-medium text-zinc-300">
                    Email
                  </Label>
                  <Input
                    id="otp-email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    autoCapitalize="none"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="name@example.com"
                    className="h-10 border-zinc-700 bg-zinc-900 text-zinc-100 focus-visible:ring-zinc-400"
                  />
                </div>

                {error && <p className="text-sm text-rose-400" role="alert">{error}</p>}

                <Button
                  type="submit"
                  disabled={loading || !email.trim()}
                  className="h-10 w-full bg-zinc-100 text-sm text-black hover:bg-white"
                >
                  {loading ? "Отправляем..." : "Получить код"}
                </Button>
              </form>
            </div>
          )}

          {step === "code" && (
            <form onSubmit={handleCodeSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="otp-code" className="text-xs font-medium text-zinc-300">
                  Код из письма
                </Label>
                <Input
                  id="otp-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                  autoFocus
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000"
                  className="h-12 border-zinc-700 bg-zinc-900 text-center font-mono text-xl tracking-normal text-zinc-100 focus-visible:ring-zinc-400"
                />
              </div>

              {developmentCode && (
                <div className="rounded-lg border border-lime-900/50 bg-lime-950/20 px-4 py-3" role="status">
                  <p className="text-xs text-lime-300/75">Локальный код</p>
                  <p className="mt-1 font-mono text-lg text-lime-200">{developmentCode}</p>
                </div>
              )}

              <p className="text-xs leading-relaxed text-zinc-500">
                Если письмо не пришло, проверьте адрес и папку «Спам».
              </p>

              {error && <p className="text-sm text-rose-400" role="alert">{error}</p>}

              <Button
                type="submit"
                disabled={loading || code.length !== 6}
                className="h-10 w-full bg-zinc-100 text-sm text-black hover:bg-white"
              >
                {loading ? "Проверяем..." : "Продолжить"}
              </Button>

              <div className="flex items-center justify-between gap-3 pt-1">
                <button
                  type="button"
                  onClick={changeEmail}
                  className="text-xs font-medium text-zinc-400 hover:text-zinc-200"
                >
                  Изменить email
                </button>
                <button
                  type="button"
                  disabled={loading || retryAfter > 0}
                  onClick={requestCode}
                  className="text-xs font-medium text-zinc-400 hover:text-zinc-200 disabled:cursor-not-allowed disabled:text-zinc-600"
                >
                  {retryAfter > 0 ? `Повторить через ${retryAfter} с` : "Отправить ещё раз"}
                </button>
              </div>
            </form>
          )}

          {step === "complete" && (
            <div className="space-y-5 text-center">
              <p className="text-sm leading-relaxed text-zinc-400">
                Аккаунт готов. Теперь проверим доступное рабочее пространство.
              </p>
              <Button asChild className="h-10 w-full bg-zinc-100 text-black hover:bg-white">
                <Link href={returnPath}>Продолжить</Link>
              </Button>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
