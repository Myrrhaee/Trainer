import { CanonicalTrainerDashboard } from "@/components/trainer/canonical-trainer-dashboard";
import { TrainerHomePage } from "@/components/trainer-os/home/trainer-home-page";
import { isDemoModeEnabled } from "@/lib/demo-mode";

type TrainerDashboardPageProps = {
  searchParams: Promise<{ demo?: string }>;
};

export default async function TrainerDashboardPage({ searchParams }: TrainerDashboardPageProps) {
  if (!isDemoModeEnabled()) return <CanonicalTrainerDashboard />;

  const { demo } = await searchParams;
  const demoMode = demo === "empty" || demo === "calm" || demo === "large" ? demo : "team";

  return <TrainerHomePage key={demoMode} demoMode={demoMode} />;
}
