"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, Eye, EyeOff, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase-client";
import { useTrainer } from "@/lib/auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type ProfileRow = {
  full_name: string | null;
  email: string | null;
  display_name: string | null;
  team_logo_url: string | null;
  telegram_link: string | null;
  slug?: string | null;
  is_public?: boolean | null;
};

const supabase = createClient();

const SLUG_RE = /^[a-z0-9-]+$/;

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

export default function TrainerSettingsPage() {
  const router = useRouter();
  const { trainerId } = useTrainer();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [publicOrigin, setPublicOrigin] = useState("");
  const [profileEmail, setProfileEmail] = useState("");

  const [fullName, setFullName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [telegramLink, setTelegramLink] = useState("");
  const [teamLogoUrl, setTeamLogoUrl] = useState<string | null>(null);
  const [slug, setSlug] = useState("");
  const [isPublic, setIsPublic] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);

  const telegramLinkValid = useMemo(() => isValidTelegramLink(telegramLink), [telegramLink]);
  const newPasswordValid = useMemo(
    () => newPassword.trim().length > 6,
    [newPassword]
  );
  const normalizedSlug = useMemo(() => slug.trim().toLowerCase(), [slug]);
  const slugValid = useMemo(() => {
    if (!normalizedSlug) return true;
    return SLUG_RE.test(normalizedSlug);
  }, [normalizedSlug]);

  const slugPrefix = useMemo(
    () => (publicOrigin ? `${publicOrigin}/t/` : "/t/"),
    [publicOrigin]
  );

  useEffect(() => {
    setPublicOrigin(typeof window !== "undefined" ? window.location.origin : "");
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!trainerId) return;
      setLoading(true);
      setError(null);
      setSuccess(null);

      const [{ data: userRes }, { data, error: loadError }] = await Promise.all([
        supabase.auth.getUser(),
        supabase
          .from("profiles")
          .select("full_name, email, display_name, team_logo_url, telegram_link, slug, is_public")
          .eq("id", trainerId)
          .maybeSingle(),
      ]);

      if (cancelled) return;

      if (loadError) {
        console.error("settings: load profile failed:", loadError);
        setError("Не удалось загрузить профиль. Попробуйте позже.");
        setLoading(false);
        return;
      }

      const profile = (data ?? null) as ProfileRow | null;
      const authEmail = userRes.user?.email?.trim().toLowerCase() ?? "";
      const rowEmail = (profile?.email ?? "").trim().toLowerCase();
      setProfileEmail(rowEmail || authEmail);

      setFullName(profile?.full_name ?? "");
      setDisplayName(profile?.display_name ?? "");
      setTelegramLink(profile?.telegram_link ?? "");
      setTeamLogoUrl(profile?.team_logo_url ?? null);
      setSlug((profile?.slug ?? "") as string);
      setIsPublic(Boolean(profile?.is_public));
      setLoading(false);
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [trainerId]);

  function openPublicProfile() {
    if (!normalizedSlug || typeof window === "undefined") return;
    const url = publicOrigin
      ? `${publicOrigin}/t/${encodeURIComponent(normalizedSlug)}`
      : `/t/${encodeURIComponent(normalizedSlug)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function handleSave() {
    if (!trainerId) return;
    setError(null);
    setSuccess(null);

    const { data: authData, error: authErr } = await supabase.auth.getUser();
    const authUserId = authData.user?.id ?? null;
    if (authErr || !authUserId || authUserId !== trainerId) {
      setError("Не удалось подтвердить аккаунт. Войдите снова.");
      return;
    }

    const normalizedFullName = fullName.trim();
    const normalizedDisplayName = displayName.trim();
    const normalizedTelegramLink = telegramLink.trim();
    const nextSlug = normalizedSlug;

    if (!normalizedFullName) {
      setError("Введите имя");
      return;
    }
    if (!telegramLinkValid) {
      setError("Некорректная ссылка на Telegram. Используйте @username или https://t.me/username");
      return;
    }
    if (!slugValid) {
      setError("Некорректный URL профиля. Разрешены только латиница, цифры и тире.");
      return;
    }

    setSaving(true);
    try {
      if (nextSlug) {
        const { data: taken, error: slugErr } = await supabase
          .from("profiles")
          .select("id")
          .eq("slug", nextSlug)
          .neq("id", authUserId)
          .maybeSingle();

        if (slugErr) {
          console.error("settings: slug check failed:", slugErr);
          setError("Не удалось проверить URL профиля. Попробуйте позже.");
          return;
        }
        if (taken?.id) {
          setError("Этот URL профиля уже занят. Придумайте другой.");
          return;
        }
      }

      const updatePayload: Record<string, unknown> = {
        full_name: normalizedFullName,
        display_name: normalizedDisplayName || null,
        telegram_link: normalizedTelegramLink || null,
        slug: nextSlug || null,
        is_public: isPublic,
      };

      const sessionUserId = authData.user?.id ?? null;
      console.log("[trainer/settings] перед profiles.update (основное сохранение)", {
        updatePayload: { ...updatePayload },
        eqId: authUserId,
        sessionUserIdFromGetUser: sessionUserId,
        idsMatch: sessionUserId != null && authUserId === sessionUserId,
        payloadHasUndefined: Object.values(updatePayload).some((v) => v === undefined),
        payloadKeys: Object.keys(updatePayload),
      });

      const { error: updateError } = await supabase
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        .from("profiles")
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        .update(updatePayload as Record<string, unknown>)
        .eq("id", authUserId);

      if (updateError) {
        console.error("settings: profile update failed:", updateError);
        setError("Не удалось сохранить изменения. Проверьте доступы Supabase/RLS.");
        return;
      }
    } finally {
      setSaving(false);
    }

    router.refresh();
    setSuccess("Изменения сохранены");
    setTimeout(() => setSuccess(null), 2500);
  }

  async function uploadLogo(file: File) {
    if (!trainerId) return;
    setError(null);
    setSuccess(null);

    const { data: authData, error: authErr } = await supabase.auth.getUser();
    const authUserId = authData.user?.id ?? null;
    if (authErr || !authUserId || authUserId !== trainerId) {
      setError("Не удалось подтвердить аккаунт. Войдите снова.");
      return;
    }

    const maxSizeBytes = 5 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      setError("Файл слишком большой. Максимум 5 МБ.");
      return;
    }

    setUploading(true);

    const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const objectPath = `${trainerId}/${Date.now()}-${safeFileName}`;

    const { error: uploadError } = await supabase.storage
      .from("logos")
      .upload(objectPath, file, { upsert: true, contentType: file.type || "image/png" });

    if (uploadError) {
      console.error("settings: logo upload failed:", uploadError);
      setUploading(false);
      setError("Не удалось загрузить логотип. Проверьте bucket `logos` и политики доступа.");
      return;
    }

    const { data: publicUrlData } = supabase.storage.from("logos").getPublicUrl(objectPath);
    const publicUrl = publicUrlData?.publicUrl ?? null;

    if (!publicUrl) {
      setUploading(false);
      setError("Не удалось получить ссылку на логотип после загрузки.");
      return;
    }

    const logoUpdatePayload: Record<string, unknown> = { team_logo_url: publicUrl };
    const sessionUserIdLogo = authData.user?.id ?? null;
    console.log("[trainer/settings] перед profiles.update (логотип)", {
      updatePayload: { ...logoUpdatePayload },
      eqId: authUserId,
      sessionUserIdFromGetUser: sessionUserIdLogo,
      idsMatch: sessionUserIdLogo != null && authUserId === sessionUserIdLogo,
      payloadHasUndefined: Object.values(logoUpdatePayload).some((v) => v === undefined),
      payloadKeys: Object.keys(logoUpdatePayload),
    });

    const { error: updateError } = await supabase
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      .from("profiles")
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      .update(logoUpdatePayload as Record<string, unknown>)
      .eq("id", authUserId);

    setUploading(false);
    if (updateError) {
      console.error("settings: team_logo_url update failed:", updateError);
      setError("Логотип загружен, но не удалось сохранить ссылку в профиле.");
      return;
    }

    router.refresh();
    setTeamLogoUrl(publicUrl);
    setSuccess("Логотип обновлён");
    setTimeout(() => setSuccess(null), 2500);
  }

  async function handleSaveNewPassword() {
    if (!newPasswordValid) return;
    setError(null);
    setSuccess(null);
    setPasswordSaving(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword.trim(),
      });
      if (updateError) {
        console.error("settings: password update failed:", updateError);
        setError(updateError.message ?? "Не удалось обновить пароль");
        return;
      }
      setNewPassword("");
      setShowNewPassword(false);
      router.refresh();
      setSuccess("Новый пароль сохранён");
      setTimeout(() => setSuccess(null), 2500);
    } finally {
      setPasswordSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-600 border-t-zinc-100" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-foreground">
      <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-10">
        <header className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
              Настройки профиля
            </h1>
            <p className="text-sm text-zinc-400">
              Профиль, брендинг и публичная страница.
            </p>
          </div>
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="rounded-full text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-100"
          >
            <Link href="/dashboard">Назад</Link>
          </Button>
        </header>

        {(error || success) && (
          <div
            className={[
              "rounded-2xl border px-4 py-3 text-sm",
              error
                ? "border-rose-900/60 bg-rose-950/30 text-rose-200"
                : "border-emerald-900/60 bg-emerald-950/20 text-emerald-200",
            ].join(" ")}
            role={error ? "alert" : "status"}
          >
            {error ?? success}
          </div>
        )}

        {/* Профиль */}
        <Card className="rounded-2xl border-zinc-800 bg-zinc-950/80">
          <CardHeader>
            <CardTitle className="text-zinc-50">Профиль</CardTitle>
            <CardDescription className="text-zinc-400">
              Личные данные и контакт в Telegram.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName" className="text-xs font-medium text-zinc-300">
                Полное имя
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
              <Label htmlFor="profileEmail" className="text-xs font-medium text-zinc-300">
                Email
              </Label>
              <Input
                id="profileEmail"
                type="email"
                readOnly
                disabled
                value={profileEmail}
                className="h-10 cursor-not-allowed rounded-xl border-zinc-700 bg-zinc-900/60 text-zinc-400"
              />
              <p className="text-xs text-zinc-500">Почта привязана к аккаунту и не редактируется здесь.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="telegramLink" className="text-xs font-medium text-zinc-300">
                Telegram
              </Label>
              <Input
                id="telegramLink"
                type="text"
                value={telegramLink}
                onChange={(e) => setTelegramLink(e.target.value)}
                placeholder="@username или https://t.me/username"
                className={[
                  "h-10 rounded-xl border bg-zinc-900 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-zinc-400",
                  telegramLinkValid ? "border-zinc-700" : "border-rose-700/70",
                ].join(" ")}
              />
              {!telegramLinkValid && (
                <p className="text-xs text-rose-300">
                  Используйте @username или ссылку вида https://t.me/username
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Брендинг */}
        <Card className="rounded-2xl border-zinc-800 bg-zinc-950/80">
          <CardHeader>
            <CardTitle className="text-zinc-50">Брендинг</CardTitle>
            <CardDescription className="text-zinc-400">
              Название команды и логотип на публичной странице.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="displayName" className="text-xs font-medium text-zinc-300">
                Название команды
              </Label>
              <Input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Strong Team"
                className="h-10 rounded-xl border-zinc-700 bg-zinc-900 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-zinc-400"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-[112px_1fr] sm:items-center">
              <div className="flex items-center gap-3">
                <div className="h-16 w-16 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
                  {teamLogoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={teamLogoUrl}
                      alt="Логотип команды"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-zinc-500">
                      LOGO
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  <div className="text-sm font-medium text-zinc-100">Логотип</div>
                  <div className="text-xs text-zinc-500">PNG/JPG, до 5 МБ</div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    await uploadLogo(file);
                    e.currentTarget.value = "";
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl border-zinc-800 bg-zinc-950 text-zinc-100 hover:bg-zinc-900"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploading ? "Загрузка..." : "Загрузить логотип"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Публичность */}
        <Card className="rounded-2xl border-zinc-800 bg-zinc-950/80">
          <CardHeader>
            <CardTitle className="text-zinc-50">Публичность</CardTitle>
            <CardDescription className="text-zinc-400">
              Адрес страницы и видимость в каталоге тренеров.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="slug" className="text-xs font-medium text-zinc-300">
                URL-адрес профиля (slug)
              </Label>
              <div
                className={[
                  "flex h-10 items-center overflow-hidden rounded-xl border bg-zinc-900",
                  slugValid ? "border-zinc-700" : "border-rose-700/70",
                ].join(" ")}
              >
                <span className="max-w-[min(50%,14rem)] shrink-0 truncate px-3 text-sm text-zinc-500" title={slugPrefix}>
                  {slugPrefix}
                </span>
                <input
                  id="slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="my-team"
                  className="h-full min-w-0 flex-1 bg-transparent px-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                />
              </div>
              {!slugValid && (
                <p className="text-xs text-rose-300">
                  Только латиница, цифры и тире. Например:{" "}
                  <span className="font-medium">my-team-1</span>
                </p>
              )}
            </div>

            <div className="flex items-center justify-between gap-4 rounded-2xl border border-zinc-800 bg-zinc-950/60 px-4 py-3">
              <div className="space-y-0.5">
                <div className="text-sm font-medium text-zinc-100">
                  Опубликовать в каталоге
                </div>
                <div className="text-xs text-zinc-500">
                  Если выключено, профиль доступен только по прямой ссылке при заданном slug.
                </div>
              </div>
              <Switch checked={isPublic} onCheckedChange={setIsPublic} />
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
          <Button
            type="button"
            variant="outline"
            className="order-2 rounded-xl border-zinc-700 bg-zinc-950 text-zinc-100 hover:bg-zinc-900 sm:order-1 sm:mr-auto"
            disabled={!normalizedSlug || !slugValid}
            onClick={() => openPublicProfile()}
          >
            <ExternalLink className="mr-2 size-4" />
            Посмотреть мой профиль
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving || uploading}
            className="order-1 rounded-xl bg-zinc-100 px-6 text-sm font-medium text-black hover:bg-white sm:order-2 disabled:opacity-50"
          >
            {saving ? "Сохраняем..." : "Сохранить изменения"}
          </Button>
        </div>

        <Card className="rounded-2xl border-zinc-800 bg-zinc-950/80">
          <CardHeader>
            <CardTitle className="text-zinc-50">Смена пароля</CardTitle>
            <CardDescription className="text-zinc-400">
              Новый пароль для входа в аккаунт. Должен быть длиннее 6 символов.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="trainerNewPassword" className="text-xs font-medium text-zinc-300">
                Новый пароль
              </Label>
              <div className="relative">
                <Input
                  id="trainerNewPassword"
                  type={showNewPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Введите новый пароль"
                  className="h-10 rounded-xl border-zinc-700 bg-zinc-900 pr-10 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-zinc-400"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword((v) => !v)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 rounded-lg p-2 text-zinc-500 transition-colors hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/60"
                  aria-label={showNewPassword ? "Скрыть пароль" : "Показать пароль"}
                >
                  {showNewPassword ? (
                    <EyeOff className="size-4 shrink-0" aria-hidden />
                  ) : (
                    <Eye className="size-4 shrink-0" aria-hidden />
                  )}
                </button>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                disabled={!newPasswordValid || passwordSaving}
                onClick={() => void handleSaveNewPassword()}
                className="rounded-xl border-zinc-700 bg-zinc-950 text-zinc-100 hover:bg-zinc-900 disabled:opacity-50"
              >
                {passwordSaving ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                    Сохраняем...
                  </>
                ) : (
                  "Сохранить новый пароль"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
