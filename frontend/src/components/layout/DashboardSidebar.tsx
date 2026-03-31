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
} from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase";
import { useSelectionStore } from "@/store/selectionStore";
import { PostulyWordmark } from "@/components/brand/PostulyLogo";

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

type DashboardSidebarProps = {
  user: User;
};

/**
 * Sidebar dashboard — fond blanc, onglet actif en bloc orange arrondi (texte/icônes blancs).
 */
export function DashboardSidebar({ user }: DashboardSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const selectionCount = useSelectionStore((s) => s.selection.length);

  const navigation = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, badge: null as number | null, disabled: false },
    { name: "Kanban", href: "/kanban", icon: Columns3, badge: null, disabled: false },
    { name: "Entreprises", href: "/dashboard/entreprises", icon: Building2, badge: null, disabled: false },
    {
      name: "Sélections",
      href: "/dashboard/selections",
      icon: BookmarkCheck,
      badge: selectionCount > 0 ? selectionCount : null,
      disabled: false,
    },
    { name: "Mon CV", href: "/cv", icon: FileText, badge: null, disabled: false },
    { name: "Profil", href: "/dashboard/profil", icon: UserRound, badge: null, disabled: false },
    { name: "Paramètres", href: "/dashboard/parametres", icon: Settings, badge: null, disabled: false },
    { name: "Abonnement", href: "/dashboard/abonnement", icon: CreditCard, badge: null, disabled: false },
  ];
  const email = user.email ?? "";
  const truncatedEmail = email.length > 28 ? `${email.slice(0, 26)}…` : email;

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
  }

  return (
    <aside className="flex min-h-screen w-[260px] min-w-[260px] flex-col border-r border-stone-200/80 bg-white">
      <div className="shrink-0 border-b border-stone-100 bg-white px-5 pb-4 pt-7">
        <Link
          href="/dashboard"
          prefetch
          className="block min-w-0 transition-opacity hover:opacity-90"
        >
          <PostulyWordmark size="md" showBeta />
        </Link>
      </div>

      {/* Fond blanc ; onglet actif = pastille orange pleine largeur (type ref. cyan → orange) */}
      <nav className="flex min-h-0 min-w-0 flex-1 flex-col bg-white px-2 py-3">
        <div className="flex min-h-0 flex-1 flex-col justify-start gap-1">
          {navigation.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));
            const Icon = item.icon;

            return (
              <Link
                key={item.name}
                href={item.disabled ? "#" : item.href}
                prefetch={!item.disabled}
                onClick={(e) => {
                  if (item.disabled) e.preventDefault();
                }}
                className={cn(
                  "flex w-full min-w-0 items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] no-underline transition-all duration-150",
                  item.disabled && "cursor-not-allowed opacity-40",
                  !item.disabled &&
                    !isActive &&
                    "text-stone-700 hover:bg-stone-50 hover:text-stone-900",
                  !item.disabled &&
                    isActive &&
                    "bg-gradient-to-r from-[#FE6A2E] to-[#FF8A3D] font-semibold text-white shadow-md shadow-orange-500/35",
                  !item.disabled && !isActive && "text-stone-700"
                )}
              >
                <Icon
                  className={cn(
                    "h-[18px] w-[18px] shrink-0",
                    isActive && !item.disabled ? "text-white" : "text-stone-400"
                  )}
                  strokeWidth={2}
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate">{item.name}</span>
                {item.badge !== null && (
                  <span
                    className={cn(
                      "inline-flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded-full px-1.5 text-[10px] font-bold leading-none tabular-nums",
                      isActive
                        ? "bg-white/25 text-white ring-1 ring-white/30"
                        : "bg-orange-500 text-white"
                    )}
                    aria-hidden
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="shrink-0 border-t border-stone-100 bg-white px-3 py-4">
        <div className="flex items-center gap-3 rounded-xl border border-stone-200/80 bg-white p-2.5 shadow-sm">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-stone-100 to-stone-200/80 text-xs font-bold text-stone-700 ring-2 ring-white">
            {userInitials(user)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-stone-900">{userDisplayName(user)}</p>
            <p className="truncate text-[10px] text-stone-500" title={email}>
              {truncatedEmail}
            </p>
          </div>
          <Link
            href="/dashboard/parametres"
            className="shrink-0 rounded-lg p-2 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700"
            aria-label="Paramètres"
          >
            <Settings className="h-4 w-4" strokeWidth={2} />
          </Link>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="mt-3 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[12px] font-medium text-stone-500 transition-colors hover:bg-red-50 hover:text-red-600"
        >
          <LogOut className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
          Déconnexion
        </button>
      </div>
    </aside>
  );
}
