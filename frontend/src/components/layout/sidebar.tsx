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
  UserRound,
  CreditCard,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase";
import { PostulyWordmark } from "@/components/brand/PostulyLogo";
const BORDER = "#E7E5E4";

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
  { name: "Profil", href: "/dashboard/profil", icon: UserRound, badge: null, disabled: false },
  { name: "Paramètres", href: "/dashboard/parametres", icon: Settings, badge: null, disabled: false },
  { name: "Abonnement", href: "/dashboard/abonnement", icon: CreditCard, badge: null, disabled: false },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
  }

  return (
    <aside
      className="flex min-h-screen w-60 flex-col border-r bg-white"
      style={{ borderColor: BORDER }}
    >
      <div className="flex h-16 items-center border-b px-5" style={{ borderColor: BORDER }}>
        <Link href="/dashboard" className="block min-w-0">
          <PostulyWordmark size="md" />
        </Link>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 px-2 py-5">
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
                "flex w-full min-w-0 items-center gap-3 rounded-lg px-3 py-2.5 text-[14px] transition-colors",
                item.disabled && "cursor-not-allowed opacity-50",
                !item.disabled && !isActive && "text-stone-600 hover:bg-stone-50",
                isActive && !item.disabled && "bg-orange-50 font-medium text-orange-600"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
              <span className="flex-1">{item.name}</span>
              {item.badge && (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                    item.badge === "Nouveau" && "bg-orange-100 text-orange-700",
                    item.badge === "V2" && "bg-stone-100 text-stone-500"
                  )}
                >
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="flex flex-col gap-0.5 border-t px-2 py-4" style={{ borderColor: BORDER }}>
        <Link
          href="/dashboard/parametres"
          className="flex w-full min-w-0 items-center gap-3 rounded-lg px-3 py-2.5 text-[14px] text-stone-600 transition-colors hover:bg-stone-50"
        >
          <Settings className="h-4 w-4 shrink-0" strokeWidth={2} />
          Paramètres
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full min-w-0 items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[14px] text-stone-600 transition-colors hover:bg-red-50 hover:text-red-600"
        >
          <LogOut className="h-4 w-4 shrink-0" strokeWidth={2} />
          Déconnexion
        </button>
      </div>
    </aside>
  );
}
