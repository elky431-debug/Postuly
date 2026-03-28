"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Rocket,
  Columns3,
  FileText,
  Settings,
  LogOut,
  RefreshCw,
  Briefcase,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";

const ORANGE = "#FE6A2E";
const ORANGE_LIGHT = "#FFF1E3";

const navigation = [
  { name: "Dashboard",  href: "/dashboard",  icon: LayoutDashboard, badge: null },
  { name: "Campagnes",  href: "/campaigns",  icon: Rocket,           badge: null },
  { name: "Kanban",     href: "/kanban",      icon: Columns3,         badge: null },
  { name: "Mon CV",     href: "/cv",          icon: FileText,         badge: null },
  { name: "Relances",   href: "/relances",    icon: RefreshCw,        badge: "Nouveau" },
  { name: "Offres",     href: "/offres",      icon: Briefcase,        badge: "Nouveau" },
  { name: "Entretien",  href: "/entretien",   icon: MessageSquare,    badge: "V2" },
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
    <aside className="flex flex-col w-60 bg-white border-r border-gray-100 min-h-screen">
      {/* Logo */}
      <div className="flex items-center h-16 px-5 border-b border-gray-100">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: ORANGE }}>
            <span className="text-white font-bold text-sm">P</span>
          </div>
          <span className="text-lg font-bold text-gray-900 tracking-tight">Postuly</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-5 space-y-0.5">
        {navigation.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
          const isV2 = item.badge === "V2";

          return (
            <Link
              key={item.name}
              href={isV2 ? "#" : item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "text-white"
                  : isV2
                  ? "text-gray-300 cursor-not-allowed"
                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
              )}
              style={isActive ? { backgroundColor: ORANGE } : {}}
              onClick={isV2 ? (e) => e.preventDefault() : undefined}
            >
              <item.icon className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1">{item.name}</span>
              {item.badge && (
                <span
                  className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md"
                  style={
                    isActive
                      ? { backgroundColor: "rgba(255,255,255,0.25)", color: "white" }
                      : isV2
                      ? { backgroundColor: "#f3f4f6", color: "#9ca3af" }
                      : { backgroundColor: ORANGE_LIGHT, color: ORANGE }
                  }
                >
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-gray-100 space-y-0.5">
        <Link
          href="/settings"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-colors"
        >
          <Settings className="w-4 h-4" />
          Paramètres
        </Link>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-500 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Déconnexion
        </button>
      </div>
    </aside>
  );
}
