import { AuthGuard } from "@/lib/auth-context";
import { NavBar } from "@/components/nav-bar";
import { SubscriptionGuard } from "@/components/subscription-guard";

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <AuthGuard>
      <SubscriptionGuard>
        <div className="relative min-h-screen bg-black">
          <NavBar />
          <main>{children}</main>
        </div>
      </SubscriptionGuard>
    </AuthGuard>
  );
}
