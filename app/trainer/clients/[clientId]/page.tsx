import { Suspense } from "react";
import { redirect } from "next/navigation";

import { AthleteTrainingHistory } from "@/components/trainer/athlete-training-history";
import { AthleteTrainingHistoryLoading } from "@/components/trainer/athlete-training-tab";
import { CanonicalAthleteProfile } from "@/components/trainer/canonical-athlete-profile";
import type { WorkflowReturnReceiptModel } from "@/components/trainer/workflow-return-receipt";
import { isDemoModeEnabled } from "@/lib/demo-mode";
import { requireCapability } from "@/lib/server/access/access-guard";
import { AthleteProfileQueryService } from "@/lib/server/athlete-profile/athlete-profile-query-service";
import { AthleteTrainingProfileFrameProjector } from "@/lib/server/athlete-profile/athlete-training-profile-frame-projector";
import { AthleteTrainingQueryService } from "@/lib/server/athlete-profile/athlete-training-query-service";
import type { AthleteProfileFrameReadModel, AthleteProfileTab } from "@/lib/server/athlete-profile/athlete-profile-types";
import type { AthleteTrainingViewResult } from "@/lib/server/athlete-profile/athlete-training-types";
import { WorkoutService } from "@/lib/server/workouts/workout-service";
import type { WorkoutAssignment } from "@/lib/server/workouts/workout-types";

