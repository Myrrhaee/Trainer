"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-client";
import { useTrainer } from "@/lib/auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type ProfileRow = {
  full_name: string | null;
  display_name: string | null;
  team_logo_url: string | null;
  telegram_link: string | null;
  slug?: string | null;
  is_public?: boolean | null;
};

const supabase = createClient();

const PROFILE_URL_PREFIX = "твойсайт.com/t/";
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

  const [fullName, setFullName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [telegramLink, setTelegramLink] = useState("");
  const [teamLogoUrl, setTeamLogoUrl] = useState<string | null>(null);
  const [slug, setSlug] = useState("");
  const [isPublic, setIsPublic] = useState(false);

  const telegramLinkValid = useMemo(() => isValidTelegramLink(telegramLink), [telegramLink]);
  const normalizedSlug = useMemo(() => slug.trim().toLowerCase(), [slug]);
  const slugValid = useMemo(() => {
    if (!normalizedSlug) return true;
    return SLUG_RE.test(normalizedSlug);
  }, [normalizedSlug]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!trainerId) return;
      setLoading(true);
      setError(null);
      setSuccess(null);

      const { data, error: loadError } = await supabase
        .from("profiles")
        .select("full_name, display_name, team_logo_url, telegram_link, slug, is_public")
        .eq("id", trainerId)
        .maybeSingle();

      if (cancelled) return;

      if (loadError) {
        console.error("settings: load profile failed:", loadError);
        setError("Не удалось загрузить профиль. Попробуйте позже.");
        setLoading(false);
        return;
      }

      const profile = (data ?? null) as ProfileRow | null;
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

  async function handleSave() {
    if (!trainerId) return;
    setError(null);
    setSuccess(null);

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
      // Uniqueness check for slug
      if (nextSlug) {
        const { data: taken, error: slugErr } = await supabase
          .from("profiles")
          .select("id")
          .eq("slug", nextSlug)
          .neq("id", trainerId)
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

      const { error: updateError } = await supabase
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        .from("profiles")
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        .update(updatePayload as Record<string, unknown>)
        .eq("id", trainerId);

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

    const { error: updateError } = await supabase
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      .from("profiles")
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      .update({ team_logo_url: publicUrl } as Record<string, unknown>)
      .eq("id", trainerId);

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
              Обновите данные команды и контакты.
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

        <Card className="rounded-2xl border-zinc-800 bg-zinc-950/80">
          <CardHeader>
            <CardTitle className="text-zinc-50">Профиль</CardTitle>
            <CardDescription className="text-zinc-400">
              Эти данные видят ваши клиенты.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
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
                  <div className="text-xs text-zinc-500">
                    PNG/JPG, до 5 МБ
                  </div>
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

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="fullName" className="text-xs font-medium text-zinc-300">
                  Имя (полное)
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
            </div>

            <div className="space-y-2">
              <Label htmlFor="telegramLink" className="text-xs font-medium text-zinc-300">
                Ссылка на Telegram
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

            <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
              <Button
                type="button"
                onClick={handleSave}
                disabled={saving || uploading}
                className="rounded-xl bg-zinc-100 px-5 text-sm font-medium text-black hover:bg-white disabled:opacity-50"
              >
                {saving ? "Сохраняем..." : "Сохранить изменения"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-zinc-800 bg-zinc-950/80">
          <CardHeader>
            <CardTitle className="text-zinc-50">Публичность</CardTitle>
            <CardDescription className="text-zinc-400">
              Если публикация выключена, профиль доступен только по прямой ссылке (если задан URL).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="slug" className="text-xs font-medium text-zinc-300">
                URL профиля
              </Label>
              <div
                className={[
                  "flex h-10 items-center overflow-hidden rounded-xl border bg-zinc-900",
                  slugValid ? "border-zinc-700" : "border-rose-700/70",
                ].join(" ")}
              >
                <span className="shrink-0 px-3 text-sm text-zinc-500">
                  {PROFILE_URL_PREFIX}
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
                  Только латиница, цифры и тире. Например: <span className="font-medium">my-team-1</span>
                </p>
              )}
            </div>

            <div className="flex items-center justify-between gap-4 rounded-2xl border border-zinc-800 bg-zinc-950/60 px-4 py-3">
              <div className="space-y-0.5">
                <div className="text-sm font-medium text-zinc-100">
                  Опубликовать в каталоге
                </div>
                <div className="text-xs text-zinc-500">
                  Включите, чтобы профиль отображался в будущем каталоге.
                </div>
              </div>
              <Switch checked={isPublic} onCheckedChange={setIsPublic} />
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
              <Button
                type="button"
                onClick={handleSave}
                disabled={saving || uploading}
                className="rounded-xl bg-zinc-100 px-5 text-sm font-medium text-black hover:bg-white disabled:opacity-50"
              >
                {saving ? "Сохраняем..." : "Сохранить изменения"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

