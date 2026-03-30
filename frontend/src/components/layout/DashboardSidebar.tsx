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
} from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase";
import { useSelectionStore } from "@/store/selectionStore";

const ORANGE = "#F97316";

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
 * Sidebar dashboard — fond blanc, bordures neutres, accent orange.
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
  ];
  const email = user.email ?? "";
  const truncatedEmail = email.length > 28 ? `${email.slice(0, 26)}…` : email;

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
  }

  return (
    <aside className="flex min-h-screen w-[244px] min-w-[244px] flex-col border-r border-stone-200/90 bg-white shadow-[1px_0_0_rgba(15,23,42,0.04)]">
      <div className="border-b border-stone-100 px-5 pb-4 pt-7">
        <Link href="/dashboard" className="flex items-center gap-3 transition-opacity hover:opacity-90">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white shadow-md shadow-orange-500/25"
            style={{ backgroundColor: ORANGE }}
          >
            P
          </div>
          <div className="flex flex-col">
            <span className="text-[15px] font-semibold tracking-tight text-stone-900">Postuly</span>
            <span className="mt-1 inline-flex w-fit items-center rounded-full bg-orange-50 px-2 py-px text-[10px] font-semibold uppercase tracking-wide text-orange-700 ring-1 ring-orange-200/60">
              Beta
            </span>
          </div>
        </Link>
      </div>

      <nav className="flex w-full min-w-0 flex-1 flex-col gap-1 px-2.5 py-5">
        {navigation.map((item) => {
          const isActive =
            pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              href={item.disabled ? "#" : item.href}
              onClick={(e) => {
                if (item.disabled) e.preventDefault();
              }}
              className={cn(
                "block w-full min-w-0 rounded-xl border-l-[3px] text-[13px] no-underline transition-all duration-200",
                item.disabled && "cursor-not-allowed opacity-40",
                !item.disabled &&
                  !isActive &&
                  "border-transparent text-stone-600 hover:bg-stone-50 hover:text-stone-900",
                !item.disabled &&
                  isActive &&
                  "border-orange-500 bg-gradient-to-r from-orange-50 to-orange-50/30 font-semibold text-orange-700 shadow-sm shadow-orange-500/5",
                !item.disabled && !isActive && "text-stone-600"
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0",
                  isActive && !item.disabled ? "text-orange-600" : "text-neutral-400"
                )}
                strokeWidth={2}
                aria-hidden
              />
              <span className="flex-1 truncate">{item.name}</span>
              {item.badge !== null && (
                <span className="flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-bold text-white">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-stone-100 bg-stone-50/50 px-3 py-4">
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
