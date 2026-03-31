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
 * Session en mémoire entre les navigations : évite l’écran plein « chargement »
 * à chaque clic dans la sidebar (chaque page remonte ce layout).
 */
let dashboardUserCache: User | null = null;
let dashboardAuthReady = false;

/**
 * Layout dashboard : sidebar, zone principale fond chaud, police Geist.
 */
export function DashboardLayout({ children }: DashboardLayoutProps) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(() => dashboardUserCache);
  const [loading, setLoading] = useState(() => !dashboardAuthReady);

  useEffect(() => {
    const supabase = createClient();

    /* Cache navigateur → affichage immédiat sans spinner entre les pages */
    if (dashboardAuthReady && dashboardUserCache) {
      setUser(dashboardUserCache);
      setLoading(false);
    } else {
      void supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session?.user) {
          dashboardUserCache = null;
          dashboardAuthReady = true;
          setUser(null);
          setLoading(false);
          router.push("/");
          return;
        }
        dashboardUserCache = session.user;
        dashboardAuthReady = true;
        setUser(session.user);
        setLoading(false);
      });
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        dashboardUserCache = null;
        dashboardAuthReady = false;
        setUser(null);
        router.push("/");
        return;
      }
      dashboardUserCache = session.user;
      dashboardAuthReady = true;
      setUser(session.user);
    });

    return () => subscription.unsubscribe();
  }, [router]);

  /* Premier chargement seulement : pas de flash entre les pages une fois la session connue */
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
