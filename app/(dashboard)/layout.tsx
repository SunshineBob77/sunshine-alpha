"use client";

import { useAuthUser } from "@/app/lib/useAuthUser";
import AuthForm from "@/app/components/AuthForm";
import { DashboardProvider } from "@/app/lib/DashboardContext";
import BottomNav from "@/app/components/BottomNav";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthUser();

  if (loading) {
    return (
      <main className="min-h-dvh bg-gradient-to-b from-amber-50 via-orange-50/50 to-white" />
    );
  }

  if (!user) {
    return <AuthForm />;
  }

  return (
    <DashboardProvider user={user}>
      <div className="min-h-dvh bg-gradient-to-b from-amber-50 via-orange-50/50 to-white pb-28">
        {children}
      </div>
      <BottomNav />
    </DashboardProvider>
  );
}
