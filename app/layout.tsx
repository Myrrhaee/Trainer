import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import { Footer } from "@/components/Footer";
import { AppToaster } from "@/components/app-toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ProductDemoRuntimeProvider } from "@/components/trainer-os/demo-runtime/trainer-demo-runtime";
import { DemoResearchBoundary } from "@/components/trainer-os/demo-runtime/demo-research-boundary";

export const metadata: Metadata = {
  title: "Trainer",
  description: "Премиальный тренерский кабинет",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const build = {
    label: "trainer-core-pilot-v1" as const,
    stage: "Stage 14" as const,
    commit: (process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? "local").slice(0, 7),
  };

  return (
    <html lang="ru">
      <body className="min-h-dvh bg-black text-foreground antialiased">
        <TooltipProvider delayDuration={300}>
          <ProductDemoRuntimeProvider build={build}>
            <Suspense fallback={<DemoBootstrapFallback />}>
              <DemoResearchBoundary>
                <AppFrame>{children}</AppFrame>
              </DemoResearchBoundary>
            </Suspense>
          </ProductDemoRuntimeProvider>
        </TooltipProvider>
      </body>
    </html>
  );
}

function DemoBootstrapFallback() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-black px-4 text-zinc-100">
      <p role="status" className="text-sm text-zinc-500">
        Подготовка интерфейса
      </p>
    </main>
  );
}

function AppFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      <Footer />
      <AppToaster />
    </div>
  );
}
