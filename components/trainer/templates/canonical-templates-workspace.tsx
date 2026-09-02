"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Archive,
  ChevronDown,
  Copy,
  Eye,
  FileClock,
  FilePlus2,
  Filter,
  Loader2,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type {
  TemplateWorkspaceItem,
  TemplateWorkspaceLifecycleFilter,
  TemplateWorkspaceReadModel,
  TemplateWorkspaceRevisionSummary,
} from "@/lib/template-workspace-contract";
import {
  parseTemplateWorkspaceUrlState,
  templateWorkspaceBuilderHref,
  templateWorkspaceHref,
  type TemplateWorkspaceUrlState,
} from "@/lib/template-workspace-navigation";
import { cn } from "@/lib/utils";

import {
  archiveTemplate,
  createTemplateRevision,
  duplicateTemplate,
  fetchTemplateWorkspace,
  TemplateWorkspaceRequestError,
} from "./template-workspace-client";

type Notice = {
  tone: "success" | "info" | "error";
  message: string;
  retry?: () => void;
};
export type DialogCommandError = {
  errorCode: string | null;
  errorMessage: string | null;
  retryable: boolean;
};
export type DuplicateAttempt = {
  item: TemplateWorkspaceItem;
  title: string;
  commandId: string;
  newTemplateId: string;
  newRevisionId: string;
  trigger: HTMLElement | null;
  renewedAfterEdit: boolean;
} & DialogCommandError;
type ArchiveAttempt = {
  item: TemplateWorkspaceItem;
  commandId: string;
  trigger: HTMLElement | null;
} & DialogCommandError;
type RevisionAttempt = { item: TemplateWorkspaceItem; commandId: string };
type InternalPageSync = {
  filterKey: string;
  page: number;
  refreshVersion: number;
};
type StaleDialogRefresh = {
  kind: "duplicate" | "archive";
  message: string;
};

const lifecycleOptions: Array<{ value: TemplateWorkspaceLifecycleFilter; label: string }> = [
  { value: "all", label: "Все" },
  { value: "drafts", label: "Только черновики" },
  { value: "published", label: "Готовые" },
  { value: "updates", label: "Есть новая версия" },
  { value: "archive", label: "Архив" },
];

