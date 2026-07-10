"use client";

import { useEffect, useMemo, useSyncExternalStore, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  CheckCircle2,
  Clipboard,
  CreditCard,
  Globe2,
  KeyRound,
  Link2,
  LockKeyhole,
  Mail,
  MessageCircle,
  RadioTower,
  Save,
  ShieldCheck,
  Smartphone,
  Sparkles,
  UserRound,
  WalletCards,
} from "lucide-react";
import { toast } from "sonner";

import { TrainerShell } from "@/components/trainer/trainer-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { DEMO_TRAINER, isDemoModeEnabled } from "@/lib/demo-mode";
import { createClient } from "@/lib/supabase-client";
import { cn, isSupabaseSchemaMismatch, logSupabaseError } from "@/lib/utils";

const settingsStorageKey = "trainer-settings:v1";

type TrainerSettings = {
  profile: {
    fullName: string;
    brandName: string;
    city: string;
    specialization: string;
    publicSlug: string;
    bio: string;
  };
  storefront: {
    published: boolean;
    acceptsApplications: boolean;
    showPrices: boolean;
    defaultPrice: string;
    trialCallUrl: string;
  };
  notifications: {
    workoutReviews: boolean;
    missedWorkouts: boolean;
    measurements: boolean;
    payments: boolean;
    telegram: boolean;
    emailDigest: boolean;
  };
  operations: {
    autoCreateReviewTasks: boolean;
    requireCheckinBeforeProgram: boolean;
    clientCanMessage: boolean;
    weeklyDigestDay: string;
  };
  security: {
    twoFactor: boolean;
    loginAlerts: boolean;
    clientDataExport: boolean;
  };
};

type SettingsSource = "loading" | "server" | "local" | "demo";
type SettingsStatus = "loading" | "saved" | "saving" | "local" | "error";

type SettingsSnapshot = {
  settings: TrainerSettings;
  source: SettingsSource;
  status: SettingsStatus;
  trainerId: string | null;
  updatedAt: string | null;
  schemaMissing: boolean;
  message: string;
};

type TrainerSettingsRow = {
  trainer_id: string;
  profile: Partial<TrainerSettings["profile"]> | null;
  storefront: Partial<TrainerSettings["storefront"]> | null;
  notifications: Partial<TrainerSettings["notifications"]> | null;
  operations: Partial<TrainerSettings["operations"]> | null;
  security: Partial<TrainerSettings["security"]> | null;
  updated_at: string | null;
};

type PartialTrainerSettings = {
  profile?: Partial<TrainerSettings["profile"]> | null;
  storefront?: Partial<TrainerSettings["storefront"]> | null;
  notifications?: Partial<TrainerSettings["notifications"]> | null;
  operations?: Partial<TrainerSettings["operations"]> | null;
  security?: Partial<TrainerSettings["security"]> | null;
};

const defaultSettings: TrainerSettings = {
  profile: {
    fullName: "Алексей Романов",
    brandName: "Romanov Coaching",
    city: "Москва",
    specialization: "Силовой тренинг, рекомпозиция, техника упражнений",
    publicSlug: "romanov-coaching",
    bio: "Помогаю клиентам выстроить понятную силовую систему, отслеживать прогресс и держать регулярность без хаоса.",
  },
  storefront: {
    published: true,
    acceptsApplications: true,
    showPrices: true,
    defaultPrice: "18000",
    trialCallUrl: "https://cal.com/romanov/intro",
  },
  notifications: {
    workoutReviews: true,
    missedWorkouts: true,
    measurements: true,
    payments: true,
    telegram: false,
    emailDigest: true,
  },
  operations: {
    autoCreateReviewTasks: true,
    requireCheckinBeforeProgram: true,
    clientCanMessage: true,
    weeklyDigestDay: "Понедельник",
  },
  security: {
    twoFactor: false,
    loginAlerts: true,
    clientDataExport: true,
  },
};

const digestDays = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница"] as const;
const initialSettingsSnapshot: SettingsSnapshot = {
  settings: defaultSettings,
  source: "loading",
  status: "loading",
  trainerId: null,
  updatedAt: null,
  schemaMissing: false,
  message: "Загружаем настройки тренера",
};

let settingsSnapshot: SettingsSnapshot = initialSettingsSnapshot;
let settingsInitialized = false;
const settingsListeners = new Set<() => void>();

