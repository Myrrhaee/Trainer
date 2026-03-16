export default function ClientLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <main className="min-h-screen bg-black px-4 py-6 md:px-6 md:py-8">
      {children}
    </main>
  );
}
