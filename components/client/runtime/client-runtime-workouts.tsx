"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ChevronRight, Dumbbell, MessageSquareText, ShieldAlert, SkipForward } from "lucide-react";

import { getClientHistoryView, getClientWorkoutView } from "@/components/trainer-os/demo-runtime/client-selectors";
import { useProductDemoRuntime } from "@/components/trainer-os/demo-runtime/trainer-demo-runtime";
import type { ClientDemoActor, RuntimeExerciseLog, RuntimeSetLog } from "@/components/trainer-os/demo-runtime/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { ClientRuntimeShell } from "./client-runtime-shell";

type ClientRuntimeWorkoutsProps = {
  actorId: string;
  assignmentId?: string;
  sessionId?: string;
  viewMode?: string;
};

export function ClientRuntimeWorkouts({ actorId, assignmentId, sessionId, viewMode }: ClientRuntimeWorkoutsProps) {
  const runtime = useProductDemoRuntime();
  const router = useRouter();
  const view = getClientWorkoutView(runtime.state, actorId, assignmentId, sessionId);
  const history = getClientHistoryView(runtime.state, actorId);
  const [commandError, setCommandError] = useState<string | null>(null);
  const [completionOpen, setCompletionOpen] = useState(false);
  const [comment, setComment] = useState(view?.session?.clientComment ?? "");
  const [discomfortText, setDiscomfortText] = useState(view?.session?.discomfort?.originalText ?? "");
  const [discomfortArea, setDiscomfortArea] = useState(view?.session?.discomfort?.area ?? "");

  if (!view || !history) return <SafeWorkoutState actorId={actorId} title="Клиент не найден" detail={`Demo actor ${actorId} не существует.`} />;
  if (view.notFound) return <SafeWorkoutState actorId={actorId} title={view.notFound === "session" ? "Тренировка не найдена" : "Назначение не найдено"} detail="Запрошенный ID не принадлежит текущему клиенту или был сброшен после reload. Другие данные не подставлены." />;

  const actor: ClientDemoActor = { id: actorId, role: "client" };
  const actorQuery = `actor=${encodeURIComponent(actorId)}`;

  function startSession() {
    if (!view?.assignment) return;
    const result = runtime.commands.startWorkoutSession({ actor, assignmentId: view.assignment.id });
    if (!result.ok) return setCommandError(result.error.message);
    setCommandError(null);
    router.replace(`/client/workouts?${actorQuery}&session=${encodeURIComponent(result.receipt.session.session.id)}`);
  }

  function saveCommentAndDiscomfort() {
    if (!view?.session) return true;
    const commentResult = runtime.commands.saveClientSessionComment({ actor, workoutSessionId: view.session.session.id, comment });
    if (!commentResult.ok) {
      setCommandError(commentResult.error.message);
      return false;
    }
    if (discomfortText.trim()) {
      const discomfortResult = runtime.commands.setDiscomfortSignal({ actor, workoutSessionId: view.session.session.id, originalText: discomfortText, area: discomfortArea, severity: "medium" });
      if (!discomfortResult.ok) {
        setCommandError(discomfortResult.error.message);
        return false;
      }
    }
    setCommandError(null);
    return true;
  }

  function completeSession() {
    if (!view?.session || !saveCommentAndDiscomfort()) return;
    const result = runtime.commands.completeWorkoutSession({ actor, workoutSessionId: view.session.session.id });
    if (!result.ok) return setCommandError(result.error.message);
    setCompletionOpen(false);
    setCommandError(null);
    router.replace(`/client/workouts?${actorQuery}&session=${encodeURIComponent(result.receipt.session.session.id)}&view=history`);
  }

  const session = view.session;
  const showHistory = viewMode === "history" || Boolean(session && session.lifecycleStatus !== "active");

  return (
    <ClientRuntimeShell actorId={actorId} actorName={view.actor.displayName} title="Тренировки" description="Назначение, фактические подходы и история используют одни и те же runtime-факты.">
      <div className="mb-5 flex gap-2" role="navigation" aria-label="Режим тренировок">
        <Button asChild variant={showHistory ? "outline" : "default"} className="rounded-lg">
          <Link href={`/client/workouts?${actorQuery}${view.assignment ? `&assignment=${encodeURIComponent(view.assignment.id)}` : ""}`}>Текущая</Link>
        </Button>
        <Button asChild variant={showHistory ? "default" : "outline"} className="rounded-lg">
          <Link href={`/client/workouts?${actorQuery}&view=history`}>История</Link>
        </Button>
      </div>

      {commandError ? <div role="alert" className="mb-4 rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-100">{commandError}</div> : null}

      {showHistory ? (
        <HistoryPanel actorId={actorId} history={history} onFeedbackViewed={(workoutSessionId) => runtime.commands.recordPilotEvent({ name: "feedback_viewed", athleteId: actorId, workoutSessionId })} />
      ) : !view.assignment ? (
        <EmptyWorkout />
      ) : !session ? (
        <AssignmentOverview assignment={view.assignment} onStart={startSession} />
      ) : (
        <section className="space-y-5" aria-label="Выполнение тренировки">
          <div className="rounded-lg border border-lime-300/18 bg-lime-300/[0.05] p-5">
            <p className="text-xs uppercase text-lime-200">WorkoutSession · в процессе</p>
            <h2 className="mt-2 text-2xl font-semibold text-zinc-50">{session.sessionTitle}</h2>
            <p className="mt-2 text-sm text-zinc-400">{view.assignment.generalInstruction || "Следуйте назначенной структуре и сохраняйте фактический результат каждого подхода."}</p>
          </div>

          <ExerciseBlocks actor={actor} sessionId={session.session.id} exercises={session.exerciseLogs} onError={setCommandError} />

          <section className="grid gap-4 lg:grid-cols-2" aria-labelledby="session-context-heading">
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/80 p-4">
              <Label id="session-context-heading" htmlFor="client-session-comment">Комментарий к тренировке</Label>
              <Textarea id="client-session-comment" value={comment} onChange={(event) => setComment(event.target.value)} className="mt-3 min-h-28 rounded-lg border-zinc-800 bg-black" placeholder="Что было сложным или важным?" />
            </div>
            <div className="rounded-lg border border-amber-300/18 bg-amber-300/[0.04] p-4">
              <Label htmlFor="client-discomfort">Дискомфорт, если был</Label>
              <Textarea id="client-discomfort" value={discomfortText} onChange={(event) => setDiscomfortText(event.target.value)} className="mt-3 min-h-20 rounded-lg border-zinc-800 bg-black" placeholder="Опишите ощущение своими словами" />
              <Label htmlFor="client-discomfort-area" className="mt-3 block text-xs text-zinc-400">Область, необязательно</Label>
              <Input id="client-discomfort-area" value={discomfortArea} onChange={(event) => setDiscomfortArea(event.target.value)} className="mt-2 rounded-lg border-zinc-800 bg-black" placeholder="Например, плечо" />
              <p className="mt-2 text-xs text-zinc-500">Сохраняется исходный текст без диагноза и рекомендаций по лечению.</p>
            </div>
          </section>

          <div className="sticky bottom-20 z-20 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-700 bg-zinc-950/95 p-4 shadow-2xl lg:bottom-4">
            <div>
              <p className="font-medium text-zinc-100">Готовы завершить?</p>
              <p className="text-sm text-zinc-500">Сначала проверьте summary выполненных и пропущенных подходов.</p>
            </div>
            <Dialog open={completionOpen} onOpenChange={setCompletionOpen}>
              <DialogTrigger asChild><Button className="h-11 rounded-lg bg-lime-200 text-black hover:bg-lime-100">Завершить тренировку</Button></DialogTrigger>
              <DialogContent className="max-h-[88dvh] overflow-y-auto rounded-lg">
                <DialogHeader>
                  <DialogTitle>Итоги тренировки</DialogTitle>
                  <DialogDescription>Частичное выполнение допустимо. Тренер увидит только сохранённые факты.</DialogDescription>
                </DialogHeader>
                <CompletionSummary session={session} comment={comment} discomfortText={discomfortText} />
                <DialogFooter className="flex-col-reverse sm:flex-row">
                  <Button variant="outline" className="rounded-lg" onClick={() => setCompletionOpen(false)}>Продолжить заполнение</Button>
                  <Button className="rounded-lg bg-lime-200 text-black" onClick={completeSession}>Подтвердить завершение</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </section>
      )}
    </ClientRuntimeShell>
  );
}