function mergeSettings(value: PartialTrainerSettings): TrainerSettings {
  return {
    profile: { ...defaultSettings.profile, ...value.profile },
    storefront: { ...defaultSettings.storefront, ...value.storefront },
    notifications: { ...defaultSettings.notifications, ...value.notifications },
    operations: { ...defaultSettings.operations, ...value.operations },
    security: { ...defaultSettings.security, ...value.security },
  };
}

function parseLocalSettingsSnapshot(snapshot: string) {
  try {
    return mergeSettings(JSON.parse(snapshot) as Partial<TrainerSettings>);
  } catch {
    return defaultSettings;
  }
}

function readLocalSettings() {
  if (typeof window === "undefined") return defaultSettings;
  const snapshot = window.localStorage.getItem(settingsStorageKey);
  return snapshot ? parseLocalSettingsSnapshot(snapshot) : defaultSettings;
}

function persistLocalSettings(settings: TrainerSettings) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(settingsStorageKey, JSON.stringify(settings));
}

function emitSettingsSnapshot(next: SettingsSnapshot) {
  settingsSnapshot = next;
  settingsListeners.forEach((listener) => listener());
}

function getSettingsSnapshot() {
  return settingsSnapshot;
}

function subscribeSettings(listener: () => void) {
  settingsListeners.add(listener);

  return () => {
    settingsListeners.delete(listener);
  };
}

function applyLocalDraft(settings: TrainerSettings) {
  persistLocalSettings(settings);
  emitSettingsSnapshot({
    ...settingsSnapshot,
    settings,
    status: settingsSnapshot.source === "demo" ? "saved" : "local",
    message:
      settingsSnapshot.source === "demo"
        ? "Demo-режим: настройки сохранены локально"
        : "Есть несохранённые изменения",
  });
}

function settingsFromRow(row: TrainerSettingsRow): TrainerSettings {
  return mergeSettings({
    profile: row.profile ?? {},
    storefront: row.storefront ?? {},
    notifications: row.notifications ?? {},
    operations: row.operations ?? {},
    security: row.security ?? {},
  });
}

async function initializeTrainerSettings(onUnauthed: () => void) {
  if (settingsInitialized) return;
  settingsInitialized = true;

  const localSettings = readLocalSettings();

  if (isDemoModeEnabled()) {
    persistLocalSettings(localSettings);
    emitSettingsSnapshot({
      settings: localSettings,
      source: "demo",
      status: "saved",
      trainerId: DEMO_TRAINER.id,
      updatedAt: null,
      schemaMissing: false,
      message: "Demo-режим: настройки сохраняются локально",
    });
    return;
  }

  emitSettingsSnapshot({
    ...settingsSnapshot,
    settings: localSettings,
    source: "loading",
    status: "loading",
    message: "Загружаем настройки из Supabase",
  });

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    onUnauthed();
    return;
  }

  const res = await supabase
    .from("trainer_settings")
    .select("trainer_id, profile, storefront, notifications, operations, security, updated_at")
    .eq("trainer_id", user.id)
    .maybeSingle();

  if (isSupabaseSchemaMismatch(res.error)) {
    persistLocalSettings(localSettings);
    emitSettingsSnapshot({
      settings: localSettings,
      source: "local",
      status: "local",
      trainerId: user.id,
      updatedAt: null,
      schemaMissing: true,
      message: "Миграция trainer_settings ещё не применена: работаем локально",
    });
    return;
  }

  if (res.error) {
    logSupabaseError("trainer settings load failed", res.error);
    emitSettingsSnapshot({
      settings: localSettings,
      source: "local",
      status: "error",
      trainerId: user.id,
      updatedAt: null,
      schemaMissing: false,
      message: "Не удалось загрузить серверные настройки, показана локальная копия",
    });
    return;
  }

  if (!res.data) {
    persistLocalSettings(localSettings);
    emitSettingsSnapshot({
      settings: localSettings,
      source: "server",
      status: "local",
      trainerId: user.id,
      updatedAt: null,
      schemaMissing: false,
      message: "Серверная запись будет создана при сохранении",
    });
    return;
  }

  const serverSettings = settingsFromRow(res.data as TrainerSettingsRow);
  persistLocalSettings(serverSettings);
  emitSettingsSnapshot({
    settings: serverSettings,
    source: "server",
    status: "saved",
    trainerId: user.id,
    updatedAt: (res.data as TrainerSettingsRow).updated_at,
    schemaMissing: false,
    message: "Настройки загружены из Supabase",
  });
}

