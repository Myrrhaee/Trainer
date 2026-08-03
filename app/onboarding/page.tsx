import { AccessOnboarding } from "@/components/auth/access-onboarding";
import { resolveRequestActor } from "@/lib/server/auth/actor";

export const dynamic = "force-dynamic";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>;
}) {
  const [{ invite }, actor] = await Promise.all([searchParams, resolveRequestActor()]);
  return <AccessOnboarding invitationToken={invite?.trim() || null} initiallyAuthenticated={Boolean(actor)} />;
}