type TrainerClientProfileRouteProps = {
  params: Promise<{ clientId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function TrainerClientProfileRoute({ params, searchParams }: TrainerClientProfileRouteProps) {
  const [{ clientId }, query] = await Promise.all([params, searchParams]);
  if (!isDemoModeEnabled()) {
    const { actor } = await requireCapability("trainer", "/trainer/clients");
    if (!isUuid(clientId)) redirect("/trainer/clients");
    const entry = {
      from: firstValue(query.from),
      attentionItem: uuidValue(firstValue(query.attentionItem)),
      entry: firstValue(query.entry),
    };
    const profile = await new AthleteProfileQueryService().find(actor, clientId, entry);
    if (!profile) redirect("/trainer/clients");
    const activeTab = profileTab(firstValue(query.tab));
    let training: AthleteTrainingViewResult | null = null;
    let trainingHistory: React.ReactNode;
    let frame = profile.frame;
    if (activeTab === "training") {
      const service = new AthleteTrainingQueryService();
      const historyState = service.findHistoryPage(actor, clientId, { first: 10 })
        .then((result): AthleteTrainingViewResult["history"] => {
          if (!result || result.status === "unavailable") return { status: "unavailable" };
          return { status: "ready", value: result.page };
        })
        .catch((): AthleteTrainingViewResult["history"] => ({ status: "error" }));
      try {
        const current = await service.findCurrentView(actor, clientId);
        if (!current) redirect("/trainer/clients");
        training = { ...current, history: { status: "error" } };
      } catch {
        training = failedTrainingView(profile.frame);
      }
      if (training.current.status === "ready") {
        frame = new AthleteTrainingProfileFrameProjector().project(
          profile.frame,
          training.current.value,
          training.relation.capabilities,
        );
      }
      trainingHistory = (
        <Suspense fallback={<AthleteTrainingHistoryLoading />}>
          <TrainingHistoryContent
            athleteUserId={clientId}
            state={historyState}
            canReview={training.relation.capabilities.canReview}
            sourceAttentionItemId={profile.frame.entryContext.attention?.id ?? null}
          />
        </Suspense>
      );
    }
    const assignmentReceiptId = firstValue(query.receipt) === "assignment" ? uuidValue(firstValue(query.receiptId)) : undefined;
    const assignmentReceipt = assignmentReceiptId
      ? await new WorkoutService().findTrainerAssignment(actor, assignmentReceiptId)
      : null;
    return (
      <CanonicalAthleteProfile
        frame={frame}
        overview={profile.overview}
        activeTab={activeTab}
        training={training}
        trainingHistory={trainingHistory}
        workflowReceipt={workflowReceiptFrom(query, training, profile.frame, assignmentReceipt)}
        quickAssign={firstValue(query.assign) === "1" ? {
          open: true,
          transitionContext: firstValue(query.flow) ?? "",
          originPhrase: quickAssignOriginPhrase(frame),
        } : null}
      />
    );
  }

  const entry = {
    from: firstValue(query.from),
    attention: firstValue(query.attention),
    attentionItem: firstValue(query.attentionItem),
    entry: firstValue(query.entry),
  };

  const { ClientProfilePage } = await import("@/components/trainer-os/client-profile/client-profile-page");
  return <ClientProfilePage clientId={clientId} entry={entry} initialQuickAssignOpen={firstValue(query.research) === "1" && firstValue(query.quickAssign) === "1"} />;
}

function workflowReceiptFrom(
  query: Record<string, string | string[] | undefined>,
  training: AthleteTrainingViewResult | null,
  frame: AthleteProfileFrameReadModel,
  assignmentReceipt: WorkoutAssignment | null,
): WorkflowReturnReceiptModel | null {
  const receipt = firstValue(query.receipt);
  const receiptId = uuidValue(firstValue(query.receiptId));
  if (!receiptId || !training || training.current.status !== "ready") return null;
  if (receipt === "assignment" && assignmentReceipt?.id === receiptId && assignmentReceipt.athleteUserId === frame.identity.athleteUserId) {
    return {
      id: receiptId,
      title: "Тренировка назначена",
      detail: `${assignmentReceipt.title} · ${assignmentReceipt.scheduledFor}`,
      focusTarget: "next-assignment",
    };
  }
  const feedback = training.feedback.status === "ready" ? training.feedback.value : null;
  if (receipt === "review" && feedback?.feedbackId === receiptId) {
    return {
      id: receiptId,
      title: "Обратная связь сохранена",
      detail: feedback.title,
      focusTarget: "latest-feedback-section",
    };
  }
  if (receipt === "manual-resolution" && frame.entryContext.attention?.id === receiptId && frame.entryContext.attention.status !== "open") {
    return {
      id: receiptId,
      title: "Разбор закрыт без сообщения",
      detail: frame.entryContext.attention.title,
      focusTarget: "workflow-receipt",
    };
  }
  return null;
}

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function quickAssignOriginPhrase(frame: AthleteProfileFrameReadModel) {
  if (frame.entryContext.attention) return frame.entryContext.attention.reason;
  if (frame.entryContext.source === "dashboard") return "Из рабочей очереди тренера";
  if (frame.entryContext.source === "clients") return "Из списка спортсменов";
  if (frame.entryContext.source === "review") return "После разбора тренировки";
  return "Из профиля спортсмена";
}

function profileTab(value: string | undefined): AthleteProfileTab {
  return value === "training" || value === "progress" ? value : "overview";
}

function uuidValue(value: string | undefined) {
  return value && isUuid(value) ? value : undefined;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function failedTrainingView(frame: AthleteProfileFrameReadModel): AthleteTrainingViewResult {
  const active = frame.relation.status === "active";
  return {
    scope: {
      athleteUserId: frame.identity.athleteUserId,
      relationId: frame.relation.id,
      relationStatus: frame.relation.status,
      readAt: new Date().toISOString(),
    },
    relation: {
      status: frame.relation.status,
      capabilities: {
        canReadTraining: active,
        canAssign: active,
        canOpenSession: active,
        canReview: active,
        canSendFeedback: active,
        canResolveAttention: active,
        canOpenAssignment: active,
        canEditSessionFacts: false,
      },
    },
    current: active ? { status: "error" } : { status: "unavailable" },
    feedback: active ? { status: "error" } : { status: "unavailable" },
    history: active ? { status: "error" } : { status: "unavailable" },
  };
}

async function TrainingHistoryContent({
  athleteUserId,
  state,
  canReview,
  sourceAttentionItemId,
}: {
  athleteUserId: string;
  state: Promise<AthleteTrainingViewResult["history"]>;
  canReview: boolean;
  sourceAttentionItemId: string | null;
}) {
  return (
    <AthleteTrainingHistory
      athleteUserId={athleteUserId}
      initialState={await state}
      canReview={canReview}
      sourceAttentionItemId={sourceAttentionItemId}
    />
  );
}