async function saveTrainerSettings(settings: TrainerSettings) {
  persistLocalSettings(settings);

  if (settingsSnapshot.source === "demo") {
    emitSettingsSnapshot({
      ...settingsSnapshot,
      settings,
      status: "saved",
      message: "Demo-режим: настройки сохранены локально",
    });
    return { ok: true, mode: "demo" as const };
  }

  if (!settingsSnapshot.trainerId || settingsSnapshot.schemaMissing) {
    emitSettingsSnapshot({
      ...settingsSnapshot,
      settings,
      source: "local",
      status: "local",
      message: settingsSnapshot.schemaMissing
        ? "Миграция trainer_settings ещё не применена: сохранено локально"
        : "Нет активной сессии тренера: сохранено локально",
    });
    return { ok: true, mode: "local" as const };
  }

  emitSettingsSnapshot({
    ...settingsSnapshot,
    settings,
    status: "saving",
    message: "Сохраняем настройки в Supabase",
  });

  const supabase = createClient();
  const res = await supabase
    .from("trainer_settings")
    .upsert(
      {
        trainer_id: settingsSnapshot.trainerId,
        profile: settings.profile,
        storefront: settings.storefront,
        notifications: settings.notifications,
        operations: settings.operations,
        security: settings.security,
      },
      { onConflict: "trainer_id" }
    )
    .select("trainer_id, profile, storefront, notifications, operations, security, updated_at")
    .single();

  if (isSupabaseSchemaMismatch(res.error)) {
    emitSettingsSnapshot({
      ...settingsSnapshot,
      settings,
      source: "local",
      status: "local",
      schemaMissing: true,
      message: "Миграция trainer_settings ещё не применена: сохранено локально",
    });
    return { ok: true, mode: "local" as const };
  }

  if (res.error || !res.data) {
    logSupabaseError("trainer settings save failed", res.error);
    emitSettingsSnapshot({
      ...settingsSnapshot,
      settings,
      status: "error",
      message: "Не удалось сохранить настройки в Supabase",
    });
    return { ok: false, mode: "server" as const };
  }

  const serverSettings = settingsFromRow(res.data as TrainerSettingsRow);
  persistLocalSettings(serverSettings);
  emitSettingsSnapshot({
    settings: serverSettings,
    source: "server",
    status: "saved",
    trainerId: (res.data as TrainerSettingsRow).trainer_id,
    updatedAt: (res.data as TrainerSettingsRow).updated_at,
    schemaMissing: false,
    message: "Настройки сохранены в Supabase",
  });
  return { ok: true, mode: "server" as const };
}

function formatPrice(value: string) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return "0 ₽";
  return `${parsed.toLocaleString("ru-RU")} ₽`;
}

function SettingSwitch({
  title,
  helper,
  checked,
  onChange,
  icon: Icon,
}: {
  title: string;
  helper: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  icon: typeof Bell;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-[1.15rem] border border-white/7 bg-black/18 p-4">
      <div className="flex min-w-0 gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-zinc-800 bg-zinc-950 text-zinc-300">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-zinc-100">{title}</p>
          <p className="mt-1 text-xs leading-relaxed text-zinc-500">{helper}</p>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={title} />
    </div>
  );
}

function StatusPill({ active }: { active: boolean }) {
  return (
    <Badge
      className={cn(
        "rounded-full border px-2.5 py-1",
        active
          ? "border-lime-300/18 bg-lime-300/10 text-lime-100"
          : "border-zinc-800 bg-zinc-900/70 text-zinc-300"
      )}
    >
      {active ? "Активно" : "Отключено"}
    </Badge>
  );
}

