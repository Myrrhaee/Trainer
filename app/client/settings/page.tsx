"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase-client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const supabase = createClient();

type ProfileRow = {
  role: string | null;
  full_name: string | null;
  telegram_link: string | null;
  weight: number | null;
  height: number | null;
  target_weight: number | null;
};

function isValidTelegramLink(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (trimmed.startsWith("@")) return true;
  try {
    const url = new URL(trimmed);
    return url.host === "t.me" || url.host.endsWith(".t.me");
  } catch {
    return false;
  }
}

function formatNumberForInput(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "";
  return String(n);
}

/** null = omit / empty in DB; NaN = invalid */
function parseOptionalNumber(raw: string): number | null | number {
  const s = raw.trim();
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) return Number.NaN;
  return n;
}

export default function ClientSettingsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingMetrics, setSavingMetrics] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);

  const [banner, setBanner] = useState<{ kind: "error" | "success"; text: string } | null>(null);

  const [fullName, setFullName] = useState("");
  const [telegramLink, setTelegramLink] = useState("");

  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [targetWeight, setTargetWeight] = useState("");

  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const telegramLinkValid = useMemo(() => isValidTelegramLink(telegramLink), [telegramLink]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setBanner(null);

      const { data: userRes, error: userErr } = await supabase.auth.getUser();
      if (userErr) console.error("client/settings getUser:", userErr);
      const user = userRes.user;
      if (!user) {
        router.replace("/login?role=client");
        return;
      }

      const { data, error: loadError } = await supabase
        .from("profiles")
        .select("role, full_name, telegram_link, weight, height, target_weight")
        .eq("id", user.id)
        .maybeSingle();

      if (cancelled) return;

      if (loadError) {
        console.error("client/settings load profile:", loadError);
        setBanner({
          kind: "error",
          text: "Не удалось загрузить профиль. Проверьте таблицу profiles, колонки weight/height/target_weight и RLS.",
        });
        setLoading(false);
        return;
      }

      const profile = (data ?? null) as ProfileRow | null;
      if (profile?.role === "trainer") {
        router.replace("/dashboard");
        return;
      }

      setFullName(profile?.full_name ?? "");
      setTelegramLink(profile?.telegram_link ?? "");
      setWeight(formatNumberForInput(profile?.weight));
      setHeight(formatNumberForInput(profile?.height));
      setTargetWeight(formatNumberForInput(profile?.target_weight));
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function handleSaveProfile() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.replace("/login?role=client");
      return;
    }

    setBanner(null);
    const name = fullName.trim();
    if (!name) {
      setBanner({ kind: "error", text: "Введите имя" });
      return;
    }
    if (!telegramLinkValid) {
      setBanner({
        kind: "error",
        text: "Некорректный Telegram. Используйте @username или https://t.me/username",
      });
      return;
    }

    setSavingProfile(true);
    try {
      const profileUpdatePayload: Record<string, unknown> = {
        full_name: name,
        telegram_link: telegramLink.trim() || null,
      };
      const sessionUserId = user.id;
      console.log("[client/settings] перед profiles.update (профиль)", {
        updatePayload: { ...profileUpdatePayload },
        eqId: user.id,
        sessionUserIdFromGetUser: sessionUserId,
        idsMatch: user.id === sessionUserId,
        payloadHasUndefined: Object.values(profileUpdatePayload).some((v) => v === undefined),
        payloadKeys: Object.keys(profileUpdatePayload),
      });

      const { error: updateError } = await supabase
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        .from("profiles")
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        .update(profileUpdatePayload as Record<string, unknown>)
        .eq("id", user.id);

      if (updateError) {
        console.error("client/settings profile update:", updateError);
        setBanner({ kind: "error", text: "Не удалось сохранить профиль." });
        return;
      }
    } finally {
      setSavingProfile(false);
    }

    router.refresh();
    setBanner({ kind: "success", text: "Профиль сохранён" });
  }

  async function handleSaveMetrics() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.replace("/login?role=client");
      return;
    }

    setBanner(null);

    const w = parseOptionalNumber(weight);
    const h = parseOptionalNumber(height);
    const tw = parseOptionalNumber(targetWeight);

    if (Number.isNaN(w)) {
      setBanner({ kind: "error", text: "Укажите корректный вес или оставьте поле пустым." });
      return;
    }
    if (Number.isNaN(h)) {
      setBanner({ kind: "error", text: "Укажите корректный рост или оставьте поле пустым." });
      return;
    }
    if (Number.isNaN(tw)) {
      setBanner({ kind: "error", text: "Укажите корректный целевой вес или оставьте поле пустым." });
      return;
    }

    setSavingMetrics(true);
    try {
      const metricsUpdatePayload: Record<string, unknown> = {
        weight: w,
        height: h,
        target_weight: tw,
      };
      const sessionUserIdMetrics = user.id;
      console.log("[client/settings] перед profiles.update (параметры)", {
        updatePayload: { ...metricsUpdatePayload },
        eqId: user.id,
        sessionUserIdFromGetUser: sessionUserIdMetrics,
        idsMatch: user.id === sessionUserIdMetrics,
        payloadHasUndefined: Object.values(metricsUpdatePayload).some((v) => v === undefined),
        payloadKeys: Object.keys(metricsUpdatePayload),
      });

      const { error: updateError } = await supabase
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        .from("profiles")
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        .update(metricsUpdatePayload as Record<string, unknown>)
        .eq("id", user.id);

      if (updateError) {
        console.error("client/settings metrics update:", updateError);
        if (updateError.message?.includes("column") || updateError.code === "42703") {
          setBanner({
            kind: "error",
            text: "Добавьте в profiles колонки weight, height, target_weight (см. supabase/migrations).",
          });
        } else {
          setBanner({ kind: "error", text: "Не удалось сохранить параметры." });
        }
        return;
      }
    } finally {
      setSavingMetrics(false);
    }

    router.refresh();
    setBanner({ kind: "success", text: "Параметры сохранены" });
  }

  async function handleUpdatePassword() {
    setBanner(null);
    const pwd = newPassword.trim();
    if (!pwd) {
      setBanner({ kind: "error", text: "Введите новый пароль" });
      return;
    }
    if (pwd.length < 6) {
      setBanner({ kind: "error", text: "Пароль не короче 6 символов" });
      return;
    }

    setUpdatingPassword(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password: pwd });

      if (updateError) {
        console.error("client/settings updateUser password:", updateError);
        setBanner({
          kind: "error",
          text: updateError.message ?? "Не удалось обновить пароль",
        });
        return;
      }
    } finally {
      setUpdatingPassword(false);
    }

    setNewPassword("");
    setShowPassword(false);
    router.refresh();
    setBanner({ kind: "success", text: "Пароль обновлён" });
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-600 border-t-zinc-100" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-foreground">
      <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-10">
        <header className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">Настройки</h1>
            <p className="text-sm text-zinc-400">
              Профиль, антропометрия и безопасность аккаунта.
            </p>
          </div>
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="rounded-full text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-100"
          >
            <Link href="/client/me">Назад</Link>
          </Button>
        </header>

        {banner && (
          <div
            className={[
              "rounded-2xl border px-4 py-3 text-sm",
              banner.kind === "error"
                ? "border-rose-900/60 bg-rose-950/30 text-rose-200"
                : "border-emerald-900/60 bg-emerald-950/20 text-emerald-200",
            ].join(" ")}
            role={banner.kind === "error" ? "alert" : "status"}
          >
            {banner.text}
          </div>
        )}

        {/* Профиль */}
        <Card className="rounded-2xl border border-zinc-800 bg-zinc-950/80 shadow-[0_0_0_1px_rgba(255,255,255,0.03)]">
          <CardHeader>
            <CardTitle className="text-zinc-50">Профиль</CardTitle>
            <CardDescription className="text-zinc-400">
              Имя и Telegram для связи с тренером.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="clientFullName" className="text-xs font-medium text-zinc-300">
                Имя
              </Label>
              <Input
                id="clientFullName"
                type="text"
                autoComplete="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Как к вам обращаться"
                className="h-10 rounded-xl border-zinc-800 bg-zinc-900 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-zinc-400"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="clientTelegram" className="text-xs font-medium text-zinc-300">
                Telegram
              </Label>
              <Input
                id="clientTelegram"
                type="text"
                value={telegramLink}
                onChange={(e) => setTelegramLink(e.target.value)}
                placeholder="@username или https://t.me/username"
                className={[
                  "h-10 rounded-xl border bg-zinc-900 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-zinc-400",
                  telegramLinkValid ? "border-zinc-800" : "border-rose-700/70",
                ].join(" ")}
              />
              {!telegramLinkValid && (
                <p className="text-xs text-rose-300">
                  Используйте @username или ссылку вида https://t.me/username
                </p>
              )}
            </div>
            <div className="flex justify-end pt-1">
              <Button
                type="button"
                onClick={() => void handleSaveProfile()}
                disabled={savingProfile}
                className="rounded-xl bg-zinc-100 px-6 text-sm font-medium text-black hover:bg-white disabled:opacity-50"
              >
                {savingProfile ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                    Сохраняем...
                  </>
                ) : (
                  "Сохранить"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Параметры (антропометрия) */}
        <Card className="rounded-2xl border border-zinc-800 bg-zinc-950/80 shadow-[0_0_0_1px_rgba(255,255,255,0.03)]">
          <CardHeader>
            <CardTitle className="text-zinc-50">Параметры</CardTitle>
            <CardDescription className="text-zinc-400">
              Антропометрия: вес, рост и целевой вес (кг / см — уточните у тренера).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="weight" className="text-xs font-medium text-zinc-300">
                  Вес
                </Label>
                <Input
                  id="weight"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder="—"
                  className="h-10 rounded-xl border-zinc-800 bg-zinc-900 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-zinc-400 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="height" className="text-xs font-medium text-zinc-300">
                  Рост
                </Label>
                <Input
                  id="height"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  placeholder="—"
                  className="h-10 rounded-xl border-zinc-800 bg-zinc-900 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-zinc-400 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="target_weight" className="text-xs font-medium text-zinc-300">
                  Целевой вес
                </Label>
                <Input
                  id="target_weight"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  value={targetWeight}
                  onChange={(e) => setTargetWeight(e.target.value)}
                  placeholder="—"
                  className="h-10 rounded-xl border-zinc-800 bg-zinc-900 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-zinc-400 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
              </div>
            </div>
            <p className="text-xs text-zinc-500">
              Пустые поля в базе сохраняются как пустые значения. Только положительные числа.
            </p>
            <div className="flex justify-end pt-1">
              <Button
                type="button"
                onClick={() => void handleSaveMetrics()}
                disabled={savingMetrics}
                className="rounded-xl bg-zinc-100 px-6 text-sm font-medium text-black hover:bg-white disabled:opacity-50"
              >
                {savingMetrics ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                    Сохраняем...
                  </>
                ) : (
                  "Сохранить"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Безопасность */}
        <Card className="rounded-2xl border border-zinc-800 bg-zinc-950/80 shadow-[0_0_0_1px_rgba(255,255,255,0.03)]">
          <CardHeader>
            <CardTitle className="text-zinc-50">Безопасность</CardTitle>
            <CardDescription className="text-zinc-400">
              Новый пароль для входа по email. После смены используйте его при следующем входе.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword" className="text-xs font-medium text-zinc-300">
                Новый пароль
              </Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Не менее 6 символов"
                  className="h-10 rounded-xl border-zinc-800 bg-zinc-900 pr-10 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-zinc-400"
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
            <div className="flex justify-end pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleUpdatePassword()}
                disabled={updatingPassword}
                className="rounded-xl border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800 disabled:opacity-50"
              >
                {updatingPassword ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                    Обновляем...
                  </>
                ) : (
                  "Обновить пароль"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
