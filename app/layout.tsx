import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
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
      <body className={`${inter.className} antialiased bg-black text-foreground`}>
        <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
      </body>
    </html>
  );
}

