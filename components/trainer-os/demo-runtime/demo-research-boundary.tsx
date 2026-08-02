"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronRight, FlaskConical, Info, RefreshCcw, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  demoFixtureDefinitions,
  getDemoFixtureDefinition,
  isDemoFixtureId,
  withResearchParams,
} from "./fixtures";
import { useProductDemoRuntime } from "./trainer-demo-runtime";
import type { DemoFixtureId } from "./types";

type PendingAction = { kind: "reset" } | { kind: "switch"; fixtureId: DemoFixtureId } | null;

export function DemoResearchBoundary({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const runtime = useProductDemoRuntime();
  const [isHydrated, setIsHydrated] = useState(false);
  const requestedResearch = searchParams.get("research") === "1";
  const requestedFixtureValue = searchParams.get("fixture");
  const requestedFixture = isDemoFixtureId(requestedFixtureValue) ? requestedFixtureValue : null;
  const invalidFixture = requestedResearch && !requestedFixture;
  const isClientRoute = pathname.startsWith("/client/");
  const requestedActor = isClientRoute ? searchParams.get("actor") : null;
  const fixtureActor = requestedFixture ? getDemoFixtureDefinition(requestedFixture).athleteId : null;
  const missingFixtureActor = requestedResearch && requestedFixture && isClientRoute && !requestedActor;
  const mismatchedFixtureActor = requestedResearch && requestedFixture && isClientRoute && requestedActor !== fixtureActor;

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) setIsHydrated(true);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!runtime.research.ready) return;
    if (requestedResearch && requestedFixture && runtime.research.fixtureId !== requestedFixture) {
      runtime.research.loadFixture(requestedFixture);
    }
  }, [requestedFixture, requestedResearch, runtime.research]);

  useEffect(() => {
    if (!missingFixtureActor || !fixtureActor) return;
    const next = new URLSearchParams(searchParams.toString());
    next.set("actor", fixtureActor);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }, [fixtureActor, missingFixtureActor, pathname, router, searchParams]);

  useEffect(() => {
    if (!runtime.research.ready) return;
    if (!runtime.research.enabled || !runtime.research.fixtureId) return;
    // An explicit research URL is authoritative while the requested fixture is loading.
    if (requestedResearch && requestedFixture) return;
    const next = new URLSearchParams(searchParams.toString());
    next.set("research", "1");
    next.set("fixture", runtime.research.fixtureId);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }, [pathname, requestedFixture, requestedResearch, router, runtime.research, searchParams]);

  if (invalidFixture) return <ResearchSetupError />;
  if (mismatchedFixtureActor && requestedFixture && requestedActor) {
    return <ResearchActorMismatch fixtureId={requestedFixture} requestedActor={requestedActor} />;
  }
  if (missingFixtureActor) return <ResearchLoading fixtureId={requestedFixture ?? "review-required"} />;
  if ((!runtime.research.ready || !isHydrated) && requestedResearch) return <ResearchLoading fixtureId={requestedFixture ?? "review-required"} />;
  if (requestedResearch && requestedFixture && runtime.research.fixtureId !== requestedFixture) {
    return <ResearchLoading fixtureId={requestedFixture} />;
  }

  return (
    <div key={runtime.research.revision}>
      {children}
      {runtime.research.enabled && runtime.research.fixtureId ? <ModeratorToolbar fixtureId={runtime.research.fixtureId} /> : null}
    </div>
  );
}

