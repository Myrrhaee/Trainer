"use client";

import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import {
  MiniEmptyState,
  Panel,
  accessLabel,
  formatProfileDate,
  sourceLabel,
  subscriptionLabel,
  toneClass,
  toneSurfaceClass,
} from "./client-profile-ui";
import type { AthleteProfile, AthleteTone } from "./types";

export function ManagementTab({ athlete }: { athlete: AthleteProfile }) {
  const handleCopyInvite = async () => {
    try {
      await navigator.clipboard.writeText(athlete.management.inviteLink);
      toast.success("Ссылка приглашения скопирована");
    } catch {
      toast.error("Не удалось скопировать ссылку приглашения");
    }
  };

  return (
    <section className="grid gap-5">
      <FinanceAccessHero athlete={athlete} />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Panel title="Финансы клиента" eyebrow="Оплата">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <ManagementInfoCard
              label="Статус подписки"
              value={subscriptionLabel(athlete.management.subscriptionStatus)}
              helper="Текущий статус ведения"
              tone={athlete.management.subscriptionStatus === "active" ? "good" : "warning"}
            />
            <ManagementInfoCard label="Тариф / сумма" value={athlete.management.tariffAmount} helper={athlete.management.tariffName} tone="good" />
            <ManagementInfoCard label="Дата покупки" value={formatProfileDate(athlete.management.purchaseDate)} helper="Когда клиент оплатил текущий период" />
            <ManagementInfoCard label="Следующая оплата" value={formatProfileDate(athlete.management.nextPaymentDate)} helper="Запланированное продление" tone="warning" />
            <ManagementInfoCard label="Окончание доступа" value={formatProfileDate(athlete.management.subscriptionEndDate)} helper="Дата закрытия текущего периода" tone="warning" />
            <ManagementInfoCard label="Источник" value={sourceLabel(athlete.management.source)} helper={`Добавлен ${formatProfileDate(athlete.management.addedAt)}`} />
          </div>
        </Panel>

        <Panel title="Доступ клиента" eyebrow="Разрешения">
          <div className="space-y-3">
            <ManagementInfoCard
              label="Статус доступа"
              value={accessLabel(athlete.management.accessStatus)}
              helper="Доступ к кабинету и тренировкам"
              tone={athlete.management.accessStatus === "enabled" ? "good" : "warning"}
            />
            <AccessToggleRow label="Сообщения" enabled={athlete.management.canMessage} />
            <AccessToggleRow label="Тренировки" enabled={athlete.management.canAccessWorkouts} />
            <AccessToggleRow label="Фото и замеры" enabled={athlete.management.canUploadProgress} />
          </div>
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Panel title="История платежей" eyebrow="Платежи">
          {athlete.management.paymentHistory.length > 0 ? (
            <div className="space-y-2">
              {athlete.management.paymentHistory.map((payment) => (
                <PaymentHistoryRow key={payment.id} payment={payment} />
              ))}
            </div>
          ) : (
            <MiniEmptyState title="Платежей пока нет" detail="История покупок появится после первой оплаты клиента." />
          )}
        </Panel>

        <Panel title="Купленные программы" eyebrow="Доступные продукты">
          {athlete.management.purchasedPrograms.length > 0 ? (
            <div className="space-y-2">
              {athlete.management.purchasedPrograms.map((program) => (
                <PurchasedProgramRow key={program.id} program={program} />
              ))}
            </div>
          ) : (
            <MiniEmptyState title="Продукты не назначены" detail="После покупки или ручного назначения здесь появятся доступы клиента." />
          )}
        </Panel>
      </div>

      <Panel title="Подключение клиента" eyebrow="Приглашение">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-end">
          <div className="min-w-0 rounded-[24px] border border-zinc-800 bg-black/18 p-4">
            <p className="text-sm font-semibold text-zinc-50">Ссылка приглашения</p>
            <p className="mt-2 break-all rounded-2xl border border-zinc-800 bg-zinc-950/70 px-3 py-2 text-sm text-zinc-400">
              {athlete.management.inviteLink}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-zinc-600">Используется для восстановления доступа или повторного подключения клиента к клубу.</p>
          </div>
          <Button type="button" onClick={handleCopyInvite} className="rounded-full bg-lime-300 text-black hover:bg-lime-200">
            Скопировать ссылку
          </Button>
        </div>
      </Panel>

      <section className="rounded-[32px] border border-rose-300/14 bg-[radial-gradient(circle_at_12%_20%,rgba(251,113,133,0.12),transparent_28%),linear-gradient(135deg,rgba(24,24,27,0.72),rgba(5,5,5,0.9))] p-5 shadow-2xl shadow-black/20">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-rose-200/60">Опасная зона</p>
        <div className="mt-2 grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px] xl:items-end">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-zinc-50">Опасные действия с доступом</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-500">
              Эти действия влияют на членство клиента в клубе. Они отделены от ежедневных тренировочных сценариев, чтобы тренер не путал доступ с рабочими действиями.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-1">
            <Button
              type="button"
              variant="outline"
              onClick={() => toast.warning("Доступ клиента поставлен на паузу")}
              className="justify-start rounded-full border-rose-300/22 bg-rose-300/8 text-rose-100 hover:bg-rose-300/12"
            >
              Приостановить доступ
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => toast.warning("Доступ клиента отключён")}
              className="justify-start rounded-full border-rose-300/22 bg-rose-300/8 text-rose-100 hover:bg-rose-300/12"
            >
              Отключить доступ
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => toast.error("Клиент не удалён: это демонстрационное действие")}
              className="justify-start rounded-full"
            >
              Удалить клиента из клуба
            </Button>
          </div>
        </div>
      </section>
    </section>
  );
}

