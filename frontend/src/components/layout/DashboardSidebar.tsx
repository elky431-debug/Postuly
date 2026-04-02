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
  GraduationCap,
} from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase";
import { useSelectionStore } from "@/store/selectionStore";
import { PostulyMarkIcon } from "@/components/brand/PostulyLogo";

type DashboardSidebarProps = { user: User };

const MAIN_NAV = [
  { name: "Dashboard",   href: "/dashboard",               icon: LayoutDashboard },
  { name: "Kanban",      href: "/kanban",                  icon: Columns3 },
  { name: "Entreprises", href: "/dashboard/entreprises",   icon: Building2 },
  { name: "Sélections",  href: "/dashboard/selections",    icon: BookmarkCheck },
  { name: "Mon CV",      href: "/cv",                      icon: FileText },
  { name: "Alternance",  href: "/dashboard/alternance",    icon: GraduationCap },
] as const;

const SECONDARY_NAV = [
  { name: "Profil",      href: "/dashboard/profil",        icon: UserRound },
  { name: "Paramètres",  href: "/dashboard/parametres",    icon: Settings },
  { name: "Abonnement",  href: "/dashboard/abonnement",    icon: CreditCard },
] as const;

export function DashboardSidebar({ user }: DashboardSidebarProps) {
  const pathname = usePathname();
  const router   = useRouter();
  const selectionCount = useSelectionStore((s) => s.selection.length);

  void user;

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
  }

  function NavItem({
    name, href, icon: Icon, badge,
  }: { name: string; href: string; icon: React.ElementType; badge?: number | null }) {
    const isActive =
      pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
    return (
      <Link
        href={href}
        className={cn(
          "relative flex items-center gap-3 rounded-xl border-l-[3px] px-3 py-[9px] text-[13.5px] font-medium transition-all no-underline",
          isActive
            ? "border-orange-500 bg-orange-50 text-orange-600"
            : "border-transparent text-stone-500 hover:bg-stone-50 hover:text-stone-800"
        )}
      >
        <div
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors",
            isActive ? "bg-orange-200" : "bg-stone-100/80"
          )}
        >
          <Icon
            className={cn("h-[15px] w-[15px]", isActive ? "text-orange-600" : "text-stone-400")}
            strokeWidth={2}
          />
        </div>
        <span className="flex-1 truncate">{name}</span>
        {badge != null && badge > 0 && (
          <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-orange-500 px-1.5 text-[10px] font-bold text-white">
            {badge}
          </span>
        )}
      </Link>
    );
  }

  return (
    <aside className="flex min-h-screen w-[260px] min-w-[260px] flex-col border-r border-stone-100 bg-white">

      {/* Logo */}
      <div className="flex items-center gap-2.5 border-b border-stone-100 px-6 py-[22px]">
        <PostulyMarkIcon className="h-8 w-8" />
        <span
          className="text-[18px] font-bold lowercase tracking-[-0.01em] text-stone-900"
          style={{ fontFamily: "var(--font-dm-sans)" }}
        >
          postuly
        </span>
      </div>

      {/* Navigation principale */}
      <nav className="flex-1 px-3 pt-6">
        <div className="space-y-[2px]">
          {MAIN_NAV.map(({ name, href, icon }) => (
            <NavItem
              key={name}
              name={name}
              href={href}
              icon={icon}
              badge={name === "Sélections" ? selectionCount : null}
            />
          ))}
        </div>

        <div className="my-5 border-t border-stone-100" />

        <div className="space-y-[2px]">
          {SECONDARY_NAV.map(({ name, href, icon }) => (
            <NavItem key={name} name={name} href={href} icon={icon} />
          ))}
        </div>
      </nav>

      {/* Bas : carte aide + déconnexion */}
      <div className="px-4 pb-6 pt-2">
        <div className="rounded-2xl border border-stone-100 bg-stone-50 p-4">
          <p className="text-[13px] font-semibold text-stone-800">Besoin d'aide ?</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-stone-400">
            Signale un problème ou contacte le support.
          </p>
          <a
            href="mailto:support@postuly.app"
            className="mt-3 flex w-full items-center justify-center rounded-xl bg-orange-500 py-2 text-[12px] font-semibold text-white transition hover:bg-orange-600"
          >
            Contacter
          </a>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="mt-2 flex w-full items-center gap-3 rounded-xl border-l-[3px] border-transparent px-3 py-[9px] text-[13.5px] font-medium text-stone-400 transition hover:bg-red-50 hover:text-red-500"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-stone-100/80">
            <LogOut className="h-[15px] w-[15px] text-stone-400" strokeWidth={2} />
          </div>
          Déconnexion
        </button>
      </div>
    </aside>
  );
}
