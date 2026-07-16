import { TrainerHomePage } from "@/components/trainer-os/home/trainer-home-page";

type TrainerDashboardPageProps = {
  searchParams: Promise<{ demo?: string }>;
};

export default async function TrainerDashboardPage({ searchParams }: TrainerDashboardPageProps) {
  const { demo } = await searchParams;
  const demoMode = demo === "empty" || demo === "calm" || demo === "large" ? demo : "team";

  return <TrainerHomePage key={demoMode} demoMode={demoMode} />;
}