export function CanonicalTemplatesWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const parsed = useMemo(() => parseTemplateWorkspaceUrlState(searchParams), [searchParams]);
  const urlState = parsed.state;
  const [searchValue, setSearchValue] = useState(urlState.q);
  const [workspace, setWorkspace] = useState<TemplateWorkspaceReadModel | null>(null);
  const [items, setItems] = useState<TemplateWorkspaceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [listError, setListError] = useState<"forbidden" | "unavailable" | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [liveMessage, setLiveMessage] = useState("");
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [mobileStatus, setMobileStatus] = useState(urlState.status);
  const [mobileCategory, setMobileCategory] = useState(urlState.category);
  const [duplicateAttempt, setDuplicateAttempt] = useState<DuplicateAttempt | null>(null);
  const [archiveAttempt, setArchiveAttempt] = useState<ArchiveAttempt | null>(null);
  const [revisionAttempt, setRevisionAttempt] = useState<RevisionAttempt | null>(null);
  const [commandBusy, setCommandBusy] = useState<"revision" | "duplicate" | "archive" | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const collectionRef = useRef<HTMLElement>(null);
  const requestSequenceRef = useRef(0);
  const postRefreshFocusRef = useRef<string | "collection" | null>(null);
  const loadedDepthRef = useRef(1);
  const internalPageSyncRef = useRef<InternalPageSync | null>(null);
  const staleDialogRefreshRef = useRef<StaleDialogRefresh | null>(null);
  const filterKey = templateWorkspaceFilterKey(urlState);

  const returnState = useMemo<TemplateWorkspaceUrlState>(() => ({
    ...urlState,
    anchor: null,
  }), [urlState]);

  const replaceState = useCallback((next: TemplateWorkspaceUrlState) => {
    router.replace(templateWorkspaceHref(next), { scroll: false });
  }, [router]);

  useEffect(() => {
    if (!parsed.invalidStatus && !parsed.invalidPage && !parsed.invalidAnchor) return;
    replaceState(parsed.state);
    setNotice({ tone: "info", message: "Некорректные параметры списка были сброшены." });
  }, [parsed, replaceState]);

  useEffect(() => setSearchValue(urlState.q), [urlState.q]);

  useEffect(() => {
    if (searchValue.trim().replace(/\s+/g, " ") === urlState.q) return;
    const timer = window.setTimeout(() => {
      replaceState({ ...urlState, q: searchValue, page: 1, anchor: null });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [replaceState, searchValue, urlState]);

  useEffect(() => {
    if (shouldSkipInternalPageReplay(internalPageSyncRef.current, filterKey, urlState.page, refreshVersion)) {
      internalPageSyncRef.current = null;
      return;
    }
    const sequence = ++requestSequenceRef.current;
    const controller = new AbortController();
    setLoading(true);
    setListError(null);
    const startRequest = window.setTimeout(() => void (async () => {
      try {
        let page = await fetchTemplateWorkspace({
          status: urlState.status,
          q: urlState.q,
          category: urlState.category,
          signal: controller.signal,
        });
        let merged = page.items;
        let loadedDepth = 1;
        while (loadedDepth < urlState.page && page.pageInfo.hasNextPage && page.pageInfo.endCursor) {
          page = await fetchTemplateWorkspace({
            status: urlState.status,
            q: urlState.q,
            category: urlState.category,
            cursor: page.pageInfo.endCursor,
            signal: controller.signal,
          });
          merged = mergeTemplateWorkspaceItems(merged, page.items);
          loadedDepth += 1;
        }
        if (sequence !== requestSequenceRef.current) return;
        loadedDepthRef.current = loadedDepth;
        setWorkspace({ ...page, items: merged });
        setItems(merged);
        setLiveMessage(`Загружено шаблонов: ${merged.length}.`);
        const staleDialog = staleDialogRefreshRef.current;
        if (staleDialog) {
          if (staleDialog.kind === "duplicate") setDuplicateAttempt(null);
          else setArchiveAttempt(null);
          staleDialogRefreshRef.current = null;
          setNotice({ tone: "info", message: staleDialog.message });
        }
        const requestedFocus = postRefreshFocusRef.current ?? urlState.anchor;
        postRefreshFocusRef.current = null;
        if (requestedFocus) focusAfterPaint(requestedFocus, collectionRef);
      } catch (error) {
        if (controller.signal.aborted || sequence !== requestSequenceRef.current) return;
        const staleDialog = staleDialogRefreshRef.current;
        if (staleDialog) {
          const refreshError: DialogCommandError = {
            errorCode: "canonical_refresh_failed",
            errorMessage: "Состояние изменилось, но обновить список не удалось. Закройте окно и повторите загрузку списка.",
            retryable: false,
          };
          if (staleDialog.kind === "duplicate") {
            setDuplicateAttempt((current) => current ? { ...current, ...refreshError } : current);
          } else {
            setArchiveAttempt((current) => current ? { ...current, ...refreshError } : current);
          }
          staleDialogRefreshRef.current = null;
        }
        if (error instanceof TemplateWorkspaceRequestError && error.code === "invalid_cursor") {
          setNotice({ tone: "info", message: "Список обновился. Показана первая страница результатов." });
          replaceState({ ...urlState, page: 1, anchor: null });
          return;
        }
        setListError(error instanceof TemplateWorkspaceRequestError && [401, 403].includes(error.status)
          ? "forbidden"
          : "unavailable");
      } finally {
        if (sequence === requestSequenceRef.current) setLoading(false);
      }
    })(), 0);
    return () => {
      window.clearTimeout(startRequest);
      controller.abort();
    };
  }, [filterKey, refreshVersion, replaceState, urlState]);

  function submitSearch() {
    replaceState({ ...urlState, q: searchValue, page: 1, anchor: null });
  }

  function setFilter(status: TemplateWorkspaceLifecycleFilter, category = urlState.category) {
    replaceState({ ...urlState, status, category, page: 1, anchor: null });
  }

  function resetFilters() {
    setSearchValue("");
    replaceState({ status: "all", q: "", category: "", page: 1, anchor: null });
  }

  async function loadMore(keyboardTriggered: boolean) {
    if (!workspace?.pageInfo.hasNextPage || !workspace.pageInfo.endCursor || loadingMore) return;
    setLoadingMore(true);
    const previousIds = new Set(items.map((item) => item.templateId));
    try {
      const next = await fetchTemplateWorkspace({
        status: urlState.status,
        q: urlState.q,
        category: urlState.category,
        cursor: workspace.pageInfo.endCursor,
      });
      const merged = mergeTemplateWorkspaceItems(items, next.items);
      const firstAdded = next.items.find((item) => !previousIds.has(item.templateId));
      const nextDepth = loadedDepthRef.current + 1;
      const urlPage = Math.min(nextDepth, 5);
      loadedDepthRef.current = nextDepth;
      setItems(merged);
      setWorkspace({ ...next, items: merged });
      setLiveMessage(`Добавлено шаблонов: ${merged.length - items.length}. Всего показано: ${merged.length}.`);
      internalPageSyncRef.current = { filterKey, page: urlPage, refreshVersion };
      replaceState({ ...urlState, page: urlPage, anchor: firstAdded?.templateId ?? urlState.anchor });
      if (keyboardTriggered && firstAdded) focusAfterPaint(firstAdded.templateId, collectionRef);
    } catch (error) {
      if (error instanceof TemplateWorkspaceRequestError && error.code === "invalid_cursor") {
        setNotice({ tone: "info", message: "Список изменился. Начинаем с первой страницы." });
        replaceState({ ...urlState, page: 1, anchor: null });
      } else {
        setNotice({ tone: "error", message: "Не удалось загрузить следующую часть списка. Уже показанные шаблоны сохранены." });
      }
    } finally {
      setLoadingMore(false);
    }
  }

  function openDuplicate(item: TemplateWorkspaceItem, trigger: HTMLElement | null) {
    const title = item.primaryRevision?.title || "Без названия";
    setDuplicateAttempt({
      item,
      title: `Копия — ${title}`.slice(0, 120),
      commandId: crypto.randomUUID(),
      newTemplateId: crypto.randomUUID(),
      newRevisionId: crypto.randomUUID(),
      trigger,
      renewedAfterEdit: false,
      errorCode: null,
      errorMessage: null,
      retryable: false,
    });
  }

  function changeDuplicateTitle(title: string) {
    setDuplicateAttempt((current) => {
      if (!current) return current;
      return duplicateAttemptAfterTitleChange(current, title, {
        commandId: crypto.randomUUID(),
        newTemplateId: crypto.randomUUID(),
        newRevisionId: crypto.randomUUID(),
      });
    });
  }

  async function runDuplicate() {
    const attempt = duplicateAttempt;
    const source = attempt?.item.actionPreconditions.duplicateSource;
    if (!attempt || !source || commandBusy) return;
    setCommandBusy("duplicate");
    try {
      const result = await duplicateTemplate({
        commandId: attempt.commandId,
        sourceTemplateId: attempt.item.templateId,
        sourceRevisionIntent: source.intent,
        newTemplateId: attempt.newTemplateId,
        newRevisionId: attempt.newRevisionId,
        title: attempt.title.trim(),
      });
      setDuplicateAttempt(null);
      router.push(templateWorkspaceBuilderHref({
        mode: "editable",
        templateId: result.template.id,
        returnState: { ...urlState, anchor: result.template.id },
      }));
    } catch (error) {
      if (isLifecycleStale(error)) {
        handleStaleDialog("duplicate", "Шаблон изменился в другой вкладке. Действия обновлены.");
      } else {
        setDuplicateAttempt((current) => current ? withDialogCommandError(current, dialogCommandError(error, "Не удалось создать копию. Название сохранено.", true)) : current);
      }
    } finally {
      setCommandBusy(null);
    }
  }

  function openArchive(item: TemplateWorkspaceItem, trigger: HTMLElement | null) {
    setArchiveAttempt({
      item,
      commandId: crypto.randomUUID(),
      trigger,
      errorCode: null,
      errorMessage: null,
      retryable: false,
    });
  }

  async function runArchive() {
    const attempt = archiveAttempt;
    if (!attempt || commandBusy) return;
    const index = items.findIndex((item) => item.templateId === attempt.item.templateId);
    const fallback = urlState.status === "archive"
      ? attempt.item.templateId
      : items[index + 1]?.templateId ?? items[index - 1]?.templateId ?? "collection";
    setCommandBusy("archive");
    try {
      await archiveTemplate({
        templateId: attempt.item.templateId,
        commandId: attempt.commandId,
        expectedTemplateToken: attempt.item.actionPreconditions.lifecycleActionToken,
      });
      setArchiveAttempt(null);
      setNotice({ tone: "success", message: "Шаблон перемещён в архив." });
      postRefreshFocusRef.current = fallback;
      setRefreshVersion((value) => value + 1);
    } catch (error) {
      if (isLifecycleStale(error)) {
        handleStaleDialog("archive", "Шаблон уже изменился. Список и доступные действия обновлены.");
      } else {
        setArchiveAttempt((current) => current ? withDialogCommandError(current, dialogCommandError(error, "Не удалось архивировать шаблон.")) : current);
      }
    } finally {
      setCommandBusy(null);
    }
  }

  async function runRevision(attempt: RevisionAttempt) {
    if (commandBusy) return;
    setRevisionAttempt(attempt);
    setCommandBusy("revision");
    try {
      const result = await createTemplateRevision({
        templateId: attempt.item.templateId,
        commandId: attempt.commandId,
        expectedTemplateToken: attempt.item.actionPreconditions.lifecycleActionToken,
      });
      setRevisionAttempt(null);
      router.push(templateWorkspaceBuilderHref({
        mode: "editable",
        templateId: result.template.id,
        returnState: { ...urlState, anchor: result.template.id },
      }));
    } catch (error) {
      if (isLifecycleStale(error)) handleRevisionStale("Шаблон изменился. Проверьте обновлённое состояние перед созданием версии.");
      else setNotice({
        tone: "error",
        message: "Не удалось создать новую версию.",
        retry: () => void runRevision(attempt),
      });
    } finally {
      setCommandBusy(null);
    }
  }

  function handleStaleDialog(kind: StaleDialogRefresh["kind"], message: string) {
    const staleError: DialogCommandError = {
      errorCode: "stale_lifecycle",
      errorMessage: "Состояние шаблона изменилось. Обновляем подтверждённые данные…",
      retryable: false,
    };
    if (kind === "duplicate") {
      setDuplicateAttempt((current) => current ? { ...current, ...staleError } : current);
    } else {
      setArchiveAttempt((current) => current ? { ...current, ...staleError } : current);
    }
    staleDialogRefreshRef.current = { kind, message };
    postRefreshFocusRef.current = "collection";
    setRefreshVersion((value) => value + 1);
  }

  function handleRevisionStale(message: string) {
    setRevisionAttempt(null);
    setNotice({ tone: "info", message });
    postRefreshFocusRef.current = "collection";
    setRefreshVersion((value) => value + 1);
  }

  const createHref = templateWorkspaceBuilderHref({ mode: "create", returnState });
  const count = workspace?.resultCount.value;
  const hasFilters = urlState.status !== "all" || Boolean(urlState.q) || Boolean(urlState.category);

  return (
    <section aria-labelledby="template-collection-heading" className="mx-auto w-full max-w-[1420px]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-900 pb-4">
        <div>
          <h2 id="template-collection-heading" ref={collectionRef as RefObject<HTMLHeadingElement>} tabIndex={-1} className="text-sm font-medium text-zinc-300 outline-none">
            Коллекция шаблонов
          </h2>
          <p aria-live="polite" className="mt-1 text-sm text-zinc-500">
            {typeof count === "number" ? `Найдено ${count}` : loading ? "Загружаем список" : `Показано ${items.length}`}
            {loading && items.length ? " · обновляем список" : ""}
          </p>
        </div>
        <Button asChild className="min-h-11 rounded-full bg-lime-300 px-5 text-black hover:bg-lime-200">
          <Link href={createHref}><Plus className="size-4" />Создать шаблон</Link>
        </Button>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(260px,1fr)_auto_220px_auto]" aria-label="Фильтры шаблонов">
        <form className="relative" onSubmit={(event) => { event.preventDefault(); submitSearch(); }} role="search">
          <Label htmlFor="template-workspace-search" className="sr-only">Поиск шаблонов</Label>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-600" />
          <Input
            ref={searchRef}
            id="template-workspace-search"
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            placeholder="Название, описание или категория"
            maxLength={200}
            className="h-11 border-zinc-800 bg-zinc-950 pl-10 pr-11 text-zinc-100"
          />
          {searchValue ? (
            <button
              type="button"
              onClick={() => { setSearchValue(""); replaceState({ ...urlState, q: "", page: 1, anchor: null }); searchRef.current?.focus(); }}
              aria-label="Очистить поиск"
              className="absolute right-1 top-1 flex size-9 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-900 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-300/60"
            ><X className="size-4" /></button>
          ) : null}
        </form>

        <div className="hidden items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-950 p-1 lg:flex" aria-label="Состояние шаблонов">
          {lifecycleOptions.map((option) => {
            const facet = workspace?.facets.lifecycle[option.value];
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={urlState.status === option.value}
                onClick={() => setFilter(option.value)}
                className={cn(
                  "min-h-9 rounded-md px-3 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-300/60",
                  urlState.status === option.value ? "bg-zinc-100 text-black" : "text-zinc-500 hover:bg-zinc-900 hover:text-zinc-100",
                )}
              >{option.label}{typeof facet === "number" ? ` · ${facet}` : ""}</button>
            );
          })}
        </div>

        <div className="hidden lg:block">
          <Label htmlFor="template-workspace-category" className="sr-only">Категория</Label>
          <select
            id="template-workspace-category"
            value={urlState.category}
            onChange={(event) => setFilter(urlState.status, event.target.value)}
            className="h-11 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-200 outline-none focus:border-lime-300/40 focus:ring-2 focus:ring-lime-300/20"
          >
            <option value="">Все категории</option>
            {workspace?.facets.categories.map((category) => (
              <option key={category.key} value={category.key}>{category.label} · {category.count}</option>
            ))}
            {urlState.category && !workspace?.facets.categories.some((item) => item.key === urlState.category) ? (
              <option value={urlState.category}>{urlState.category}</option>
            ) : null}
          </select>
        </div>

        <Button type="button" variant="outline" onClick={() => { setMobileStatus(urlState.status); setMobileCategory(urlState.category); setMobileFiltersOpen(true); }} className="min-h-11 rounded-lg border-zinc-800 text-zinc-200 lg:hidden">
          <Filter className="size-4" />Фильтры{hasFilters ? " · выбраны" : ""}
        </Button>
        <Button type="button" variant="ghost" onClick={resetFilters} disabled={!hasFilters} className="hidden min-h-11 text-zinc-500 hover:text-zinc-100 disabled:opacity-30 lg:inline-flex">Сбросить</Button>
      </div>

      {notice ? (
        <div ref={(node) => { if (node && notice.tone === "info") node.focus(); }} tabIndex={-1} role={notice.tone === "error" ? "alert" : "status"} className={noticeClass(notice.tone)}>
          <span>{notice.message}</span>
          <div className="flex shrink-0 items-center gap-2">
            {notice.retry ? <Button type="button" size="sm" variant="outline" onClick={notice.retry} className="h-8 rounded-full border-zinc-700">Повторить</Button> : null}
            <button type="button" onClick={() => setNotice(null)} aria-label="Закрыть сообщение" className="flex size-8 items-center justify-center rounded-full text-zinc-500 hover:bg-white/5 hover:text-zinc-100"><X className="size-4" /></button>
          </div>
        </div>
      ) : null}

      {listError && items.length > 0 ? (
        <div role="alert" className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-rose-300/20 bg-rose-300/[0.06] px-4 py-3 text-sm text-rose-100">
          <span>Не удалось обновить список. Пока показаны последние подтверждённые данные.</span>
          <Button type="button" size="sm" variant="outline" onClick={() => setRefreshVersion((value) => value + 1)} className="h-8 rounded-full border-zinc-700">Повторить</Button>
        </div>
      ) : null}

      <p className="sr-only" aria-live="polite">{liveMessage}</p>

      {loading && items.length === 0 ? (
        <InitialLoading />
      ) : listError && items.length === 0 ? (
        <ListError state={listError} onRetry={() => setRefreshVersion((value) => value + 1)} />
      ) : items.length === 0 ? (
        <EmptyState filtered={hasFilters} status={urlState.status} onReset={resetFilters} createHref={createHref} />
      ) : (
        <div className="mt-4 overflow-visible rounded-lg border border-zinc-800 bg-zinc-950/55" aria-busy={loading || loadingMore}>
          <ul aria-label="Шаблоны тренировок" className="divide-y divide-zinc-800/90">
            {items.map((item) => (
              <TemplateRow
                key={item.templateId}
                item={item}
                returnState={urlState}
                revisionBusy={commandBusy === "revision" && revisionAttempt?.item.templateId === item.templateId}
                onCreateRevision={(target) => void runRevision({ item: target, commandId: crypto.randomUUID() })}
                onDuplicate={openDuplicate}
                onArchive={openArchive}
              />
            ))}
          </ul>
        </div>
      )}

      {items.length ? (
        <div className="flex min-h-24 items-center justify-center">
          {workspace?.pageInfo.hasNextPage ? (
            <Button type="button" variant="outline" onClick={(event) => void loadMore(event.detail === 0)} disabled={loadingMore} className="min-h-11 rounded-full border-zinc-700 px-5 text-zinc-200">
              {loadingMore ? <Loader2 className="size-4 animate-spin" /> : <ChevronDown className="size-4" />}
              {loadingMore ? "Загружаем…" : "Показать ещё"}
            </Button>
          ) : <p className="text-sm text-zinc-600">Все шаблоны показаны</p>}
        </div>
      ) : null}

      <DuplicateDialog attempt={duplicateAttempt} busy={commandBusy === "duplicate"} onClose={() => setDuplicateAttempt(null)} onTitleChange={changeDuplicateTitle} onConfirm={() => void runDuplicate()} />
      <ArchiveDialog attempt={archiveAttempt} busy={commandBusy === "archive"} onChange={setArchiveAttempt} onConfirm={() => void runArchive()} />

      <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
        <SheetContent side="bottom" className="max-h-[88vh] rounded-t-2xl border-zinc-800 bg-zinc-950 text-zinc-100">
          <SheetHeader>
            <SheetTitle className="text-zinc-50">Фильтры шаблонов</SheetTitle>
            <SheetDescription className="text-zinc-400">Выберите состояние и категорию шаблонов.</SheetDescription>
          </SheetHeader>
          <div className="grid gap-5 overflow-y-auto px-4 pb-4">
            <fieldset className="grid gap-2">
              <legend className="mb-2 text-sm font-medium text-zinc-300">Состояние</legend>
              {lifecycleOptions.map((option) => (
                <label key={option.value} className="flex min-h-11 cursor-pointer items-center justify-between rounded-lg border border-zinc-800 px-3 text-sm">
                  <span>{option.label}</span>
                  <input type="radio" name="mobile-template-status" value={option.value} checked={mobileStatus === option.value} onChange={() => setMobileStatus(option.value)} className="size-4 accent-lime-300" />
                </label>
              ))}
            </fieldset>
            <div>
              <Label htmlFor="mobile-template-category" className="text-zinc-300">Категория</Label>
              <select id="mobile-template-category" value={mobileCategory} onChange={(event) => setMobileCategory(event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-zinc-800 bg-black px-3 text-sm">
                <option value="">Все категории</option>
                {workspace?.facets.categories.map((category) => <option key={category.key} value={category.key}>{category.label} · {category.count}</option>)}
              </select>
            </div>
            <p className="text-sm text-zinc-500">{typeof count === "number" ? `Найдено ${count}` : `Показано ${items.length}`}</p>
          </div>
          <SheetFooter className="grid grid-cols-2 border-t border-zinc-800">
            <Button type="button" variant="outline" onClick={() => { setMobileStatus("all"); setMobileCategory(""); }} className="min-h-11 rounded-full border-zinc-700">Сбросить фильтры</Button>
            <Button type="button" onClick={() => { setMobileFiltersOpen(false); setFilter(mobileStatus, mobileCategory); }} className="min-h-11 rounded-full bg-lime-300 text-black hover:bg-lime-200">Показать результаты</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </section>
  );
}

function TemplateRow({
  item,
  returnState,
  revisionBusy,
  onCreateRevision,
  onDuplicate,
  onArchive,
}: {
  item: TemplateWorkspaceItem;
  returnState: TemplateWorkspaceUrlState;
  revisionBusy: boolean;
  onCreateRevision: (item: TemplateWorkspaceItem) => void;
  onDuplicate: (item: TemplateWorkspaceItem, trigger: HTMLElement | null) => void;
  onArchive: (item: TemplateWorkspaceItem, trigger: HTMLElement | null) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const title = item.primaryRevision?.title || "Без названия";
  const primaryHref = primaryBuilderHref(item, returnState);
  const popoverId = `template-actions-${item.templateId}`;

  useEffect(() => {
    if (!menuOpen) return;
    const onPointer = (event: PointerEvent) => {
      if (!menuRootRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    queueMicrotask(() => menuRootRef.current?.querySelector<HTMLButtonElement>("[data-overflow-action]:not(:disabled)")?.focus());
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const openAction = (callback: () => void) => {
    setMenuOpen(false);
    callback();
  };

  return (
    <li id={`template-row-${item.templateId}`} data-template-id={item.templateId} className="relative grid gap-4 px-4 py-4 sm:px-5 lg:grid-cols-[minmax(230px,1.35fr)_minmax(250px,1.2fr)_minmax(230px,1fr)_auto] lg:items-center lg:gap-6">
      <div className="min-w-0">
        <p className="break-words text-[15px] font-semibold leading-snug text-zinc-100">{title}</p>
        <p className="mt-1 text-xs text-zinc-500">{item.primaryRevision?.category || "Без категории"}</p>
      </div>
      <LifecycleSummary item={item} />
      <RevisionFacts revision={item.primaryRevision} updatedAt={item.meaningfulUpdatedAt} />
      <div className="flex items-center gap-2 lg:justify-end">
        {primaryHref ? (
          <Button id={`template-row-action-${item.templateId}`} asChild size="sm" className="min-h-10 flex-1 rounded-full bg-zinc-100 px-4 text-black hover:bg-white lg:flex-none">
            <Link href={primaryHref} aria-label={`${primaryActionLabel(item)}: ${title}`}>{primaryActionLabel(item)}</Link>
          </Button>
        ) : <span className="text-xs text-zinc-600">Открытие недоступно</span>}
        <div ref={menuRootRef} className="relative">
          <Button
            ref={triggerRef}
            type="button"
            size="icon"
            variant="outline"
            aria-controls={popoverId}
            aria-expanded={menuOpen}
            aria-label={`Действия с шаблоном «${title}»`}
            onClick={() => setMenuOpen((open) => !open)}
            className="size-10 rounded-full border-zinc-700 text-zinc-400 hover:text-zinc-100"
          ><MoreHorizontal className="size-4" /></Button>
          {menuOpen ? (
            <div id={popoverId} role="group" aria-label={`Действия с шаблоном «${title}»`} className="absolute right-0 top-12 z-30 w-64 rounded-lg border border-zinc-700 bg-zinc-950 p-1.5 shadow-2xl">
              {item.lifecycle === "published_with_draft" && item.capabilities.canOpen ? (
                <Link data-overflow-action href={templateWorkspaceBuilderHref({ mode: "published", templateId: item.templateId, returnState: { ...returnState, anchor: item.templateId } })} onClick={() => setMenuOpen(false)} className="flex min-h-10 w-full items-center gap-3 rounded-md px-3 text-left text-sm text-zinc-200 outline-none hover:bg-zinc-900 focus:bg-zinc-900"><Eye className="size-4 shrink-0" />Посмотреть опубликованную версию</Link>
              ) : null}
              {item.capabilities.canCreateRevision ? (
                <MenuButton icon={revisionBusy ? Loader2 : FilePlus2} label={revisionBusy ? "Создаём версию…" : "Создать новую версию"} disabled={revisionBusy} onClick={() => openAction(() => onCreateRevision(item))} />
              ) : null}
              {item.capabilities.canDuplicate ? (
                <MenuButton icon={Copy} label={item.archived ? "Дублировать в новый черновик" : "Дублировать"} onClick={() => openAction(() => onDuplicate(item, triggerRef.current))} />
              ) : null}
              {item.capabilities.canArchive ? (
                <MenuButton icon={Archive} label="Архивировать" danger onClick={() => openAction(() => onArchive(item, triggerRef.current))} />
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
      {item.anomalies.length ? <p className="lg:col-span-4 text-xs text-amber-200">Часть данных шаблона недоступна. Действия ограничены до обновления состояния.</p> : null}
    </li>
  );
}

function LifecycleSummary({ item }: { item: TemplateWorkspaceItem }) {
  if (item.lifecycle === "draft_only") return (
    <div className="min-w-0 text-sm"><p className="font-medium text-amber-100">Черновик · версия {item.editableRevision?.revisionNumber}</p><p className="mt-1 text-xs text-zinc-500">Ещё не опубликован</p></div>
  );
  if (item.lifecycle === "published_only") return (
    <div className="min-w-0 text-sm"><p className="font-medium text-lime-100">Опубликована версия {item.publishedRevision?.revisionNumber}</p><p className="mt-1 text-xs text-zinc-500">Доступна для назначения{item.publishedRevision?.publishedAt ? ` · ${formatDate(item.publishedRevision.publishedAt)}` : ""}</p></div>
  );
  if (item.lifecycle === "published_with_draft") return (
    <div className="min-w-0 text-sm"><p className="font-medium text-lime-100">Опубликована версия {item.publishedRevision?.revisionNumber}</p><p className="mt-1 text-xs text-zinc-500">Доступна для назначения</p><p className="mt-1 text-xs font-medium text-amber-100">Есть черновик версии {item.editableRevision?.revisionNumber}</p></div>
  );
  return (
    <div className="min-w-0 text-sm"><p className="font-medium text-zinc-300">В архиве</p><p className="mt-1 text-xs text-zinc-500">Недоступен для назначения</p><p className="mt-1 text-xs text-zinc-500">Последняя сохранённая версия {item.primaryRevision?.revisionNumber}</p></div>
  );
}

function RevisionFacts({ revision, updatedAt }: { revision: TemplateWorkspaceRevisionSummary | null; updatedAt: string }) {
  return (
    <dl className="grid grid-cols-2 gap-x-5 gap-y-2 text-xs sm:grid-cols-4 lg:grid-cols-2">
      <Fact label="Упражнения" value={revision ? String(revision.exerciseCount) : "—"} />
      <Fact label="Подходы" value={revision ? String(revision.prescribedSetCount) : "—"} />
      <Fact label="Время" value={revision?.estimatedDurationMin ? `${revision.estimatedDurationMin} мин` : "—"} />
      <Fact label="Изменён" value={formatDate(updatedAt)} />
    </dl>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><dt className="text-zinc-600">{label}</dt><dd className="mt-0.5 truncate text-zinc-300">{value}</dd></div>;
}

function MenuButton({ icon: Icon, label, onClick, danger, disabled }: { icon: typeof Copy; label: string; onClick: () => void; danger?: boolean; disabled?: boolean }) {
  return <button type="button" data-overflow-action disabled={disabled} onClick={onClick} className={cn("flex min-h-10 w-full items-center gap-3 rounded-md px-3 text-left text-sm outline-none hover:bg-zinc-900 focus:bg-zinc-900 disabled:opacity-50", danger ? "text-rose-200" : "text-zinc-200")}><Icon className={cn("size-4 shrink-0", disabled && "animate-spin")} />{label}</button>;
}

function DuplicateDialog({ attempt, busy, onClose, onTitleChange, onConfirm }: { attempt: DuplicateAttempt | null; busy: boolean; onClose: () => void; onTitleChange: (value: string) => void; onConfirm: () => void }) {
  const triggerRef = useRef<HTMLElement | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (attempt?.trigger) triggerRef.current = attempt.trigger;
  }, [attempt?.trigger]);
  useEffect(() => {
    if (attempt?.errorMessage) errorRef.current?.focus();
  }, [attempt?.errorMessage]);
  return (
    <Dialog open={Boolean(attempt)} onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
      <DialogContent onCloseAutoFocus={(event) => { event.preventDefault(); triggerRef.current?.focus(); }} className="max-w-[calc(100vw-32px)] border-zinc-800 bg-zinc-950 sm:max-w-lg">
        <DialogHeader><DialogTitle>Дублировать шаблон?</DialogTitle><DialogDescription className="text-zinc-400">Будет создан отдельный неопубликованный черновик. Исходный шаблон не изменится.</DialogDescription></DialogHeader>
        <div className="pt-3"><Label htmlFor="duplicate-template-title" className="text-zinc-300">Название копии</Label><Input id="duplicate-template-title" value={attempt?.title ?? ""} maxLength={120} onChange={(event) => onTitleChange(event.target.value)} disabled={busy} className="mt-2 h-11 border-zinc-700 bg-black" /></div>
        {attempt?.renewedAfterEdit ? <p role="status" className="text-xs text-zinc-500">Название изменено: создана новая попытка команды.</p> : null}
        {attempt?.errorMessage ? <DialogErrorSummary errorRef={errorRef} message={attempt.errorMessage} code={attempt.errorCode} retryable={attempt.retryable} /> : null}
        <DialogFooter className="flex-col-reverse sm:flex-row"><Button type="button" variant="outline" onClick={onClose} disabled={busy} className="min-h-11 rounded-full border-zinc-700">Отмена</Button><Button type="button" onClick={onConfirm} disabled={busy || !attempt?.title.trim() || Boolean(attempt?.errorMessage && !attempt.retryable)} className="min-h-11 rounded-full bg-lime-300 text-black hover:bg-lime-200">{busy ? <Loader2 className="size-4 animate-spin" /> : <Copy className="size-4" />}{busy ? "Дублируем…" : attempt?.errorMessage ? "Повторить дублирование" : "Дублировать и открыть"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ArchiveDialog({ attempt, busy, onChange, onConfirm }: { attempt: ArchiveAttempt | null; busy: boolean; onChange: (value: ArchiveAttempt | null) => void; onConfirm: () => void }) {
  const title = attempt?.item.primaryRevision?.title || "Без названия";
  const triggerRef = useRef<HTMLElement | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (attempt?.trigger) triggerRef.current = attempt.trigger;
  }, [attempt?.trigger]);
  useEffect(() => {
    if (attempt?.errorMessage) errorRef.current?.focus();
  }, [attempt?.errorMessage]);
  return (
    <Dialog open={Boolean(attempt)} onOpenChange={(open) => { if (!open && !busy) onChange(null); }}>
      <DialogContent onCloseAutoFocus={(event) => { event.preventDefault(); triggerRef.current?.focus(); }} className="max-w-[calc(100vw-32px)] border-zinc-800 bg-zinc-950 sm:max-w-lg">
        <DialogHeader><DialogTitle>Архивировать «{title}»?</DialogTitle><DialogDescription className="text-zinc-400">Шаблон исчезнет из активной коллекции и станет недоступен для новых назначений. Существующие назначения не изменятся; опубликованная и черновая версии архивируются вместе.</DialogDescription></DialogHeader>
        {attempt?.errorMessage ? <DialogErrorSummary errorRef={errorRef} message={attempt.errorMessage} code={attempt.errorCode} retryable={attempt.retryable} /> : null}
        <DialogFooter className="flex-col-reverse sm:flex-row"><Button type="button" variant="outline" onClick={() => onChange(null)} disabled={busy} className="min-h-11 rounded-full border-zinc-700">Отмена</Button><Button type="button" variant="destructive" onClick={onConfirm} disabled={busy || Boolean(attempt?.errorMessage && !attempt.retryable)} className="min-h-11 rounded-full">{busy ? <Loader2 className="size-4 animate-spin" /> : <Archive className="size-4" />}{busy ? "Архивируем…" : attempt?.errorMessage ? "Повторить архивацию" : "Архивировать"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const DialogErrorSummary = function DialogErrorSummary({ message, code, retryable, errorRef }: { message: string; code: string | null; retryable: boolean; errorRef: RefObject<HTMLDivElement | null> }) {
  return <div ref={errorRef} tabIndex={-1} role="alert" className="rounded-lg border border-rose-300/20 bg-rose-300/[0.06] px-4 py-3 text-sm text-rose-100 outline-none focus-visible:ring-2 focus-visible:ring-rose-200/50"><p>{message}</p>{code ? <p className="mt-1 text-xs text-rose-200/60">Код: {code}</p> : null}{retryable ? <p className="mt-1 text-xs text-rose-200/70">Можно повторить ту же команду.</p> : null}</div>;
};

function InitialLoading() {
  return <div role="status" className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950/55 p-5"><div className="flex items-center gap-3 text-sm text-zinc-400"><Loader2 className="size-4 animate-spin text-lime-200" />Загружаем шаблоны…</div><div className="mt-5 grid gap-4">{[0, 1, 2].map((value) => <div key={value} className="h-20 animate-pulse rounded-md bg-zinc-900/70" />)}</div></div>;
}

function ListError({ state, onRetry }: { state: "forbidden" | "unavailable"; onRetry: () => void }) {
  return <div role="alert" className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950/55 p-6 text-center"><FileClock className="mx-auto size-6 text-zinc-600" /><h2 className="mt-3 font-semibold text-zinc-100">{state === "forbidden" ? "Шаблоны недоступны" : "Не удалось загрузить шаблоны"}</h2><p className="mt-2 text-sm text-zinc-500">{state === "forbidden" ? "Активируйте доступ тренера или войдите в другой аккаунт." : "Данные не заменены макетами. Повторите загрузку."}</p>{state === "unavailable" ? <Button type="button" variant="outline" onClick={onRetry} className="mt-4 min-h-11 rounded-full border-zinc-700"><RefreshCw className="size-4" />Повторить</Button> : null}</div>;
}

function EmptyState({ filtered, status, onReset, createHref }: { filtered: boolean; status: TemplateWorkspaceLifecycleFilter; onReset: () => void; createHref: string }) {
  const label = status === "drafts" ? "Черновиков пока нет" : status === "published" ? "Готовых шаблонов пока нет" : status === "updates" ? "Шаблонов с новой версией нет" : status === "archive" ? "Архив пуст" : "Шаблонов пока нет";
  return <div className="mt-4 rounded-lg border border-dashed border-zinc-800 p-8 text-center"><FilePlus2 className="mx-auto size-6 text-zinc-600" /><h2 className="mt-3 font-semibold text-zinc-100">{filtered ? "Ничего не найдено" : label}</h2><p className="mt-2 text-sm text-zinc-500">{filtered ? "Измените поиск или фильтры. Полный список не подставляется вместо пустого результата." : "Создайте первый переиспользуемый шаблон тренировки."}</p><div className="mt-4 flex flex-wrap justify-center gap-2">{filtered ? <Button type="button" variant="outline" onClick={onReset} className="min-h-11 rounded-full border-zinc-700">Сбросить фильтры</Button> : null}<Button asChild className="min-h-11 rounded-full bg-lime-300 text-black hover:bg-lime-200"><Link href={createHref}>Создать шаблон</Link></Button></div></div>;
}

function primaryBuilderHref(item: TemplateWorkspaceItem, returnState: TemplateWorkspaceUrlState) {
  const mode = item.lifecycle === "draft_only" || item.lifecycle === "published_with_draft"
    ? "editable"
    : item.lifecycle === "archived" ? "archived" : "published";
  const allowed = mode === "editable" ? item.capabilities.canContinueDraft
    : mode === "archived" ? item.capabilities.canOpenArchived
      : item.capabilities.canOpen;
  if (!allowed) return null;
  return templateWorkspaceBuilderHref({ mode, templateId: item.templateId, returnState: { ...returnState, anchor: item.templateId } });
}

function primaryActionLabel(item: TemplateWorkspaceItem) {
  if (item.lifecycle === "draft_only" || item.lifecycle === "published_with_draft") return "Продолжить редактирование";
  return "Открыть шаблон";
}

export function mergeTemplateWorkspaceItems(current: TemplateWorkspaceItem[], incoming: TemplateWorkspaceItem[]) {
  const incomingIds = new Set(incoming.map((item) => item.templateId));
  return [...current.filter((item) => !incomingIds.has(item.templateId)), ...incoming];
}

export function templateWorkspaceFilterKey(state: Pick<TemplateWorkspaceUrlState, "status" | "q" | "category">) {
  return `${state.status}\u0000${state.q}\u0000${state.category}`;
}

export function shouldSkipInternalPageReplay(sync: InternalPageSync | null, filterKey: string, page: number, refreshVersion: number) {
  return Boolean(sync && sync.filterKey === filterKey && sync.page === page && sync.refreshVersion === refreshVersion);
}

export function withDialogCommandError<T extends DialogCommandError>(attempt: T, error: DialogCommandError): T {
  return { ...attempt, ...error };
}

export function duplicateAttemptAfterTitleChange(
  attempt: DuplicateAttempt,
  title: string,
  renewedIdentity: Pick<DuplicateAttempt, "commandId" | "newTemplateId" | "newRevisionId">,
) {
  if (!attempt.errorCode) return { ...attempt, title };
  return {
    ...attempt,
    ...renewedIdentity,
    title,
    renewedAfterEdit: true,
    errorCode: null,
    errorMessage: null,
    retryable: false,
  };
}

function focusAfterPaint(target: string | "collection", collectionRef: RefObject<HTMLElement | null>) {
  window.requestAnimationFrame(() => {
    if (target === "collection") {
      collectionRef.current?.focus();
      return;
    }
    const rowAction = document.getElementById(`template-row-action-${target}`);
    if (rowAction instanceof HTMLElement) rowAction.focus();
    else collectionRef.current?.focus();
  });
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Moscow" }).format(date);
}

export function isLifecycleStale(error: unknown) {
  return error instanceof TemplateWorkspaceRequestError && [
    "draft_version_conflict",
    "template_lifecycle_conflict",
    "template_archived",
    "template_not_found",
  ].includes(error.code);
}

export function dialogCommandError(error: unknown, fallback: string, renewByEditing = false): DialogCommandError {
  if (error instanceof TemplateWorkspaceRequestError) {
    if (error.code === "command_id_conflict") {
      return {
        errorCode: error.code,
        errorMessage: `${fallback} Идентификатор команды уже использован с другими данными. ${renewByEditing ? "Измените название или закройте окно и начните заново." : "Закройте окно и начните команду заново."}`,
        retryable: false,
      };
    }
    const retryable = error.status >= 500 || error.code === "temporarily_unavailable";
    return {
      errorCode: error.code,
      errorMessage: retryable ? `${fallback} Можно повторить без потери введённых данных.` : fallback,
      retryable,
    };
  }
  return {
    errorCode: "network_error",
    errorMessage: `${fallback} Проверьте соединение и повторите команду.`,
    retryable: true,
  };
}

function noticeClass(tone: Notice["tone"]) {
  return cn(
    "mt-4 flex min-h-11 items-center justify-between gap-3 rounded-lg border px-4 py-2 text-sm outline-none",
    tone === "success" && "border-lime-300/20 bg-lime-300/[0.06] text-lime-100",
    tone === "info" && "border-sky-300/20 bg-sky-300/[0.06] text-sky-100",
    tone === "error" && "border-rose-300/20 bg-rose-300/[0.06] text-rose-100",
  );
}
