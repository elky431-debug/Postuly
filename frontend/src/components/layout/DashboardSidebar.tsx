"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Columns3,
  FileText,
  Settings,
  LogOut,
  Building2,
  BookmarkCheck,
  UserRound,
  CreditCard,
  RefreshCw,
} from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase";
import { useSelectionStore } from "@/store/selectionStore";
import { PostulyMarkIcon } from "@/components/brand/PostulyLogo";

function userDisplayName(user: User): string {
  const meta = user.user_metadata as { full_name?: string } | undefined;
  if (meta?.full_name?.trim()) return meta.full_name.trim();
  return user.email?.split("@")[0] ?? "Compte";
}

function userInitials(user: User): string {
  const meta = user.user_metadata as { full_name?: string } | undefined;
  if (meta?.full_name?.trim()) {
    const parts = meta.full_name.trim().split(/\s+/);
    const a = parts[0]?.[0] ?? "";
    const b = parts[1]?.[0] ?? "";
    return (a + b).toUpperCase() || a.toUpperCase();
  }
  const em = user.email ?? "?";
  return em.slice(0, 2).toUpperCase();
}

type DashboardSidebarProps = { user: User };

const MAIN_NAV = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Kanban", href: "/kanban", icon: Columns3 },
  { name: "Entreprises", href: "/dashboard/entreprises", icon: Building2 },
  { name: "Sélections", href: "/dashboard/selections", icon: BookmarkCheck },
  { name: "Mon CV", href: "/cv", icon: FileText },
] as const;

const ACCOUNT_NAV = [
  { name: "Profil", href: "/dashboard/profil", icon: UserRound },
  { name: "Paramètres", href: "/dashboard/parametres", icon: Settings },
  { name: "Abonnement", href: "/dashboard/abonnement", icon: CreditCard },
] as const;

export function DashboardSidebar({ user }: DashboardSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const selectionCount = useSelectionStore((s) => s.selection.length);
  const email = user.email ?? "";
  const truncatedEmail = email.length > 26 ? `${email.slice(0, 24)}…` : email;

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
  }

  return (
    <aside className="flex min-h-screen w-[220px] min-w-[220px] flex-col bg-[#0f0f0f]">
      {/* ── Logo ─────────────────────────────────────────── */}
      <div className="border-b border-white/[0.05] px-4 py-[18px]">
        <Link
          href="/dashboard"
          className="flex items-center gap-1.5 no-underline transition-opacity hover:opacity-80"
        >
          <PostulyMarkIcon className="h-[26px] w-[26px]" />
          <span
            className="text-[17px] font-bold lowercase tracking-[-0.02em] text-white"
            style={{ fontFamily: "var(--font-dm-sans)" }}
          >
            postuly
          </span>
          <span className="ml-0.5 rounded-full bg-orange-500/15 px-2 py-[2px] text-[9px] font-bold uppercase tracking-[0.12em] text-orange-400">
            Beta
          </span>
        </Link>
      </div>

      {/* ── Navigation ───────────────────────────────────── */}
      <nav className="flex min-h-0 flex-1 flex-col px-2.5 py-4">
        {/* Section principale */}
        <p className="mb-2 px-2 text-[9px] font-bold uppercase tracking-[0.16em] text-white/20">
          Principal
        </p>
        <div className="space-y-px">
          {MAIN_NAV.map(({ name, href, icon: Icon }) => {
            const isActive =
              pathname === href ||
              (href !== "/dashboard" && pathname.startsWith(href));
            const badge = name === "Sélections" && selectionCount > 0 ? selectionCount : null;

            return (
              <Link
                key={name}
                href={href}
                className={cn(
                  "relative flex items-center gap-2.5 rounded-lg px-3 py-[9px] text-[13px] font-medium transition-all duration-150 no-underline",
                  isActive
                    ? "bg-white/[0.08] text-white"
                    : "text-white/40 hover:bg-white/[0.04] hover:text-white/70"
                )}
              >
                {/* Left indicator bar */}
                {isActive && (
                  <span className="absolute left-0 top-1/2 h-[18px] w-[3px] -translate-y-1/2 rounded-r-full bg-orange-500" />
                )}
                <Icon
                  className={cn(
                    "h-[15px] w-[15px] shrink-0 transition-colors",
                    isActive ? "text-orange-400" : "text-white/25"
                  )}
                  strokeWidth={2}
                />
                <span className="flex-1 truncate">{name}</span>
                {badge !== null && (
                  <span
                    className={cn(
                      "flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold tabular-nums",
                      isActive
                        ? "bg-orange-500/25 text-orange-300"
                        : "bg-orange-500 text-white"
                    )}
                  >
                    {badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        {/* Section compte */}
        <p className="mb-2 mt-6 px-2 text-[9px] font-bold uppercase tracking-[0.16em] text-white/20">
          Compte
        </p>
        <div className="space-y-px">
          {ACCOUNT_NAV.map(({ name, href, icon: Icon }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={name}
                href={href}
                className={cn(
                  "relative flex items-center gap-2.5 rounded-lg px-3 py-[8px] text-[13px] font-medium transition-all duration-150 no-underline",
                  isActive
                    ? "bg-white/[0.06] text-white"
                    : "text-white/30 hover:bg-white/[0.03] hover:text-white/60"
                )}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 h-[16px] w-[3px] -translate-y-1/2 rounded-r-full bg-orange-500" />
                )}
                <Icon
                  className={cn(
                    "h-[14px] w-[14px] shrink-0",
                    isActive ? "text-orange-400" : "text-white/20"
                  )}
                  strokeWidth={2}
                />
                <span className="flex-1 truncate">{name}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* ── User block ───────────────────────────────────── */}
      <div className="border-t border-white/[0.05] px-2.5 py-3">
        <div className="flex items-center gap-2.5 rounded-lg px-2 py-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-500/15 text-[11px] font-bold text-orange-400 ring-1 ring-orange-500/20">
            {userInitials(user)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-semibold text-white/75">
              {userDisplayName(user)}
            </p>
            <p className="truncate text-[10px] text-white/30" title={email}>
              {truncatedEmail}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="mt-0.5 flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-[12px] font-medium text-white/25 transition-colors hover:bg-red-500/10 hover:text-red-400"
        >
          <LogOut className="h-3 w-3 shrink-0" strokeWidth={2} />
          Déconnexion
        </button>
      </div>
    </aside>
  );
}