function AssignmentOverview({ assignment, onStart }: { assignment: NonNullable<ReturnType<typeof getClientWorkoutView>>["assignment"]; onStart: () => void }) {
  if (!assignment) return null;
  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-950/80 p-5" aria-labelledby="assignment-title">
      <p className="text-xs uppercase text-lime-200">Назначено тренером · {assignment.scheduledDate}</p>
      <h2 id="assignment-title" className="mt-2 text-3xl font-semibold text-zinc-50">{assignment.templateTitle}</h2>
      <p className="mt-3 text-sm leading-6 text-zinc-400">{assignment.generalInstruction || "Выполните тренировку в комфортном рабочем темпе."}</p>
      <div className="mt-5 space-y-2">
        {assignment.snapshotExercises.map((exercise, index) => (
          <div key={exercise.assignmentExerciseId} className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-black/30 p-3">
            <div><p className="font-medium text-zinc-100">{index + 1}. {exercise.title}</p>{exercise.supersetLabel ? <p className="mt-1 text-xs text-lime-200">{exercise.supersetLabel} · позиция {exercise.supersetOrder}</p> : null}</div>
            <p className="text-sm text-zinc-400">{exercise.setPlans.length} × {exercise.override?.repetitions ?? exercise.repetitions}</p>
          </div>
        ))}
      </div>
      <Button onClick={onStart} className="mt-6 h-12 rounded-lg bg-lime-200 px-5 text-black hover:bg-lime-100">Начать тренировку <ChevronRight className="ml-2 h-4 w-4" /></Button>
    </section>
  );
}

