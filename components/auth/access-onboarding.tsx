"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Dumbbell, Link2, LoaderCircle, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Context = {
  displayName: string | null;
  trainer: { status: "pending" | "active" | "suspended" | "archived" } | null;
  athlete: { status: "active" | "suspended" | "archived" } | null;
  destination: "/trainer/dashboard" | "/client/me" | "/onboarding" | "/workspaces";
};

export function AccessOnboarding({
  invitationToken,
  initiallyAuthenticated,
}: {
  invitationToken: string | null;
  initiallyAuthenticated: boolean;
}) {
  const [context, setContext] = useState<Context | null>(null);
  const [authenticated, setAuthenticated] = useState<boolean | null>(initiallyAuthenticated ? null : false);
  const [busy, setBusy] = useState<"profile" | "trainer" | "athlete" | "context" | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!initiallyAuthenticated) return;
    void loadContext();
  }, [initiallyAuthenticated]);

  async function loadContext() {
    const response = await fetch("/api/access/context", { cache: "no-store" });
    if (response.status === 401) {
      setAuthenticated(false);
      return;
    }
    if (!response.ok) {
      setMessage("Сервис профилей временно недоступен.");
      return;
    }
    const next = await response.json() as Context;
    setContext(next);
    setDisplayName((current) => current.trim() ? current : next.displayName ?? "");
    setAuthenticated(true);
  }

  async function saveProfile() {
    if (displayName.trim().length < 2) {
      setMessage("Укажите имя длиной не менее двух символов.");
      return;
    }
    setBusy("profile");
    setMessage(null);
    try {
      const response = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName }),
      });
      if (!response.ok) throw new Error("profile_failed");
      await loadContext();
      setMessage("Имя сохранено.");
    } catch {
      setMessage("Не удалось сохранить имя. Попробуйте ещё раз.");
    } finally {
      setBusy(null);
    }
  }

  async function requestTrainer() {
    if (!context?.displayName) {
      setMessage("Сначала сохраните имя.");
      return;
    }
    setBusy("trainer");
    setMessage(null);
    try {
      const response = await fetch("/api/access/trainer-request", { method: "POST" });
      if (!response.ok) throw new Error("request_failed");
      await loadContext();
      setMessage("Заявка принята. Доступ тренера активируется вручную для closed alpha.");
    } catch {
      setMessage("Не удалось отправить заявку. Попробуйте ещё раз.");
    } finally {
      setBusy(null);
    }
  }

  async function refreshContext() {
    setBusy("context");
    setMessage(null);
    try {
      await loadContext();
    } finally {
      setBusy(null);
    }
  }

  async function acceptInvitation() {
    if (!invitationToken) return;
    if (!context?.displayName) {
      setMessage("Сначала сохраните имя.");
      return;
    }
    setBusy("athlete");
    setMessage(null);
    try {
      const response = await fetch("/api/access/invitations/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: invitationToken }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) {
        setMessage(payload.error === "relation_conflict"
          ? "У аккаунта уже есть другой активный основной тренер."
          : "Приглашение недействительно, истекло или уже использовано.");
        return;
      }
      window.location.assign("/client/me");
    } catch {
      setMessage("Не удалось принять приглашение. Попробуйте ещё раз.");
    } finally {
      setBusy(null);
    }
  }

  const returnPath = invitationToken
    ? `/onboarding?invite=${encodeURIComponent(invitationToken)}`
    : "/onboarding";

  return (
    <main className="flex min-h-dvh items-center justify-center bg-black px-4 py-16 text-zinc-100">
      <section className="w-full max-w-xl border-y border-zinc-800 py-8 sm:border sm:p-8">
        <p className="text-xs font-medium uppercase text-lime-300">AI Strength Coach</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-normal">Настройка рабочего пространства</h1>
        <p className="mt-2 max-w-lg text-sm leading-relaxed text-zinc-400">
          Аккаунт подтверждает личность. Рабочие права тренера и спортсмена подключаются отдельно.
        </p>

        {authenticated === null && (
          <div className="mt-8 flex items-center gap-3 text-sm text-zinc-400" role="status">
            <LoaderCircle className="size-4 animate-spin" aria-hidden />
            Проверяем аккаунт
          </div>
        )}

        {authenticated === false && (
          <div className="mt-8 border-t border-zinc-800 pt-6">
            <p className="text-sm text-zinc-300">Сначала войдите в аккаунт, затем вернитесь к настройке.</p>
            <Button asChild className="mt-4 bg-zinc-100 text-black hover:bg-white">
              <Link href={`/login?next=${encodeURIComponent(returnPath)}`}>
                Войти <ArrowRight aria-hidden />
              </Link>
            </Button>
          </div>
        )}

        {authenticated && context && (
          <>
            <div className="mt-8 border border-zinc-800 bg-zinc-950 p-5">
              <Label htmlFor="onboarding-display-name" className="text-sm text-zinc-300">Как вас зовут</Label>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <Input
                  id="onboarding-display-name"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  maxLength={120}
                  autoComplete="name"
                  placeholder="Имя и фамилия"
                  className="min-h-11 border-zinc-700 bg-black"
                />
                <Button type="button" variant="outline" disabled={busy !== null || displayName.trim().length < 2 || displayName.trim() === context.displayName} onClick={() => void saveProfile()} className="min-h-11 border-zinc-700">
                  {busy === "profile" ? "Сохраняем..." : context.displayName ? "Обновить" : "Сохранить"}
                </Button>
              </div>
              <p className="mt-2 text-xs text-zinc-500">Это имя увидят ваш тренер или спортсмены.</p>
            </div>
            <div className="mt-4 grid gap-px overflow-hidden border border-zinc-800 bg-zinc-800 sm:grid-cols-2">
              <div className="bg-zinc-950 p-5">
                <Dumbbell className="size-5 text-lime-300" aria-hidden />
                <h2 className="mt-4 text-base font-semibold">Пространство тренера</h2>
                <p className="mt-2 min-h-10 text-sm text-zinc-500">
                  Для closed alpha требуется ручная активация.
                </p>
                {context.trainer?.status === "active" ? (
                  <Button asChild className="mt-5 w-full bg-zinc-100 text-black hover:bg-white">
                    <Link href="/trainer/dashboard">Открыть кабинет</Link>
                  </Button>
                ) : context.trainer?.status === "pending" ? (
                  <div className="mt-5 space-y-3">
                    <p className="flex min-h-10 items-center gap-2 text-sm text-amber-300">
                      <Check className="size-4" aria-hidden /> Заявка ожидает активации
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={busy !== null}
                      onClick={() => void refreshContext()}
                      className="w-full border-zinc-700 bg-transparent"
                    >
                      <RefreshCw className={busy === "context" ? "animate-spin" : ""} aria-hidden />
                      Проверить доступ
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy !== null}
                    onClick={() => void requestTrainer()}
                    className="mt-5 w-full border-zinc-700 bg-transparent"
                  >
                    {busy === "trainer" ? "Отправляем..." : "Запросить доступ"}
                  </Button>
                )}
              </div>

              <div className="bg-zinc-950 p-5">
                <Link2 className="size-5 text-lime-300" aria-hidden />
                <h2 className="mt-4 text-base font-semibold">Пространство спортсмена</h2>
                <p className="mt-2 min-h-10 text-sm text-zinc-500">
                  Доступ создаётся по одноразовому приглашению тренера.
                </p>
                {context.athlete?.status === "active" ? (
                  <Button asChild className="mt-5 w-full bg-zinc-100 text-black hover:bg-white">
                    <Link href="/client/me">Открыть кабинет</Link>
                  </Button>
                ) : invitationToken ? (
                  <Button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => void acceptInvitation()}
                    className="mt-5 w-full bg-lime-300 text-black hover:bg-lime-200"
                  >
                    {busy === "athlete" ? "Подключаем..." : "Принять приглашение"}
                  </Button>
                ) : (
                  <p className="mt-5 flex h-10 items-center text-sm text-zinc-500">Нужна ссылка тренера</p>
                )}
              </div>
            </div>
          </>
        )}

        {message && <p className="mt-5 text-sm text-zinc-300" role="status">{message}</p>}
      </section>
    </main>
  );
}