function FinanceAccessHero({ athlete }: { athlete: AthleteProfile }) {
  return (
    <section className="overflow-hidden rounded-[2rem] border border-zinc-800/80 bg-[radial-gradient(circle_at_14%_20%,rgba(190,242,100,0.12),transparent_24%),linear-gradient(135deg,rgba(24,24,27,0.92),rgba(5,5,5,0.94))] p-5 shadow-[0_28px_88px_rgba(0,0,0,0.26)] lg:p-6">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px] xl:items-end">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">Финансы и доступ</p>
          <h2 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
            {athlete.management.purchaseName}
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-500">
            Слой управления клубом: подписка, купленные продукты, разрешения и срок доступа клиента.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <FinanceHeroMetric
            label="Статус"
            value={subscriptionLabel(athlete.management.subscriptionStatus)}
            helper={accessLabel(athlete.management.accessStatus)}
            tone={athlete.management.subscriptionStatus === "active" ? "good" : "warning"}
          />
          <FinanceHeroMetric label="Тариф" value={athlete.management.tariffAmount} helper={athlete.management.tariffName} tone="good" />
          <FinanceHeroMetric label="Следующая оплата" value={formatProfileDate(athlete.management.nextPaymentDate)} helper="запланированное продление" tone="warning" />
          <FinanceHeroMetric label="Доступ до" value={formatProfileDate(athlete.management.subscriptionEndDate)} helper="окончание текущего периода" tone="muted" />
        </div>
      </div>
    </section>
  );
}

function FinanceHeroMetric({
  label,
  value,
  helper,
  tone,
}: {
  label: string;
  value: string;
  helper: string;
  tone: AthleteTone;
}) {
  return (
    <div className={cn("min-w-0 rounded-[22px] border p-3", toneSurfaceClass(tone))}>
      <p className="text-xs text-zinc-600">{label}</p>
      <p className="mt-2 truncate text-lg font-semibold text-zinc-50">{value}</p>
      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-zinc-500">{helper}</p>
    </div>
  );
}

function PaymentHistoryRow({
  payment,
}: {
  payment: AthleteProfile["management"]["paymentHistory"][number];
}) {
  return (
    <div className="grid gap-3 rounded-2xl border border-zinc-800 bg-black/18 px-3 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="min-w-0">
        <p className="break-words text-sm font-semibold text-zinc-50">{payment.title}</p>
        <p className="mt-0.5 text-xs text-zinc-600">{formatProfileDate(payment.date)}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        <span className="rounded-full border border-zinc-800 bg-black/20 px-2.5 py-1 text-xs font-medium text-zinc-300">{payment.amount}</span>
        <span className={cn("rounded-full border px-2.5 py-1 text-xs", toneClass(payment.tone))}>{payment.status}</span>
      </div>
    </div>
  );
}

function PurchasedProgramRow({ program }: { program: AthleteProfile["management"]["purchasedPrograms"][number] }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-black/18 px-3 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="break-words text-sm font-semibold text-zinc-50">{program.title}</p>
          <p className="mt-1 text-xs leading-relaxed text-zinc-500">{program.detail}</p>
        </div>
        <span className="shrink-0 rounded-full border border-lime-300/18 bg-lime-300/8 px-2.5 py-1 text-xs text-lime-100">{program.status}</span>
      </div>
    </div>
  );
}

function ManagementInfoCard({
  label,
  value,
  helper,
  tone = "muted",
}: {
  label: string;
  value: string;
  helper: string;
  tone?: AthleteTone;
}) {
  return (
    <div className={cn("min-w-0 rounded-[24px] border p-4", toneSurfaceClass(tone))}>
      <p className="text-xs uppercase tracking-[0.16em] text-zinc-600">{label}</p>
      <p className="mt-3 break-words text-base font-semibold leading-snug text-zinc-50">{value}</p>
      <p className="mt-2 text-sm leading-relaxed text-zinc-500">{helper}</p>
    </div>
  );
}

function AccessToggleRow({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[24px] border border-zinc-800 bg-black/18 p-4">
      <div>
        <p className="text-sm font-semibold text-zinc-50">{label}</p>
        <p className="mt-1 text-xs text-zinc-600">Демонстрационный переключатель доступа</p>
      </div>
      <button
        type="button"
        onClick={() => toast.success(enabled ? `${label}: доступ активен` : `${label}: доступ выключен`)}
        className={cn(
          "relative h-7 w-12 rounded-full border transition",
          enabled ? "border-lime-300/24 bg-lime-300/20" : "border-zinc-700 bg-zinc-900"
        )}
        aria-label={`${label}: ${enabled ? "включено" : "выключено"}`}
      >
        <span className={cn("absolute top-1 size-5 rounded-full transition", enabled ? "left-6 bg-lime-300" : "left-1 bg-zinc-600")} />
      </button>
    </div>
  );
}
