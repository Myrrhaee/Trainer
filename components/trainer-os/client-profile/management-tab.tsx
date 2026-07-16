"use client";

import { CalendarClock, CheckCircle2, CircleAlert, Copy, CreditCard, LockKeyhole } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { accessLabel, formatProfileDate, sourceLabel, subscriptionLabel } from "./client-profile-ui";
import type { AthleteProfile } from "./types";

export function ManagementTab({ athlete }: { athlete: AthleteProfile }) {
  const accessActive = athlete.management.accessStatus === "enabled";
  const hasAccessIssue = !accessActive || athlete.management.subscriptionStatus === "ending" || athlete.management.subscriptionStatus === "expired";

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(athlete.management.inviteLink);
      toast.success("Ссылка доступа скопирована");
    } catch {
      toast.error("Не удалось скопировать ссылку");
    }
  }

  return (
    <section className="grid gap-5">
      <section className="overflow-hidden rounded-lg border border-zinc-800/80 bg-[radial-gradient(circle_at_14%_20%,rgba(190,242,100,0.1),transparent_24%),linear-gradient(135deg,rgba(24,24,27,0.92),rgba(5,5,5,0.94))] p-5 shadow-2xl shadow-black/25 lg:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Доступ и оплата</p>
            <h2 className="mt-2 text-3xl font-semibold text-zinc-50">{accessLabel(athlete.management.accessStatus)}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-500">
              Сопровождение {subscriptionLabel(athlete.management.subscriptionStatus).toLowerCase()}, доступ до {formatProfileDate(athlete.management.subscriptionEndDate)}.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => toast.info("Продление доступа будет подключено после интеграции оплаты")}
              className="rounded-full bg-lime-300 text-black hover:bg-lime-200"
            >
              <CreditCard className="size-4" />
              Продлить доступ
            </Button>
            <Button type="button" variant="outline" onClick={copyInvite} className="rounded-full border-zinc-700 bg-black/20 text-zinc-200 hover:bg-zinc-900">
              <Copy className="size-4" />
              Ссылка доступа
            </Button>
          </div>
        </div>
      </section>

      {hasAccessIssue ? (
        <section className="flex items-start gap-3 rounded-lg border border-amber-300/20 bg-amber-300/[0.055] p-4 text-amber-100">
          <CircleAlert className="mt-0.5 size-5 shrink-0" />
          <div>
            <h2 className="font-semibold">Нужно проверить доступ</h2>
            <p className="mt-1 text-sm text-amber-100/70">
              {athlete.management.subscriptionStatus === "paused"
                ? "Сопровождение приостановлено. Тренировки и загрузка прогресса ограничены."
                : "Срок или статус доступа требует ручной проверки."}
            </p>
          </div>
        </section>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_420px]">
        <section className="rounded-lg border border-zinc-800/85 bg-zinc-950/88 p-5">
          <h2 className="text-xl font-semibold text-zinc-50">Текущий период</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <AccessFact icon={CheckCircle2} label="Статус" value={subscriptionLabel(athlete.management.subscriptionStatus)} />
            <AccessFact icon={CalendarClock} label="Доступ до" value={formatProfileDate(athlete.management.subscriptionEndDate)} />
            <AccessFact icon={LockKeyhole} label="Уровень доступа" value={accessLabel(athlete.management.accessStatus)} />
            <AccessFact icon={CreditCard} label="Источник" value={sourceLabel(athlete.management.source)} />
          </div>
        </section>

        <section className="rounded-lg border border-zinc-800/85 bg-zinc-950/88 p-5">
          <h2 className="text-xl font-semibold text-zinc-50">Что доступно клиенту</h2>
          <div className="mt-4 space-y-2">
            <AccessRow label="Сообщения" enabled={athlete.management.canMessage} />
            <AccessRow label="Тренировки" enabled={athlete.management.canAccessWorkouts} />
            <AccessRow label="Фото и замеры" enabled={athlete.management.canUploadProgress} />
          </div>
        </section>
      </div>
    </section>
  );
}

function AccessFact({ icon: Icon, label, value }: { icon: typeof CheckCircle2; label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-lg border border-zinc-800 bg-black/20 p-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900 text-zinc-300">
        <Icon className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-xs text-zinc-600">{label}</span>
        <span className="mt-1 block truncate text-sm font-semibold text-zinc-100">{value}</span>
      </span>
    </div>
  );
}

function AccessRow({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-black/20 px-3 py-3">
      <span className="text-sm text-zinc-300">{label}</span>
      <span className={cn("inline-flex items-center gap-2 text-xs", enabled ? "text-lime-100" : "text-zinc-600")}>
        <span className={cn("size-2 rounded-full", enabled ? "bg-lime-300" : "bg-zinc-700")} />
        {enabled ? "Доступно" : "Ограничено"}
      </span>
    </div>
  );
}