function ModeratorToolbar({ fixtureId }: { fixtureId: DemoFixtureId }) {
  const router = useRouter();
  const pathname = usePathname();
  const runtime = useProductDemoRuntime();
  const isClientRoute = pathname.startsWith("/client/");
  const fixture = getDemoFixtureDefinition(fixtureId);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const entries = useMemo(() => buildEntries(fixtureId), [fixtureId]);

  function runAction(action: Exclude<PendingAction, null>) {
    if (action.kind === "reset") {
      runtime.research.resetFixture();
      router.push(withResearchParams(fixture.primaryEntry, fixtureId));
      setPendingAction(null);
      return;
    }
    runtime.research.resetFixture(action.fixtureId);
    router.push(withResearchParams(getDemoFixtureDefinition(action.fixtureId).primaryEntry, action.fixtureId));
    setPendingAction(null);
  }

  function requestAction(action: Exclude<PendingAction, null>) {
    setPendingAction(action);
  }

  function openEntry(href: string) {
    runtime.research.clearTransientState();
    router.push(withResearchParams(href, fixtureId));
  }

  return (
    <>
      <aside
        aria-label="Панель модератора"
        className={`fixed right-3 z-[90] rounded-lg border border-lime-300/30 bg-zinc-950/96 p-3 text-zinc-100 shadow-2xl backdrop-blur-xl ${
          isClientRoute
            ? `${detailsOpen ? "w-[min(360px,calc(100vw-24px))]" : "w-auto sm:w-[min(360px,calc(100vw-24px))]"} top-3 sm:bottom-3 sm:top-auto`
            : "bottom-3 w-[min(360px,calc(100vw-24px))]"
        }`}
      >
        <div className="flex items-center gap-2">
          <FlaskConical className="size-4 shrink-0 text-lime-200" aria-hidden="true" />
          <div className={`${isClientRoute && !detailsOpen ? "hidden sm:block" : "block"} min-w-0 flex-1`}>
            <p className="text-xs font-semibold text-zinc-100">Demo · {fixture.label}</p>
            <p className="truncate text-[11px] text-zinc-500">{pathname.startsWith("/client/") ? "Вид клиента" : "Вид тренера"} · сохранено в браузере</p>
          </div>
          <Button type="button" size="icon" variant="ghost" className="size-8 rounded-lg" onClick={() => setDetailsOpen((current) => !current)} aria-label={detailsOpen ? "Скрыть инструменты модератора" : "Показать инструменты модератора"}>
            {detailsOpen ? <X className="size-4" /> : <Info className="size-4" />}
          </Button>
        </div>

        {detailsOpen ? (
          <div className="mt-3 space-y-3 border-t border-zinc-800 pt-3">
            <label className="block text-xs text-zinc-400">
              Сценарий
              <select
                value={fixtureId}
                onChange={(event) => requestAction({ kind: "switch", fixtureId: event.target.value as DemoFixtureId })}
                className="mt-1 h-10 w-full rounded-lg border border-zinc-700 bg-black px-3 text-sm text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-200/70"
              >
                {demoFixtureDefinitions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
            </label>
            <p className="text-xs leading-5 text-zinc-400">{fixture.description}</p>
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant="outline" className="rounded-lg border-zinc-700" onClick={() => openEntry(fixture.trainerEntry)}>Вид тренера</Button>
              <Button type="button" variant="outline" className="rounded-lg border-zinc-700" onClick={() => openEntry(fixture.clientEntry)}>Вид клиента</Button>
            </div>
            <div className="grid max-h-36 gap-1 overflow-y-auto" aria-label="Прямые входы сценария">
              {entries.map((entry) => (
                <button key={entry.label} type="button" onClick={() => openEntry(entry.href)} className="flex min-h-9 items-center justify-between rounded-lg px-2 text-left text-xs text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-200/70">
                  {entry.label}<ChevronRight className="size-3.5" aria-hidden="true" />
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-zinc-800 pt-3">
              <p className="text-[11px] text-zinc-500">{runtime.research.build.label} · {runtime.research.build.stage} · {runtime.research.build.commit}</p>
              <Button type="button" size="sm" variant="ghost" className="rounded-lg" onClick={() => requestAction({ kind: "reset" })}><RefreshCcw className="size-3.5" />Сбросить</Button>
            </div>
          </div>
        ) : null}
      </aside>

      <Dialog open={Boolean(pendingAction)} onOpenChange={(open) => { if (!open) setPendingAction(null); }}>
        <DialogContent className="border-zinc-800 bg-zinc-950 text-zinc-100 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Сбросить изменения сценария?</DialogTitle>
            <DialogDescription className="text-zinc-400">
              {runtime.research.isDirty
                ? "Текущие локальные действия и черновики будут удалены. Демонстрационные исходные данные восстановятся."
                : "Сценарий вернётся к исходному состоянию, а локальные черновики экрана будут удалены."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" className="border-zinc-700" onClick={() => setPendingAction(null)}>Отмена</Button>
            <Button type="button" className="bg-lime-300 text-black hover:bg-lime-200" onClick={() => pendingAction && runAction(pendingAction)}>Сбросить</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function buildEntries(fixtureId: DemoFixtureId) {
  const fixture = getDemoFixtureDefinition(fixtureId);
  const entries = [
    { label: "Trainer Dashboard", href: "/trainer/dashboard" },
    { label: "Athlete Profile", href: `/trainer/clients/${fixture.athleteId}` },
    { label: "Quick Assign", href: `/trainer/clients/${fixture.athleteId}?quickAssign=1` },
    { label: "Builder", href: `/trainer/builder?clientId=${fixture.athleteId}&from=quick-assign${fixtureId === "no-suitable-template" ? "&demo=empty" : ""}` },
    { label: "Client Home", href: `/client/me?actor=${fixture.athleteId}` },
    { label: "Client Workout", href: fixture.clientEntry },
  ];
  if (fixtureId === "review-required" || fixtureId === "discomfort") entries.splice(2, 0, { label: "Workout Review", href: fixture.trainerEntry });
  return entries;
}

function ResearchLoading({ fixtureId }: { fixtureId: DemoFixtureId }) {
  return <main className="flex min-h-dvh items-center justify-center bg-black px-4 text-zinc-100"><div role="status" className="text-center"><FlaskConical className="mx-auto size-7 animate-pulse text-lime-200" /><h1 className="mt-4 text-xl font-semibold">Подготовка сценария</h1><p className="mt-2 text-sm text-zinc-500">{getDemoFixtureDefinition(fixtureId).label}</p></div></main>;
}

function ResearchSetupError() {
  return <main className="flex min-h-dvh items-center justify-center bg-black px-4 text-zinc-100"><section className="max-w-lg rounded-lg border border-zinc-800 bg-zinc-950 p-6 text-center"><h1 className="text-xl font-semibold">Сценарий не найден</h1><p className="mt-2 text-sm text-zinc-400">Research-ссылка не содержит известный fixture. Данные другого сценария не подставлены.</p><Button asChild className="mt-5 bg-lime-300 text-black hover:bg-lime-200"><a href={withResearchParams("/trainer/dashboard", "review-required")}>Открыть стартовый сценарий</a></Button></section></main>;
}

function ResearchActorMismatch({ fixtureId, requestedActor }: { fixtureId: DemoFixtureId; requestedActor: string }) {
  const fixture = getDemoFixtureDefinition(fixtureId);
  return (
    <main className="flex min-h-dvh items-center justify-center bg-black px-4 text-zinc-100">
      <section className="max-w-lg rounded-lg border border-zinc-800 bg-zinc-950 p-6 text-center">
        <h1 className="text-xl font-semibold">Клиент не относится к сценарию</h1>
        <p className="mt-2 text-sm text-zinc-400">Actor `{requestedActor}` не совпадает со спортсменом fixture. Данные другого клиента не показаны.</p>
        <Button asChild className="mt-5 bg-lime-300 text-black hover:bg-lime-200">
          <a href={withResearchParams(fixture.clientEntry, fixtureId)}>Вернуться к клиенту сценария</a>
        </Button>
      </section>
    </main>
  );
}
