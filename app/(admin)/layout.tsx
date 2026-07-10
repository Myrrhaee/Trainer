import { AuthGuard } from "@/lib/auth-context";
import { NavBar } from "@/components/nav-bar";

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <AuthGuard>
      <div className="relative min-h-screen bg-black">
        <NavBar />
        <main>{children}</main>
      </div>
    </AuthGuard>
  );
}
