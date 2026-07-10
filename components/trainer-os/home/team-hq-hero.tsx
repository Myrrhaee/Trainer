"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { CheckCircle2, Settings2, Sparkles, UsersRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

import type { TeamActivityItem, TeamSummary } from "./types";

type TeamHqHeroProps = {
  summary: TeamSummary;
  activityItems: TeamActivityItem[];
  onProcessClients: () => void;
};

type CoverStyle = "default" | "dark-gym" | "minimal" | "mountains" | "team";

const coverOptions: Array<{ id: CoverStyle; label: string; helper: string }> = [
  { id: "default", label: "По умолчанию", helper: "Кинематографичный зал" },
  { id: "dark-gym", label: "Тёмный зал", helper: "Больше контраста" },
  { id: "minimal", label: "Минимализм", helper: "Тише и спокойнее" },
  { id: "mountains", label: "Горы", helper: "Выносливость" },
  { id: "team", label: "Команда", helper: "Клубная энергия" },
];

export function TeamHqHero({ summary, activityItems, onProcessClients }: TeamHqHeroProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [teamName, setTeamName] = useState("Команда Романова");
  const [teamMotto, setTeamMotto] = useState("Система побеждает мотивацию");
  const [coverStyle, setCoverStyle] = useState<CoverStyle>("default");
  const todayEventsCount = activityItems.filter((item) => item.dateGroup === "today").length;
  const teamState = getHeroState(summary);
  const highlight = useMemo(() => getTodayHighlight(activityItems), [activityItems]);
  const metrics = [
    { label: "спортсмена", value: summary.total },
    { label: "по плану", value: summary.onTrack },
    { label: "решения", value: summary.needsAction },
    { label: "событий сегодня", value: todayEventsCount },
  ];

  return (
    <>
      <section
        className={cn(
          "relative overflow-hidden rounded-[2.25rem] border border-zinc-800/85 bg-zinc-950 shadow-[0_30px_90px_rgba(0,0,0,0.35)]",
          coverStyle === "minimal" && "bg-[linear-gradient(135deg,rgba(24,24,27,0.98),rgba(5,5,5,1))]",
          coverStyle === "mountains" && "border-sky-200/10",
          coverStyle === "team" && "border-lime-300/16",
          coverStyle === "dark-gym" && "border-zinc-700/75"
        )}
      >
        <div className="pointer-events-none absolute inset-0">
          <Image
            src="/trainer/team-hq-hero.png"
            alt="Тёмный тренировочный зал"
            fill
            className={cn(
              "object-cover object-center opacity-82",
              coverStyle === "minimal" && "opacity-28 grayscale",
              coverStyle === "dark-gym" && "opacity-92 contrast-110 saturate-75",
              coverStyle === "mountains" && "opacity-54 grayscale",
              coverStyle === "team" && "opacity-76 saturate-110"
            )}
            priority
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,5,7,0.96)_0%,rgba(5,5,7,0.89)_38%,rgba(5,5,7,0.58)_68%,rgba(5,5,7,0.36)_100%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_24%_28%,rgba(163,230,53,0.16),transparent_24%),radial-gradient(circle_at_82%_42%,rgba(163,230,53,0.13),transparent_19%),radial-gradient(circle_at_70%_88%,rgba(255,255,255,0.055),transparent_24%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,transparent_0%,rgba(0,0,0,0.22)_72%,rgba(0,0,0,0.54)_100%)]" />
        </div>

        <div className="relative z-10 flex min-h-[360px] flex-col justify-between p-5 sm:p-6 lg:min-h-[400px] lg:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-[720px]">
              <div className="inline-flex items-center gap-2 rounded-full border border-lime-300/20 bg-lime-300/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.2em] text-lime-100">
                <Sparkles className="size-3.5" />
                Штаб команды
              </div>

              <h1 className="mt-6 max-w-[11ch] text-[3rem] font-semibold leading-[0.94] tracking-[-0.035em] text-zinc-50 sm:text-[4.15rem] lg:text-[5rem]">
                {teamName}
              </h1>
              <p className="mt-4 text-lg font-medium text-zinc-200/92">{teamMotto}</p>
              <p className="mt-4 max-w-[42rem] text-base leading-relaxed text-zinc-300/84">{teamState.copy}</p>

              <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-zinc-300/86">
                {metrics.map((metric) => (
                  <div key={metric.label} className="inline-flex items-center gap-2">
                    <span className={cn("size-2 rounded-full shadow-[0_0_10px_rgba(163,230,53,0.34)]", metric.label === "решения" ? "bg-amber-300" : "bg-lime-300")} />
                    <span className="font-semibold text-zinc-50">{metric.value}</span>
                    <span className="text-zinc-500">{metric.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="w-full max-w-sm rounded-[1.65rem] border border-white/10 bg-black/30 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.22)] lg:mt-3">
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">Событие дня</p>
              <p className="mt-3 text-lg font-semibold leading-snug text-zinc-50">{highlight}</p>
              <div className="mt-5 flex items-center gap-2 text-sm text-zinc-400">
                <CheckCircle2 className="size-4 text-lime-200" />
                <span>{teamState.label}</span>
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button
              type="button"
              onClick={onProcessClients}
              disabled={summary.needsAction === 0}
              className="h-12 rounded-full bg-lime-300 px-6 text-black hover:bg-lime-200 disabled:bg-zinc-800 disabled:text-zinc-500"
            >
              <UsersRound className="size-4" />
              {summary.needsAction > 0 ? `Обработать ${summary.needsAction} ${getClientPlural(summary.needsAction)}` : "Все по плану"}
            </Button>
            <Button
              type="button"
              onClick={() => setSettingsOpen(true)}
              variant="outline"
              className="h-12 rounded-full border-white/10 bg-black/22 px-6 text-zinc-100 hover:bg-zinc-900/80"
            >
              <Settings2 className="size-4" />
              Настроить команду
            </Button>
          </div>
        </div>
      </section>

      <TeamSettingsSheet
        open={settingsOpen}
        teamName={teamName}
        teamMotto={teamMotto}
        coverStyle={coverStyle}
        onOpenChange={setSettingsOpen}
        onTeamNameChange={setTeamName}
        onTeamMottoChange={setTeamMotto}
        onCoverStyleChange={setCoverStyle}
      />
    </>
  );
}

function TeamSettingsSheet({
  open,
  teamName,
  teamMotto,
  coverStyle,
  onOpenChange,
  onTeamNameChange,
  onTeamMottoChange,
  onCoverStyleChange,
}: {
  open: boolean;
  teamName: string;
  teamMotto: string;
  coverStyle: CoverStyle;
  onOpenChange: (open: boolean) => void;
  onTeamNameChange: (value: string) => void;
  onTeamMottoChange: (value: string) => void;
  onCoverStyleChange: (value: CoverStyle) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto border-zinc-800 bg-zinc-950/98 p-0 text-zinc-100 sm:!max-w-[520px]">
        <SheetHeader className="border-b border-zinc-800/80 px-5 py-4">
          <div className="pr-10">
            <SheetTitle className="text-xl font-semibold tracking-tight text-zinc-50">Настроить команду</SheetTitle>
            <SheetDescription className="mt-1 text-zinc-500">Локальный прототип оформления штаба команды.</SheetDescription>
          </div>
        </SheetHeader>

        <div className="space-y-6 px-5 py-5">
          <div className="space-y-2">
            <Label htmlFor="team-name" className="text-zinc-300">
              Название команды
            </Label>
            <Input
              id="team-name"
              value={teamName}
              onChange={(event) => onTeamNameChange(event.target.value)}
              className="border-zinc-800 bg-black/35 text-zinc-100"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="team-motto" className="text-zinc-300">
              Девиз команды
            </Label>
            <Input
              id="team-motto"
              value={teamMotto}
              onChange={(event) => onTeamMottoChange(event.target.value)}
              className="border-zinc-800 bg-black/35 text-zinc-100"
            />
          </div>

          <section>
            <p className="text-sm font-medium text-zinc-200">Обложка команды</p>
            <div className="mt-3 grid gap-2">
              {coverOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => onCoverStyleChange(option.id)}
                  className={cn(
                    "rounded-2xl border p-3 text-left transition",
                    coverStyle === option.id
                      ? "border-lime-300/35 bg-lime-300/10 text-lime-100"
                      : "border-zinc-800 bg-black/20 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                  )}
                >
                  <span className="block text-sm font-medium">{option.label}</span>
                  <span className="mt-1 block text-xs text-zinc-500">{option.helper}</span>
                </button>
              ))}
            </div>
          </section>

          <section>
            <p className="text-sm font-medium text-zinc-200">Акцентный стиль</p>
            <div className="mt-3 rounded-2xl border border-lime-300/20 bg-lime-300/[0.06] p-3">
              <p className="text-sm text-lime-100">Lime Performance</p>
              <p className="mt-1 text-xs leading-relaxed text-zinc-500">Используем текущий акцент продукта, чтобы тренерский кабинет оставался в одной системе с клиентским.</p>
            </div>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function getHeroState(summary: TeamSummary) {
  if (summary.needsAction === 0) {
    return {
      label: "Команда под контролем",
      copy: "Команда под контролем. У всех спортсменов есть следующий шаг.",
    };
  }

  if (summary.needsAction >= 10) {
    return {
      label: "Насыщенный день",
      copy: `Сегодня насыщенный день. ${summary.needsAction} спортсменов ждут решения тренера.`,
    };
  }

  return {
    label: "Рабочий ритм",
    copy: `${summary.onTrack} спортсменов идут по плану. ${summary.needsAction} решения требуют внимания.`,
  };
}

function getTodayHighlight(items: TeamActivityItem[]) {
  const record = items.find((item) => item.dateGroup === "today" && item.type === "personal_record");
  if (record) return record.title.replace("Мария поставила личный рекорд", "Мария поставила личный рекорд в румынской тяге");

  const completed = items.find((item) => item.dateGroup === "today" && item.type === "completed_workout");
  if (completed) return completed.title;

  return "Команда держит спокойный рабочий ритм.";
}

function getClientPlural(count: number) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return "клиента";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "клиента";
  return "клиентов";
}
