import type { Metadata } from "next";
import "./globals.css";
import { Footer } from "@/components/Footer";
import { AppToaster } from "@/components/app-toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ProductDemoRuntimeProvider } from "@/components/trainer-os/demo-runtime/trainer-demo-runtime";

export const metadata: Metadata = {
  title: "Trainer",
  description: "Премиальный тренерский кабинет",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className="min-h-dvh bg-black text-foreground antialiased">
        <TooltipProvider delayDuration={300}>
          <ProductDemoRuntimeProvider>
            <div className="flex min-h-dvh flex-col">
              <div className="flex min-h-0 flex-1 flex-col">{children}</div>
              <Footer />
              <AppToaster />
            </div>
          </ProductDemoRuntimeProvider>
        </TooltipProvider>
      </body>
    </html>
  );
}
