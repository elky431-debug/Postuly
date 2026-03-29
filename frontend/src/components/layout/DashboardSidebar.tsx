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
} from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase";

const ORANGE = "#F97316";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, badge: null as string | null, disabled: false },
  { name: "Kanban", href: "/kanban", icon: Columns3, badge: null, disabled: false },
  {
    name: "Entreprises",
    href: "/dashboard/entreprises",
    icon: Building2,
    badge: null,
    disabled: false,
  },
  { name: "Mon CV", href: "/cv", icon: FileText, badge: null, disabled: false },
];

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
  const email = user.email ?? "";
  const truncatedEmail = email.length > 28 ? `${email.slice(0, 26)}…` : email;

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
  }

  return (
    <aside className="flex min-h-screen w-[220px] min-w-[220px] flex-col border-r border-neutral-200 bg-white">
      <div className="px-4 pb-2 pt-6">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs font-bold text-white"
            style={{ backgroundColor: ORANGE }}
          >
            P
          </div>
          <span className="text-[15px] font-semibold text-neutral-900">Postuly</span>
        </Link>
        <span className="mt-2 inline-block rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-medium text-orange-700">
          Beta
        </span>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 px-2 py-4">
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
                "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] transition-colors",
                item.disabled && "cursor-not-allowed opacity-40",
                !item.disabled &&
                  !isActive &&
                  "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900",
                !item.disabled && isActive && "bg-orange-50 font-medium text-orange-600",
                !item.disabled && !isActive && "text-neutral-600"
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
              {item.badge && (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide",
                    item.badge === "NEW" && "bg-orange-100 text-orange-700",
                    item.badge === "V2" && "bg-neutral-100 text-neutral-500"
                  )}
                >
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-neutral-200 bg-white px-3 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-xs font-semibold text-neutral-700">
            {userInitials(user)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-neutral-900">{userDisplayName(user)}</p>
            <p className="truncate text-[10px] text-neutral-500" title={email}>
              {truncatedEmail}
            </p>
          </div>
          <Link
            href="/settings"
            className="shrink-0 rounded-md p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
            aria-label="Paramètres"
          >
            <Settings className="h-3.5 w-3.5" strokeWidth={2} />
          </Link>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="mt-3 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] text-neutral-500 transition-colors hover:bg-red-50 hover:text-red-600"
        >
          <LogOut className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
          Déconnexion
        </button>
      </div>
    </aside>
  );
}
