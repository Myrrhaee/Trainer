import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Footer } from "@/components/Footer";
import { AppToaster } from "@/components/app-toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
});

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
      <body className={`${inter.className} flex min-h-screen flex-col antialiased bg-black text-foreground`}>
        <TooltipProvider delayDuration={300}>
          <div className="flex-1">{children}</div>
          <Footer />
          <AppToaster />
        </TooltipProvider>
      </body>
    </html>
  );
}

