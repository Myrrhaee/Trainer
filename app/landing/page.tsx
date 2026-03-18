import { BackgroundFluid } from "@/components/BackgroundFluid";
import { LandingPage } from "@/components/landing/landing-page";

export default function LandingRoute() {
  return (
    <>
      <BackgroundFluid opacity={0.34} />
      <div className="relative z-10">
        <LandingPage />
      </div>
    </>
  );
}
