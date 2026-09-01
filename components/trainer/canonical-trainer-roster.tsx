"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, ClipboardCheck, Copy, Dumbbell, Link2, Loader2, Search, UserRound, Users } from "lucide-react";
import { toast } from "sonner";

import {
  buildCanonicalTrainerRoster,
  filterCanonicalTrainerRoster,
  type CanonicalRosterAthlete,
  type CanonicalRosterFilter,
  type CanonicalRosterStatus,
} from "@/components/trainer/canonical-trainer-roster-model";
import { TrainerShell } from "@/components/trainer/trainer-shell";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { TrainerDashboardSnapshot } from "@/lib/server/trainer-dashboard/trainer-dashboard-types";
import { quickAssignHref } from "@/lib/quick-assign-navigation";
import { createTrainerWorkflowContext } from "@/lib/trainer-workflow-transition";
import { cn } from "@/lib/utils";

async function copyInvitationUrl(value: string) {
  try {
    if (!navigator.clipboard?.writeText) return false;
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

export function CanonicalTrainerRoster() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [snapshot, setSnapshot] = useState<TrainerDashboardSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [search, setSearch] = useState(() => searchParams.get("search") ?? "");
  const [filter, setFilter] = useState<CanonicalRosterFilter>(() => rosterFilter(searchParams.get("filter")));
  const [inviting, setInviting] = useState(false);
  const [inviteUrl, setInviteUrl] = useState("");

  async function load() {
    setLoading(true);
    setFailed(false);
    try {
      const dashboardResponse = await fetch("/api/trainer/dashboard", { cache: "no-store" });
      if (!dashboardResponse.ok) throw new Error("load_failed");
      setSnapshot(await dashboardResponse.json() as TrainerDashboardSnapshot);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  useEffect(() => {
    if (loading || searchParams.get("focus") !== "row") return;
    const athleteUserId = searchParams.get("athlete");
    if (!athleteUserId) return;
    const frame = window.requestAnimationFrame(() => {
      const row = document.querySelector<HTMLElement>(`[data-roster-athlete="${athleteUserId}"]`);
      const target = row ?? document.getElementById("roster-heading");
      target?.focus({ preventScroll: true });
      target?.scrollIntoView({ block: "center", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [loading, searchParams]);

  const roster = useMemo(() => snapshot ? buildCanonicalTrainerRoster(snapshot) : null, [snapshot]);
  const visibleAthletes = useMemo(
    () => filterCanonicalTrainerRoster(roster?.athletes ?? [], filter, search),
    [filter, roster?.athletes, search],
  );

  function updateListState(next: { search?: string; filter?: CanonicalRosterFilter }) {
    const nextSearch = next.search ?? search;
    const nextFilter = next.filter ?? filter;
    setSearch(nextSearch);
    setFilter(nextFilter);
    const params = new URLSearchParams();
    if (nextSearch) params.set("search", nextSearch);
    if (nextFilter !== "all") params.set("filter", nextFilter);
    router.replace(`/trainer/clients${params.size ? `?${params}` : ""}`, { scroll: false });
  }

  function openAssignment(athlete: CanonicalRosterAthlete) {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (filter !== "all") params.set("filter", filter);
    params.set("focus", "row");
    params.set("athlete", athlete.athleteUserId);
    const returnTo = `/trainer/clients?${params}`;
    const context = createTrainerWorkflowContext({
      origin: "clients",
      athleteUserId: athlete.athleteUserId,
      returnTo,
      returnAnchor: "next-assignment",
    });
    router.push(quickAssignHref({ athleteUserId: athlete.athleteUserId, context }));
  }

  async function createInvitation() {
    if (inviting) return;
    setInviting(true);
    try {
      const response = await fetch("/api/access/invitations", { method: "POST" });
      if (!response.ok) throw new Error("invite_failed");
      const body = await response.json() as { invitationUrl: string };
      setInviteUrl(body.invitationUrl);
      const copied = await copyInvitationUrl(body.invitationUrl);
      toast.success(copied ? "Ссылка приглашения скопирована" : "Ссылка приглашения создана");
    } catch {
      toast.error("Не удалось создать приглашение");
    } finally {
      setInviting(false);
    }
  }

  return (
    <TrainerShell
      title="Спортсмены"
      description="Команда, текущий статус и следующий рабочий шаг"
      headerAction={(
        <Button type="button" onClick={() => void createInvitation()} disabled={inviting} className="rounded-full bg-lime-300 text-black hover:bg-lime-200">
          {inviting ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" />}
          Пригласить
        </Button>
      )}
    >
      <main className="min-h-screen bg-black px-4 py-5 pb-28 text-zinc-100 sm:px-6 lg:px-8 lg:pb-8">
        <div className="mx-auto w-full max-w-[1440px] space-y-5">
          {inviteUrl ? <InvitationReceipt inviteUrl={inviteUrl} /> : null}

          {loading ? (
            <div className="grid min-h-[60vh] place-items-center" aria-label="Загрузка спортсменов"><Loader2 className="size-6 animate-spin text-zinc-500" /></div>
          ) : failed || !roster ? (
            <div className="grid min-h-[60vh] place-items-center text-center">
              <div><h2 className="text-xl font-semibold">Не удалось загрузить спортсменов</h2><Button type="button" onClick={() => void load()} variant="outline" className="mt-4 rounded-full border-zinc-700">Повторить</Button></div>
            </div>
          ) : roster.summary.total === 0 ? (
            <EmptyRoster onInvite={() => void createInvitation()} />
          ) : (
            <>
              <RosterSummary summary={roster.summary} />

              <section aria-labelledby="roster-heading" className="overflow-hidden rounded-lg border border-zinc-800/90 bg-zinc-950/80">
                <div className="flex flex-col gap-4 border-b border-zinc-800 px-4 py-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Команда</p>
                    <h2 id="roster-heading" className="mt-1 text-xl font-semibold">Все спортсмены</h2>
                  </div>
                  <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="relative min-w-0 sm:w-72">
                      <Search className="pointer-events-none absolute left-3 top-3 size-4 text-zinc-600" />
                      <Input aria-label="Поиск спортсмена" value={search} onChange={(event) => updateListState({ search: event.target.value })} placeholder="Имя или статус" className="h-10 border-zinc-800 bg-black pl-9" />
                    </div>
                    <RosterFilters filter={filter} onChange={(next) => updateListState({ filter: next })} summary={roster.summary} />
                  </div>
                </div>

                {visibleAthletes.length > 0 ? (
                  <div role="table" aria-label="Список спортсменов">
                    <div role="row" className="hidden grid-cols-[minmax(240px,1.1fr)_190px_minmax(220px,1fr)_130px_150px] gap-4 border-b border-zinc-800 px-5 py-2.5 text-xs uppercase text-zinc-600 lg:grid">
                      <span role="columnheader">Спортсмен</span><span role="columnheader">Статус</span><span role="columnheader">Следующий шаг</span><span role="columnheader">Активность</span><span role="columnheader" className="text-right">Действие</span>
                    </div>
                    <div className="divide-y divide-zinc-800/85">
                      {visibleAthletes.map((athlete) => <RosterRow key={athlete.athleteUserId} athlete={athlete} onAssign={openAssignment} />)}
                    </div>
                  </div>
                ) : (
                  <div className="px-5 py-16 text-center"><Search className="mx-auto size-7 text-zinc-700" /><p className="mt-3 font-medium">Ничего не найдено</p><button type="button" onClick={() => updateListState({ search: "", filter: "all" })} className="mt-2 text-sm text-lime-200 hover:text-lime-100">Сбросить поиск и фильтры</button></div>
                )}
              </section>
            </>
          )}
        </div>
      </main>
    </TrainerShell>
  );
}

function RosterSummary({ summary }: { summary: { total: number; attention: number; waitingReview: number; onTrack: number } }) {
  const items = [
    { label: "Всего", value: summary.total, icon: Users, tone: "neutral" },
    { label: "Нужен шаг", value: summary.attention, icon: Dumbbell, tone: "attention" },
    { label: "Ждут разбора", value: summary.waitingReview, icon: ClipboardCheck, tone: "review" },
    { label: "По плану", value: summary.onTrack, icon: CheckCircle2, tone: "calm" },
  ] as const;
  return (
    <section aria-label="Сводка по спортсменам" className="grid grid-cols-2 divide-x divide-y divide-zinc-800 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950/75 sm:grid-cols-4 sm:divide-y-0">
      {items.map((item) => {
        const Icon = item.icon;
        return <div key={item.label} className="flex items-center gap-3 px-4 py-4 sm:px-5"><span className={cn("flex size-9 items-center justify-center rounded-full border", item.tone === "attention" && "border-rose-300/20 bg-rose-300/8 text-rose-100", item.tone === "review" && "border-amber-300/20 bg-amber-300/8 text-amber-100", item.tone === "calm" && "border-lime-300/20 bg-lime-300/8 text-lime-100", item.tone === "neutral" && "border-zinc-700 bg-zinc-900 text-zinc-300")}><Icon className="size-4" /></span><span><span className="block text-xl font-semibold">{item.value}</span><span className="block text-xs text-zinc-500">{item.label}</span></span></div>;
      })}
    </section>
  );
}

function RosterFilters({ filter, onChange, summary }: { filter: CanonicalRosterFilter; onChange: (filter: CanonicalRosterFilter) => void; summary: { total: number; attention: number; waitingReview: number; onTrack: number } }) {
  const filters: Array<{ id: CanonicalRosterFilter; label: string; count: number }> = [
    { id: "all", label: "Все", count: summary.total },
    { id: "attention", label: "Нужен шаг", count: summary.attention },
    { id: "waiting_review", label: "Разбор", count: summary.waitingReview },
    { id: "on_track", label: "По плану", count: summary.onTrack },
  ];
  return <div className="flex max-w-full gap-1 overflow-x-auto rounded-lg border border-zinc-800 bg-black p-1" aria-label="Фильтр спортсменов">{filters.map((item) => <button key={item.id} type="button" onClick={() => onChange(item.id)} aria-pressed={filter === item.id} className={cn("h-8 shrink-0 rounded-md px-2.5 text-xs transition", filter === item.id ? "bg-zinc-800 text-zinc-50" : "text-zinc-500 hover:text-zinc-200")}>{item.label} <span className="text-zinc-600">{item.count}</span></button>)}</div>;
}

function RosterRow({ athlete, onAssign }: { athlete: CanonicalRosterAthlete; onAssign: (athlete: CanonicalRosterAthlete) => void }) {
  return (
    <div role="row" tabIndex={-1} data-roster-athlete={athlete.athleteUserId} aria-label={`${athlete.displayName} ${athlete.statusLabel}`} className="grid gap-3 px-4 py-4 outline-none transition hover:bg-zinc-900/45 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-lime-200 sm:px-5 lg:grid-cols-[minmax(240px,1.1fr)_190px_minmax(220px,1fr)_130px_150px] lg:items-center lg:gap-4">
      <div role="cell" className="flex min-w-0 items-center gap-3"><Avatar className="size-11 shrink-0 border border-zinc-800"><AvatarFallback className="bg-zinc-900 text-sm font-semibold text-zinc-100">{athlete.initials}</AvatarFallback></Avatar><span className="min-w-0"><Link href={`/trainer/clients/${athlete.athleteUserId}`} className="block truncate font-medium text-zinc-50 hover:text-lime-100">{athlete.displayName}</Link><span className="mt-0.5 block text-xs text-zinc-600">Активная связь</span></span></div>
      <div role="cell"><StatusBadge status={athlete.status} label={athlete.statusLabel} /></div>
      <div role="cell" className="min-w-0"><p className="truncate text-sm text-zinc-200">{athlete.nextStep}</p><p className="mt-0.5 truncate text-xs text-zinc-600">{athlete.nextStepDetail}</p></div>
      <div role="cell" className="text-sm text-zinc-500"><span className="lg:hidden">Активность: </span>{athlete.latestActivity}</div>
      <div role="cell" className="flex items-center gap-2 lg:justify-end">
        {athlete.status === "waiting_review" && athlete.reviewHref ? <Button asChild size="sm" className="rounded-full bg-lime-300 px-3 text-black hover:bg-lime-200"><Link href={athlete.reviewHref}>Разобрать</Link></Button> : null}
        {athlete.status === "no_next_workout" ? <Button type="button" size="sm" onClick={() => onAssign(athlete)} aria-label={`Назначить тренировку для ${athlete.displayName}`} className="rounded-full bg-lime-300 px-3 text-black hover:bg-lime-200"><Dumbbell className="size-3.5" />Назначить</Button> : null}
        {athlete.status === "scheduled" || athlete.status === "in_progress" ? <Button asChild size="sm" variant="outline" className="rounded-full border-zinc-700 bg-black/30"><Link href={`/trainer/clients/${athlete.athleteUserId}`}>Профиль</Link></Button> : null}
        <Button asChild size="icon" variant="ghost" className="size-9 rounded-full text-zinc-500" title={`Открыть профиль ${athlete.displayName}`}><Link href={`/trainer/clients/${athlete.athleteUserId}`} aria-label={`Открыть профиль ${athlete.displayName}`}><ArrowRight className="size-4" /></Link></Button>
      </div>
    </div>
  );
}

function rosterFilter(value: string | null): CanonicalRosterFilter {
  return value === "attention" || value === "waiting_review" || value === "on_track" ? value : "all";
}

function StatusBadge({ status, label }: { status: CanonicalRosterStatus; label: string }) {
  return <span className={cn("inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs", status === "waiting_review" && "border-amber-300/20 bg-amber-300/7 text-amber-100", status === "no_next_workout" && "border-rose-300/20 bg-rose-300/7 text-rose-100", status === "in_progress" && "border-sky-300/20 bg-sky-300/7 text-sky-100", status === "scheduled" && "border-lime-300/20 bg-lime-300/7 text-lime-100")}><span className="size-1.5 rounded-full bg-current" />{label}</span>;
}

function InvitationReceipt({ inviteUrl }: { inviteUrl: string }) {
  return <div className="grid gap-2 border-y border-lime-300/20 bg-lime-300/[0.055] px-4 py-3 text-sm text-lime-100 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center"><span className="font-medium">Ссылка приглашения готова</span><Input aria-label="Ссылка приглашения" readOnly value={inviteUrl} className="h-9 min-w-0 border-lime-300/20 bg-black/30 text-xs text-lime-100" /><Button type="button" size="icon" variant="ghost" title="Скопировать ссылку" aria-label="Скопировать ссылку" onClick={() => void copyInvitationUrl(inviteUrl).then((copied) => copied ? toast.success("Ссылка скопирована") : toast.error("Скопируйте ссылку вручную"))}><Copy className="size-4" /></Button></div>;
}

function EmptyRoster({ onInvite }: { onInvite: () => void }) {
  return <section className="grid min-h-[60vh] place-items-center text-center"><div><div className="mx-auto flex size-14 items-center justify-center rounded-full border border-zinc-800 bg-zinc-950"><UserRound className="size-6 text-zinc-500" /></div><h2 className="mt-4 text-xl font-semibold">Пока нет спортсменов</h2><p className="mt-2 text-sm text-zinc-500">Создайте ссылку и отправьте её первому участнику.</p><Button type="button" onClick={onInvite} className="mt-5 rounded-full bg-lime-300 text-black hover:bg-lime-200"><Link2 className="size-4" />Создать ссылку</Button></div></section>;
}