export default function TrainerSettingsPage() {
  const router = useRouter();
  const settingsState = useSyncExternalStore(
    subscribeSettings,
    getSettingsSnapshot,
    () => initialSettingsSnapshot
  );
  const { settings } = settingsState;

  useEffect(() => {
    void initializeTrainerSettings(() => router.replace("/login"));
  }, [router]);

  const publicProfileUrl = useMemo(
    () => `https://coach.app/t/${settings.profile.publicSlug || "trainer"}`,
    [settings.profile.publicSlug]
  );

  const readiness = useMemo(() => {
    const checks = [
      Boolean(settings.profile.fullName.trim()),
      Boolean(settings.profile.brandName.trim()),
      Boolean(settings.profile.publicSlug.trim()),
      Boolean(settings.profile.bio.trim()),
      settings.storefront.published,
      settings.storefront.acceptsApplications,
      settings.notifications.workoutReviews,
      settings.security.loginAlerts,
    ];

    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [settings]);

  const syncLabel =
    settingsState.status === "saving"
      ? "Сохраняем"
      : settingsState.status === "saved"
        ? settingsState.source === "server"
          ? "Supabase"
          : settingsState.source === "demo"
            ? "Demo"
            : "Сохранено"
        : settingsState.status === "local"
          ? "Локально"
          : settingsState.status === "error"
            ? "Ошибка"
            : "Загрузка";
  const saving = settingsState.status === "saving";

  function updateProfile(field: keyof TrainerSettings["profile"], value: string) {
    applyLocalDraft({
      ...settings,
      profile: { ...settings.profile, [field]: value },
    });
  }

  function updateStorefront(field: keyof TrainerSettings["storefront"], value: string | boolean) {
    applyLocalDraft({
      ...settings,
      storefront: { ...settings.storefront, [field]: value },
    });
  }

  function updateNotifications(field: keyof TrainerSettings["notifications"], value: boolean) {
    applyLocalDraft({
      ...settings,
      notifications: { ...settings.notifications, [field]: value },
    });
  }

  function updateOperations(field: keyof TrainerSettings["operations"], value: string | boolean) {
    applyLocalDraft({
      ...settings,
      operations: { ...settings.operations, [field]: value },
    });
  }

  function updateSecurity(field: keyof TrainerSettings["security"], value: boolean) {
    applyLocalDraft({
      ...settings,
      security: { ...settings.security, [field]: value },
    });
  }

  async function handleSave(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const result = await saveTrainerSettings(settings);
    if (!result.ok) {
      toast.error("Не удалось сохранить настройки в Supabase");
      return;
    }

    toast.success(
      result.mode === "server"
        ? "Настройки сохранены в Supabase"
        : "Настройки сохранены локально"
    );
  }

  async function copyPublicLink() {
    try {
      await navigator.clipboard.writeText(publicProfileUrl);
      toast.success("Ссылка на профиль скопирована");
    } catch {
      toast.error(publicProfileUrl);
    }
  }

  function resetSettings() {
    applyLocalDraft(defaultSettings);
    toast.success("Настройки возвращены к базовым значениям");
  }

  return (
    <TrainerShell
      title="Настройки"
      description="Профиль тренера, витрина, уведомления, рабочие правила и доступ."
      headerAction={
        <Button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          className="hidden h-11 rounded-full bg-lime-300 px-5 text-black hover:bg-lime-200 disabled:opacity-60 xl:inline-flex"
        >
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Сохраняем" : "Сохранить"}
        </Button>
      }
    >
      <div className="space-y-5">
        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Готовность профиля", value: `${readiness}%`, helper: "актуально в этом браузере", icon: ShieldCheck },
            { label: "Синхронизация", value: syncLabel, helper: settingsState.message, icon: Save },
            { label: "Публичный статус", value: settings.storefront.published ? "Витрина" : "Черновик", helper: settings.storefront.acceptsApplications ? "принимает заявки" : "заявки закрыты", icon: RadioTower },
            { label: "Базовая цена", value: formatPrice(settings.storefront.defaultPrice), helper: "персональное ведение", icon: WalletCards },
          ].map(({ label, value, helper, icon: Icon }) => (
            <article key={label} className="rounded-[1.45rem] border border-zinc-800/85 bg-zinc-950/76 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">{label}</p>
                  <p className="mt-3 truncate text-3xl font-semibold tracking-tight text-zinc-50">{value}</p>
                  <p className="mt-1 text-sm text-zinc-500">{helper}</p>
                </div>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-zinc-800 bg-black/24 text-zinc-300">
                  <Icon className="h-4 w-4" />
                </div>
              </div>
            </article>
          ))}
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0 rounded-[1.85rem] border border-zinc-800/85 bg-[linear-gradient(180deg,rgba(18,18,22,0.96),rgba(7,7,9,0.98))] p-4">
            <Tabs defaultValue="profile">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Trainer control</p>
                  <h2 className="mt-2 text-xl font-semibold tracking-tight text-zinc-50">Параметры кабинета</h2>
                </div>
                <TabsList className="w-full justify-start overflow-x-auto rounded-[1.2rem] lg:w-auto">
                  <TabsTrigger value="profile">Профиль</TabsTrigger>
                  <TabsTrigger value="notifications">Уведомления</TabsTrigger>
                  <TabsTrigger value="workflow">Правила</TabsTrigger>
                  <TabsTrigger value="security">Доступ</TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="profile">
                <form onSubmit={handleSave} className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
                  <div className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="trainer-name" className="text-zinc-300">Имя тренера</Label>
                        <Input
                          id="trainer-name"
                          value={settings.profile.fullName}
                          onChange={(event) => updateProfile("fullName", event.target.value)}
                          className="border-zinc-800 bg-black/30 text-zinc-100"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="trainer-brand" className="text-zinc-300">Бренд</Label>
                        <Input
                          id="trainer-brand"
                          value={settings.profile.brandName}
                          onChange={(event) => updateProfile("brandName", event.target.value)}
                          className="border-zinc-800 bg-black/30 text-zinc-100"
                        />
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="trainer-city" className="text-zinc-300">Город</Label>
                        <Input
                          id="trainer-city"
                          value={settings.profile.city}
                          onChange={(event) => updateProfile("city", event.target.value)}
                          className="border-zinc-800 bg-black/30 text-zinc-100"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="trainer-slug" className="text-zinc-300">Публичный адрес</Label>
                        <Input
                          id="trainer-slug"
                          value={settings.profile.publicSlug}
                          onChange={(event) =>
                            updateProfile(
                              "publicSlug",
                              event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")
                            )
                          }
                          className="border-zinc-800 bg-black/30 text-zinc-100"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="trainer-specialization" className="text-zinc-300">Специализация</Label>
                      <Input
                        id="trainer-specialization"
                        value={settings.profile.specialization}
                        onChange={(event) => updateProfile("specialization", event.target.value)}
                        className="border-zinc-800 bg-black/30 text-zinc-100"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="trainer-bio" className="text-zinc-300">Описание</Label>
                      <Textarea
                        id="trainer-bio"
                        value={settings.profile.bio}
                        onChange={(event) => updateProfile("bio", event.target.value)}
                        className="min-h-28 border-zinc-800 bg-black/30 text-zinc-100"
                      />
                    </div>
                  </div>

                  <aside className="rounded-[1.35rem] border border-white/7 bg-black/18 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-full border border-lime-300/12 bg-lime-300/8 text-lime-100">
                        <UserRound className="h-5 w-5" />
                      </div>
                      <StatusPill active={settings.storefront.published} />
                    </div>
                    <h3 className="mt-5 text-lg font-semibold text-zinc-50">{settings.profile.brandName}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-zinc-400">{settings.profile.specialization}</p>
                    <div className="mt-4 rounded-[1rem] border border-zinc-800 bg-zinc-950/65 p-3">
                      <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Публичная ссылка</p>
                      <p className="mt-2 break-all text-sm text-zinc-200">{publicProfileUrl}</p>
                    </div>
                    <div className="mt-4 grid gap-2">
                      <Button type="button" onClick={() => void copyPublicLink()} className="h-9 rounded-full bg-lime-300 text-black hover:bg-lime-200">
                        <Clipboard className="mr-2 h-4 w-4" />
                        Скопировать
                      </Button>
                      <Button asChild type="button" variant="outline" className="h-9 rounded-full border-zinc-800 bg-black/18 text-zinc-300 hover:bg-zinc-900">
                        <Link href="/trainer/sales">
                          <Globe2 className="mr-2 h-4 w-4" />
                          Витрина
                        </Link>
                      </Button>
                    </div>
                  </aside>
                </form>
              </TabsContent>

              <TabsContent value="notifications">
                <div className="grid gap-3 md:grid-cols-2">
                  <SettingSwitch
                    title="Разборы тренировок"
                    helper="Сигнал, когда клиент завершил тренировку и ждёт обратную связь."
                    checked={settings.notifications.workoutReviews}
                    onChange={(checked) => updateNotifications("workoutReviews", checked)}
                    icon={CheckCircle2}
                  />
                  <SettingSwitch
                    title="Пропуски тренировок"
                    helper="Сигнал после пропуска или разрыва регулярности."
                    checked={settings.notifications.missedWorkouts}
                    onChange={(checked) => updateNotifications("missedWorkouts", checked)}
                    icon={Bell}
                  />
                  <SettingSwitch
                    title="Новые замеры"
                    helper="Сигнал по весу, фото и контрольным метрикам клиента."
                    checked={settings.notifications.measurements}
                    onChange={(checked) => updateNotifications("measurements", checked)}
                    icon={Sparkles}
                  />
                  <SettingSwitch
                    title="Платежи"
                    helper="Сигнал по покупкам, продлениям и оплатам программ."
                    checked={settings.notifications.payments}
                    onChange={(checked) => updateNotifications("payments", checked)}
                    icon={CreditCard}
                  />
                  <SettingSwitch
                    title="Telegram"
                    helper="Операционные уведомления в личный Telegram тренера."
                    checked={settings.notifications.telegram}
                    onChange={(checked) => updateNotifications("telegram", checked)}
                    icon={Smartphone}
                  />
                  <SettingSwitch
                    title="Email-дайджест"
                    helper="Сводка по клиентам, задачам и продажам."
                    checked={settings.notifications.emailDigest}
                    onChange={(checked) => updateNotifications("emailDigest", checked)}
                    icon={Mail}
                  />
                </div>
              </TabsContent>

              <TabsContent value="workflow">
                <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
                  <div className="space-y-3">
                    <SettingSwitch
                      title="Автоочередь разборов"
                      helper="Создаёт задачу тренеру после завершённой клиентом тренировки."
                      checked={settings.operations.autoCreateReviewTasks}
                      onChange={(checked) => updateOperations("autoCreateReviewTasks", checked)}
                      icon={CheckCircle2}
                    />
                    <SettingSwitch
                      title="Чек-ин перед программой"
                      helper="Просит клиента обновить самочувствие перед назначением нового блока."
                      checked={settings.operations.requireCheckinBeforeProgram}
                      onChange={(checked) => updateOperations("requireCheckinBeforeProgram", checked)}
                      icon={Clipboard}
                    />
                    <SettingSwitch
                      title="Сообщения от клиентов"
                      helper="Разрешает клиентам писать тренеру из личного кабинета."
                      checked={settings.operations.clientCanMessage}
                      onChange={(checked) => updateOperations("clientCanMessage", checked)}
                      icon={MessageCircle}
                    />
                  </div>

                  <aside className="rounded-[1.35rem] border border-white/7 bg-black/18 p-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Недельная сводка</p>
                    <div className="mt-4 space-y-2">
                      <Label className="text-zinc-300">День отправки</Label>
                      <select
                        value={settings.operations.weeklyDigestDay}
                        onChange={(event) => updateOperations("weeklyDigestDay", event.target.value)}
                        className="h-11 w-full rounded-xl border border-zinc-800 bg-black/30 px-3 text-sm text-zinc-100 outline-none"
                      >
                        {digestDays.map((day) => (
                          <option key={day} value={day}>
                            {day}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="mt-4 rounded-[1rem] border border-zinc-800 bg-zinc-950/65 p-3">
                      <p className="text-sm font-medium text-zinc-100">{settings.operations.weeklyDigestDay}</p>
                      <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                        Клиенты без программы, пропуски, непрочитанные разборы и продажи за неделю.
                      </p>
                    </div>
                  </aside>
                </div>
              </TabsContent>

              <TabsContent value="security">
                <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
                  <div className="space-y-3">
                    <SettingSwitch
                      title="Двухфакторная защита"
                      helper="Дополнительная проверка входа в тренерский кабинет."
                      checked={settings.security.twoFactor}
                      onChange={(checked) => updateSecurity("twoFactor", checked)}
                      icon={LockKeyhole}
                    />
                    <SettingSwitch
                      title="Уведомления о входе"
                      helper="Сигнал при входе с нового устройства."
                      checked={settings.security.loginAlerts}
                      onChange={(checked) => updateSecurity("loginAlerts", checked)}
                      icon={KeyRound}
                    />
                    <SettingSwitch
                      title="Экспорт данных клиентов"
                      helper="Разрешение на выгрузку клиентских данных из кабинета."
                      checked={settings.security.clientDataExport}
                      onChange={(checked) => updateSecurity("clientDataExport", checked)}
                      icon={ShieldCheck}
                    />
                  </div>

                  <aside className="rounded-[1.35rem] border border-white/7 bg-black/18 p-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Сессии</p>
                    <div className="mt-4 space-y-3">
                      {[
                        { device: "MacBook Pro", place: "Москва", time: "Сейчас", active: true },
                        { device: "iPhone", place: "Москва", time: "2 часа назад", active: true },
                        { device: "Chrome", place: "Санкт-Петербург", time: "9 дней назад", active: false },
                      ].map((session) => (
                        <div key={`${session.device}-${session.time}`} className="rounded-[1rem] border border-zinc-800 bg-zinc-950/65 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium text-zinc-100">{session.device}</p>
                              <p className="mt-1 text-xs text-zinc-500">{session.place} · {session.time}</p>
                            </div>
                            <StatusPill active={session.active} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </aside>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          <aside className="space-y-5 xl:sticky xl:top-24 xl:self-start">
            <section className="rounded-[1.75rem] border border-zinc-800/85 bg-zinc-950/82 p-4">
              <div className="flex items-center gap-2">
                <Link2 className="h-4 w-4 text-lime-100" />
                <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Публичная витрина</p>
              </div>
              <div className="mt-4 space-y-3">
                <SettingSwitch
                  title="Профиль опубликован"
                  helper="Публичная карточка тренера доступна клиентам."
                  checked={settings.storefront.published}
                  onChange={(checked) => updateStorefront("published", checked)}
                  icon={RadioTower}
                />
                <SettingSwitch
                  title="Принимать заявки"
                  helper="Новые клиенты могут оставить заявку на ведение."
                  checked={settings.storefront.acceptsApplications}
                  onChange={(checked) => updateStorefront("acceptsApplications", checked)}
                  icon={MessageCircle}
                />
                <SettingSwitch
                  title="Показывать цены"
                  helper="Стоимость продуктов видна на публичной витрине."
                  checked={settings.storefront.showPrices}
                  onChange={(checked) => updateStorefront("showPrices", checked)}
                  icon={WalletCards}
                />
              </div>
              <div className="mt-4 space-y-2">
                <Label htmlFor="default-price" className="text-zinc-300">Базовая цена, ₽</Label>
                <Input
                  id="default-price"
                  inputMode="numeric"
                  value={settings.storefront.defaultPrice}
                  onChange={(event) => updateStorefront("defaultPrice", event.target.value.replace(/\D/g, ""))}
                  className="border-zinc-800 bg-black/30 text-zinc-100"
                />
              </div>
              <div className="mt-4 space-y-2">
                <Label htmlFor="trial-call" className="text-zinc-300">Ссылка на созвон</Label>
                <Input
                  id="trial-call"
                  value={settings.storefront.trialCallUrl}
                  onChange={(event) => updateStorefront("trialCallUrl", event.target.value)}
                  className="border-zinc-800 bg-black/30 text-zinc-100"
                />
              </div>
            </section>

            <section className="rounded-[1.75rem] border border-lime-300/12 bg-[linear-gradient(180deg,rgba(163,230,53,0.08),rgba(7,7,9,0.96))] p-4">
              <ShieldCheck className="h-5 w-5 text-lime-100" />
              <h2 className="mt-4 text-lg font-semibold text-zinc-50">Единый контур тренера</h2>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                {settingsState.message}
              </p>
              {settingsState.updatedAt ? (
                <p className="mt-2 text-xs text-zinc-600">
                  Последняя синхронизация: {new Date(settingsState.updatedAt).toLocaleString("ru-RU")}
                </p>
              ) : null}
              <div className="mt-4 grid gap-2">
                <Button
                  type="button"
                  onClick={() => void handleSave()}
                  disabled={saving}
                  className="h-10 rounded-full bg-lime-300 text-black hover:bg-lime-200 disabled:opacity-60"
                >
                  <Save className="mr-2 h-4 w-4" />
                  {saving ? "Сохраняем" : "Сохранить настройки"}
                </Button>
                <Button type="button" variant="outline" onClick={resetSettings} className="h-10 rounded-full border-zinc-800 bg-black/18 text-zinc-300 hover:bg-zinc-900">
                  Вернуть базовые
                </Button>
              </div>
            </section>
          </aside>
        </section>
      </div>
    </TrainerShell>
  );
}