function ExerciseBlocks({ actor, sessionId, exercises, onError }: { actor: ClientDemoActor; sessionId: string; exercises: RuntimeExerciseLog[]; onError: (message: string | null) => void }) {
  const runtime = useProductDemoRuntime();
  const groups = exercises.reduce<Array<{ id: string; label?: string; instruction?: string; exercises: RuntimeExerciseLog[] }>>((items, exercise) => {
    const id = exercise.supersetId ?? exercise.id;
    const existing = items.find((item) => item.id === id);
    if (existing) existing.exercises.push(exercise);
    else items.push({ id, label: exercise.supersetLabel, instruction: exercise.supersetInstruction, exercises: [exercise] });
    return items;
  }, []);

  function skip(exercise: RuntimeExerciseLog) {
    const result = runtime.commands.skipExercise({ actor, workoutSessionId: sessionId, exerciseLogId: exercise.id, reason: "Пропущено клиентом во время сессии" });
    onError(result.ok ? null : result.error.message);
  }

  return <div className="space-y-4">{groups.map((group) => (
    <section key={group.id} className="rounded-lg border border-zinc-800 bg-zinc-950/80 p-4" aria-labelledby={`group-${group.id}`}>
      {group.label ? <div className="mb-4 border-b border-zinc-800 pb-3"><p className="text-xs uppercase text-lime-200">Суперсет</p><h2 id={`group-${group.id}`} className="mt-1 text-lg font-semibold text-zinc-50">{group.label}</h2><p className="mt-1 text-sm text-zinc-500">{group.instruction}</p></div> : null}
      <div className="space-y-5">{group.exercises.map((exercise) => (
        <div key={exercise.id} className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><p className="text-xs text-zinc-500">{exercise.supersetOrder ? `Позиция ${exercise.supersetOrder}` : `Упражнение ${exercise.order}`}</p><h3 className="mt-1 text-lg font-medium text-zinc-100">{exercise.title}</h3></div>
            <Button variant="outline" className="rounded-lg border-zinc-800" onClick={() => skip(exercise)} disabled={exercise.status === "skipped"}><SkipForward className="mr-2 h-4 w-4" />{exercise.status === "skipped" ? "Пропущено" : "Пропустить"}</Button>
          </div>
          {exercise.status === "skipped" ? <p className="mt-3 rounded-lg border border-amber-300/20 bg-amber-300/5 p-3 text-sm text-amber-100">{exercise.skipReason}</p> : <div className="mt-3 space-y-2">{exercise.sets.map((set) => <SetLogEditor key={set.id} actor={actor} sessionId={sessionId} set={set} onError={onError} />)}</div>}
        </div>
      ))}</div>
    </section>
  ))}</div>;
}

