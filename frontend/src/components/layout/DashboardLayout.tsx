"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GeistSans } from "geist/font/sans";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase";
import { DashboardSidebar } from "./DashboardSidebar";

type DashboardLayoutProps = {
  children: React.ReactNode;
};

/**
 * Layout dashboard : sidebar, zone principale fond chaud, police Geist.
 */
export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/");
        return;
      }
      setUser(user);
      setLoading(false);
    }

    void load();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.push("/");
      else setUser(session.user);
    });

    return () => subscription.unsubscribe();
  }, [router]);

  if (loading || !user) {
    return (
      <div
        className={`flex min-h-screen items-center justify-center bg-stone-50 ${GeistSans.className}`}
      >
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-200 border-t-[#F97316]"
          aria-hidden
        />
      </div>
    );
  }

  return (
    <div
      className={`${GeistSans.className} dashboard-root relative flex min-h-screen bg-stone-50`}
      data-dashboard
    >
      <div className="relative z-10 flex min-h-screen w-full">
        <DashboardSidebar user={user} />
        <main className="relative z-10 min-h-0 flex-1 overflow-auto bg-stone-50 text-stone-900">
          {children}
        </main>
      </div>
    </div>
  );
}
