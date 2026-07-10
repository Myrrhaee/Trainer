import type { ReactNode } from "react";

import type { AthleteProfile, AthleteTone } from "./types";

export function MiniEmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-[24px] border border-zinc-800 bg-black/18 p-4">
      <p className="text-sm font-semibold text-zinc-50">{title}</p>
      <p className="mt-2 text-sm leading-relaxed text-zinc-500">{detail}</p>
    </div>
  );
}

export function Panel({ title, eyebrow, children }: { title: string; eyebrow: string; children: ReactNode }) {
  return (
    <section className="min-w-0 rounded-[32px] border border-zinc-800/80 bg-zinc-950/68 p-4 shadow-2xl shadow-black/20 sm:p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">{eyebrow}</p>
      <h2 className="mt-2 break-words text-2xl font-semibold tracking-tight text-zinc-50">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-zinc-600">{label}</p>
      <p className="mt-1 text-lg font-semibold text-zinc-100">{value}</p>
    </div>
  );
}

export function toneClass(tone: AthleteTone) {
  return {
    good: "border-lime-300/18 bg-lime-300/8 text-lime-100",
    warning: "border-amber-300/18 bg-amber-300/8 text-amber-100",
    risk: "border-rose-300/18 bg-rose-300/8 text-rose-100",
    muted: "border-zinc-800 bg-black/20 text-zinc-400",
  }[tone];
}

export function toneSurfaceClass(tone: AthleteTone) {
  return {
    good: "border-lime-300/16 bg-lime-300/7",
    warning: "border-amber-300/16 bg-amber-300/7",
    risk: "border-rose-300/16 bg-rose-300/7",
    muted: "border-zinc-800 bg-black/18",
  }[tone];
}

export function formatProfileDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function sourceLabel(source: AthleteProfile["management"]["source"]) {
  return {
    invite: "Приглашение",
    manual: "Добавлен вручную",
    program_purchase: "Покупка программы",
  }[source];
}

export function subscriptionLabel(status: AthleteProfile["management"]["subscriptionStatus"]) {
  return {
    active: "Активна",
    trial: "Пробный период",
    ending: "Скоро закончится",
    expired: "Истекла",
    paused: "На паузе",
  }[status];
}

export function accessLabel(status: AthleteProfile["management"]["accessStatus"]) {
  return {
    enabled: "Активен",
    limited: "Ограничен",
    disabled: "Отключён",
  }[status];
}