function SetLogEditor({ actor, sessionId, set, onError }: { actor: ClientDemoActor; sessionId: string; set: RuntimeSetLog; onError: (message: string | null) => void }) {
  const runtime = useProductDemoRuntime();
  const plannedReps = typeof set.plan.repetitions === "number" ? set.plan.repetitions : set.plan.repetitions?.min ?? 0;
  const [repetitions, setRepetitions] = useState(String(set.actualRepetitions ?? plannedReps));
  const [weight, setWeight] = useState(String(set.actualWeightKg ?? set.plan.targetWeightKg ?? ""));

  function save() {
    const result = runtime.commands.saveSetLog({ actor, workoutSessionId: sessionId, setLogId: set.id, repetitions: Number(repetitions), weightKg: weight ? Number(weight) : undefined });
    onError(result.ok ? null : result.error.message);
  }

  return (
    <div className="grid min-w-0 grid-cols-[42px_minmax(0,1fr)_minmax(0,1fr)] items-end gap-2 rounded-lg border border-zinc-800 bg-black/30 p-3 sm:grid-cols-[52px_1fr_1fr_120px]">
      <div><p className="text-xs text-zinc-500">Set</p><p className="mt-2 font-medium text-zinc-200">{set.order}{set.kind === "warmup" ? " Р" : ""}</p></div>
      <div><Label htmlFor={`${set.id}-weight`} className="text-xs text-zinc-500">Вес</Label><Input id={`${set.id}-weight`} inputMode="decimal" value={weight} onChange={(event) => setWeight(event.target.value)} className="mt-1 min-w-0 rounded-lg border-zinc-800 bg-zinc-950" /></div>
      <div><Label htmlFor={`${set.id}-reps`} className="text-xs text-zinc-500">Повторы</Label><Input id={`${set.id}-reps`} inputMode="numeric" value={repetitions} onChange={(event) => setRepetitions(event.target.value)} className="mt-1 min-w-0 rounded-lg border-zinc-800 bg-zinc-950" /></div>
      <Button onClick={save} className="col-span-3 rounded-lg sm:col-span-1" variant={set.completed ? "outline" : "default"}>{set.completed ? "Обновить" : "Сохранить"}</Button>
    </div>
  );
}

function CompletionSummary({ session, comment, discomfortText }: { session: NonNullable<ReturnType<typeof getClientWorkoutView>>["session"]; comment: string; discomfortText: string }) {
  if (!session) return null;
  const completedExercises = session.exerciseLogs.filter((exercise) => exercise.status === "completed").length;
  const skipped = session.exerciseLogs.filter((exercise) => exercise.status === "skipped").length;
  const incompleteSets = session.exerciseLogs.flatMap((exercise) => exercise.sets).filter((set) => !set.completed).length;
  const savedSets = session.exerciseLogs.flatMap((exercise) => exercise.sets).filter((set) => set.completed).length;
  return <div className="mt-4 space-y-3 text-sm">
    {savedSets === 0 ? <div className="rounded-lg border border-amber-300/25 bg-amber-300/8 p-3 text-amber-100"><AlertTriangle className="mr-2 inline h-4 w-4" />Нет ни одного сохранённого результата. Завершение всё равно возможно; желательно указать причину в комментарии.</div> : null}
    <dl className="grid grid-cols-2 gap-2"><SummaryValue label="Упражнений выполнено" value={`${completedExercises}/${session.exerciseLogs.length}`} /><SummaryValue label="Пропущено" value={String(skipped)} /><SummaryValue label="Незаполненных подходов" value={String(incompleteSets)} /><SummaryValue label="Сохранённых подходов" value={String(savedSets)} /></dl>
    {comment ? <p className="rounded-lg border border-zinc-800 p-3 text-zinc-300"><strong>Комментарий:</strong> {comment}</p> : null}
    {discomfortText ? <p className="rounded-lg border border-amber-300/20 p-3 text-amber-100"><ShieldAlert className="mr-2 inline h-4 w-4" />{discomfortText}</p> : null}
  </div>;
}

