import { AccessOnboarding } from "@/components/auth/access-onboarding";

export const dynamic = "force-dynamic";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>;
}) {
  const { invite } = await searchParams;
  return <AccessOnboarding invitationToken={invite?.trim() || null} />;
}
