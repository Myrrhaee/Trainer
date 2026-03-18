import { ClientNav } from "@/components/client-nav";

export default function ClientLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <ClientNav />
      <main className="min-h-screen bg-black px-4 py-6 md:px-6 md:py-8">
        {children}
      </main>
    </>
  );
}