function SummaryValue({ label, value }: { label: string; value: string }) { return <div className="rounded-lg border border-zinc-800 bg-black/20 p-3"><dt className="text-xs text-zinc-500">{label}</dt><dd className="mt-1 font-medium text-zinc-100">{value}</dd></div>; }

function HistoryPanel({ actorId, history, onFeedbackViewed }: { actorId: string; history: NonNullable<ReturnType<typeof getClientHistoryView>>; onFeedbackViewed: (sessionId: string) => void }) {
  if (history.length === 0) return <EmptyWorkout />;
  return <div className="space-y-4">{history.map((item) => (
    <article key={item.id} className="rounded-lg border border-zinc-800 bg-zinc-950/80 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs uppercase text-zinc-500">{historyState(item.state)}</p><h2 className="mt-2 text-xl font-semibold text-zinc-50">{item.assignment.templateTitle}</h2><p className="mt-1 text-sm text-zinc-500">{item.assignment.scheduledDate}</p></div>{item.session?.discomfort ? <span className="inline-flex items-center gap-2 rounded-lg border border-amber-300/20 px-3 py-2 text-xs text-amber-100"><ShieldAlert className="h-4 w-4" />Дискомфорт отмечен</span> : null}</div>
      {item.session ? <p className="mt-3 text-sm text-zinc-400">{item.session.summary.completedSets}/{item.session.summary.totalSets} подходов · {item.session.summary.completedExercises}/{item.session.summary.totalExercises} упражнений</p> : null}
      {item.feedback.map((feedback) => <div key={feedback.id} onFocus={() => item.session && onFeedbackViewed(item.session.session.id)} className="mt-3 rounded-lg border border-lime-300/18 bg-lime-300/[0.05] p-3" tabIndex={0}><p className="text-xs text-lime-200"><MessageSquareText className="mr-1 inline h-4 w-4" />{feedback.kind === "follow-up" ? "Уточнение тренера" : "Отзыв тренера"}</p><p className="mt-2 text-sm leading-6 text-zinc-200">{feedback.body}</p></div>)}
      {item.session ? <Button asChild variant="outline" className="mt-4 rounded-lg"><Link href={`/client/workouts?actor=${encodeURIComponent(actorId)}&session=${encodeURIComponent(item.session.session.id)}&view=history`}>Открыть результат</Link></Button> : null}
    </article>
  ))}</div>;
}

function historyState(state: "scheduled" | "in_progress" | "completed" | "completed_with_omissions" | "feedback_received") { return { scheduled: "Запланирована", in_progress: "В процессе", completed: "Завершена", completed_with_omissions: "Завершена с пропусками", feedback_received: "Получен отзыв" }[state]; }
function EmptyWorkout() { return <section className="rounded-lg border border-dashed border-zinc-800 p-8 text-center"><Dumbbell className="mx-auto h-8 w-8 text-zinc-600" /><h2 className="mt-4 text-xl font-semibold text-zinc-100">Активного назначения нет</h2><p className="mt-2 text-sm text-zinc-500">Фиктивная тренировка не создаётся.</p></section>; }
function SafeWorkoutState({ actorId, title, detail }: { actorId: string; title: string; detail: string }) {
  const knownActor = actorId && actorId !== "unknown-athlete";
  return (
    <main className="flex min-h-dvh items-center justify-center bg-black px-4 text-center text-zinc-100">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="mt-3 max-w-md text-sm text-zinc-400">{detail}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {knownActor ? <Button asChild className="rounded-lg bg-lime-200 text-black hover:bg-lime-100"><Link href={`/client/me?actor=${encodeURIComponent(actorId)}`}>На главную</Link></Button> : null}
          {knownActor ? <Button asChild variant="outline" className="rounded-lg border-zinc-700"><Link href={`/client/workouts?actor=${encodeURIComponent(actorId)}`}>К назначениям</Link></Button> : null}
          {!knownActor ? <Button asChild className="rounded-lg bg-lime-200 text-black hover:bg-lime-100"><Link href="/">К началу</Link></Button> : null}
        </div>
      </div>
    </main>
  );
}
