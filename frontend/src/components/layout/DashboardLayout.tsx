"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { GeistSans } from "geist/font/sans";
import { Bell, ChevronDown, Search } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase";
import { useSelectionStore } from "@/store/selectionStore";
import { DashboardSidebar } from "./DashboardSidebar";

// ─── Page titles ──────────────────────────────────────────────────────────────
const PAGE_TITLES: Record<string, string> = {
  "/dashboard":                  "Dashboard",
  "/kanban":                     "Kanban",
  "/dashboard/entreprises":      "Entreprises",
  "/dashboard/selections":       "Sélections",
  "/cv":                         "Mon CV",
  "/dashboard/profil":           "Profil",
  "/dashboard/parametres":       "Paramètres",
  "/dashboard/abonnement":       "Abonnement",
};

function getPageTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  for (const [key, label] of Object.entries(PAGE_TITLES)) {
    if (pathname.startsWith(key) && key !== "/dashboard") return label;
  }
  return "Dashboard";
}

function userDisplayName(user: User): string {
  const meta = user.user_metadata as { full_name?: string } | undefined;
  if (meta?.full_name?.trim()) return meta.full_name.trim().split(" ")[0];
  return user.email?.split("@")[0] ?? "Compte";
}

function userInitials(user: User): string {
  const meta = user.user_metadata as { full_name?: string } | undefined;
  if (meta?.full_name?.trim()) {
    const parts = meta.full_name.trim().split(/\s+/);
    return (((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase()) || (parts[0]?.[0]?.toUpperCase() ?? "?");
  }
  return (user.email ?? "?").slice(0, 2).toUpperCase();
}

// ─── Top bar ──────────────────────────────────────────────────────────────────
function TopBar({ user }: { user: User }) {
  const pathname = usePathname();
  const selectionCount = useSelectionStore((s) => s.selection.length);
  const title = getPageTitle(pathname);

  return (
    <header className="flex h-[64px] shrink-0 items-center justify-between border-b border-stone-200/70 bg-white px-6">
      {/* Page title */}
      <h1
        className="text-[17px] font-bold tracking-[-0.02em] text-stone-900"
      >
        {title}
      </h1>

      {/* Search */}
      <div className="mx-6 hidden max-w-sm flex-1 lg:flex">
        <div className="flex w-full items-center gap-2.5 rounded-xl bg-stone-50 px-3.5 py-2 ring-1 ring-stone-200/60">
          <Search className="h-3.5 w-3.5 shrink-0 text-stone-400" strokeWidth={2} />
          <span className="text-[13px] text-stone-400">Rechercher…</span>
        </div>
      </div>

      {/* Right: notif + user */}
      <div className="flex items-center gap-3">
        {/* Notification bell */}
        <Link
          href="/dashboard/selections"
          className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-stone-50 text-stone-500 ring-1 ring-stone-200/60 transition hover:bg-stone-100"
          aria-label="Ma sélection"
        >
          <Bell className="h-4 w-4" strokeWidth={2} />
          {selectionCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-orange-500 px-1 text-[9px] font-bold text-white">
              {selectionCount}
            </span>
          )}
        </Link>

        {/* User */}
        <Link
          href="/dashboard/profil"
          className="flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 transition hover:bg-stone-50"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-100 text-[11px] font-bold text-orange-600 ring-1 ring-orange-200/60">
            {userInitials(user)}
          </div>
          <span className="hidden text-[13px] font-semibold text-stone-700 sm:block">
            {userDisplayName(user)}
          </span>
          <ChevronDown className="hidden h-3 w-3 text-stone-400 sm:block" strokeWidth={2} />
        </Link>
      </div>
    </header>
  );
}

// ─── Session cache ────────────────────────────────────────────────────────────
let dashboardUserCache: User | null = null;
let dashboardAuthReady = false;

// ─── Layout ───────────────────────────────────────────────────────────────────
type DashboardLayoutProps = { children: React.ReactNode };

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(() => dashboardUserCache);
  const [loading, setLoading] = useState(() => !dashboardAuthReady);

  useEffect(() => {
    const supabase = createClient();
    if (dashboardAuthReady && dashboardUserCache) {
      setUser(dashboardUserCache);
      setLoading(false);
    } else {
      void supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session?.user) {
          dashboardUserCache = null; dashboardAuthReady = true;
          setUser(null); setLoading(false);
          router.push("/");
          return;
        }
        dashboardUserCache = session.user; dashboardAuthReady = true;
        setUser(session.user); setLoading(false);
      });
    }
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        dashboardUserCache = null; dashboardAuthReady = false;
        setUser(null); router.push("/");
        return;
      }
      dashboardUserCache = session.user; dashboardAuthReady = true;
      setUser(session.user);
    });
    return () => subscription.unsubscribe();
  }, [router]);

  if (loading || !user) {
    return (
      <div className={`flex min-h-screen items-center justify-center bg-stone-50 ${GeistSans.className}`}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-200 border-t-[#F97316]" aria-hidden />
      </div>
    );
  }

  return (
    <div className={`${GeistSans.className} flex min-h-screen bg-[#F5F5F3]`}>
      <DashboardSidebar user={user} />
      <div className="flex min-h-screen flex-1 flex-col overflow-hidden">
        <TopBar user={user} />
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
