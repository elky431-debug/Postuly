"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  BarChart3,
  BookOpen,
  CalendarCheck,
  Mail,
  Plus,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { CampaignChart } from "@/components/dashboard/CampaignChart";
import { CampaignTable } from "@/components/dashboard/CampaignTable";
import { DashboardCvCard } from "@/components/dashboard/DashboardCvCard";
import { QuickActionsGrid } from "@/components/dashboard/QuickActionsGrid";
import type { QuickActionItem } from "@/components/dashboard/QuickActionsGrid";
import { QuickStart } from "@/components/dashboard/QuickStart";
import { StatCard } from "@/components/dashboard/StatCard";
import { api, apiUpload } from "@/lib/api";
import { createClient } from "@/lib/supabase";
import type { Application, Campaign, Profile } from "@/lib/types";
import { cn } from "@/lib/utils";

const ORANGE = "#F97316";
const ORANGE_HOVER = "#EA6C0A";

/** Jours courts (getDay : 0 = dim) */
const FR_DOW = ["D", "L", "M", "M", "J", "V", "S"] as const;

const sectionMotion = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" as const } },
};

const staggerParent = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};

function startOfIsoWeek(d: Date): Date {
  const x = new Date(d);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

function countSentThisWeek(apps: Application[]): number {
  const start = startOfIsoWeek(new Date());
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return apps.filter((a) => {
    if (!a.sent_at) return false;
    const t = new Date(a.sent_at);
    return t >= start && t < end;
  }).length;
}

function last7DaysSeries(apps: Application[]): { labels: string[]; values: number[] } {
  const values: number[] = [];
  const labels: string[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 6; i >= 0; i--) {
    const day = new Date(today);
    day.setDate(today.getDate() - i);
    const next = new Date(day);
    next.setDate(day.getDate() + 1);
    const c = apps.filter(
      (a) => a.sent_at && new Date(a.sent_at) >= day && new Date(a.sent_at) < next
    ).length;
    values.push(c);
    labels.push(FR_DOW[day.getDay()]);
  }
  return { labels, values };
}

function last4WeeksSeries(apps: Application[]): { values: number[] } {
  const counts = [0, 0, 0, 0];
  const endAnchor = new Date();
  endAnchor.setHours(23, 59, 59, 999);
  for (let w = 0; w < 4; w++) {
    const end = new Date(endAnchor);
    end.setDate(endAnchor.getDate() - w * 7);
    const start = new Date(end);
    start.setDate(end.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    counts[3 - w] = apps.filter((a) => {
      if (!a.sent_at) return false;
      const t = new Date(a.sent_at);
      return t >= start && t <= end;
    }).length;
  }
  return { values: counts };
}

export default function DashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [allApps, setAllApps] = useState<Application[]>([]);
  const [recentApps, setRecentApps] = useState<Application[]>([]);
  const [stats, setStats] = useState({ total: 0, sent: 0, replied: 0, interviews: 0 });
  const [uploading, setUploading] = useState(false);
  const [token, setToken] = useState("");
  const [userName, setUserName] = useState("");
  const [done, setDone] = useState<boolean[]>([false, false, false]);
  const [chartPeriod, setChartPeriod] = useState<"7j" | "30j">("7j");

  const loadData = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;
    setToken(session.access_token);
    const raw =
      (session.user.user_metadata?.full_name as string | undefined) ||
      session.user.email?.split("@")[0] ||
      "";
    setUserName(raw.split(" ")[0] ?? "");
    try {
      const [p, c, a] = await Promise.all([
        api<Profile>("/api/profiles/me", { token: session.access_token }),
        api<Campaign[]>("/api/campaigns/", { token: session.access_token }),
        api<Application[]>("/api/applications/", { token: session.access_token }),
      ]);
      setProfile(p);
      setCampaigns(c);
      setAllApps(a);
      setRecentApps(a.slice(0, 5));
      const s = {
        total: a.length,
        sent: a.filter((x) => x.status === "sent").length,
        replied: a.filter((x) => ["replied", "interview", "offer"].includes(x.status)).length,
        interviews: a.filter((x) => x.status === "interview").length,
      };
      setStats(s);
      setDone([!!p?.cv_url, c.length > 0, s.sent > 0]);
    } catch {
      /* backend hors ligne */
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleCvUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await apiUpload<{ cv_url: string; score: number }>("/api/cv/upload", fd, token);
      setProfile((prev) => (prev ? { ...prev, cv_url: r.cv_url, cv_score: r.score } : prev));
      setDone((prev) => {
        const n = [...prev];
        n[0] = true;
        return n;
      });
    } catch {
      /* silencieux */
    }
    setUploading(false);
  }

  const responseRate = stats.sent > 0 ? Math.round((stats.replied / stats.sent) * 100) : 0;
  const todayLabel = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const todayPretty = todayLabel.charAt(0).toUpperCase() + todayLabel.slice(1);
  const sentThisWeek = useMemo(() => countSentThisWeek(allApps), [allApps]);

  const chart7 = useMemo(() => last7DaysSeries(allApps), [allApps]);
  const chart30 = useMemo(() => last4WeeksSeries(allApps), [allApps]);
  const chartValues = chartPeriod === "7j" ? chart7.values : chart30.values;
  const chartLabels = chartPeriod === "7j" ? chart7.labels : undefined;
  const chartSum = chartValues.reduce((a, b) => a + b, 0);

  const quickActions: QuickActionItem[] = [
    { Icon: RefreshCw, label: "Activer relances auto", sub: "J+5 si pas de réponse", href: "/relances" },
    { Icon: Sparkles, label: "Générer une lettre IA", sub: "Personnalisée par entreprise", href: "/campaigns/new" },
    { Icon: Search, label: "Chercher des offres", sub: "France Travail + SIRENE", href: "/offres" },
    { Icon: BarChart3, label: "Voir rapport hebdo", sub: "Stats de la semaine", href: "/dashboard" },
  ];

  const steps = [
    { label: "Uploader ton CV", desc: "Analyse ATS automatique · score instantané", href: "/cv" },
    { label: "Créer ta première campagne", desc: "Définis le poste, la zone et le contrat", href: "/campaigns/new" },
    {
      label: "Envoyer tes premières candidatures",
      desc: "L'IA rédige et envoie depuis ton Gmail",
      href: "/campaigns",
    },
  ];

  return (
    <AppLayout>
      <motion.div
        className="min-h-0 font-[family-name:var(--font-dm-sans)] text-[#1C1917]"
        variants={staggerParent}
        initial="hidden"
        animate="show"
      >
        <motion.header variants={sectionMotion} className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-[#1C1917]">
              Bonjour{userName ? `, ${userName}` : ""}
            </h1>
            <p className="mt-1 text-sm leading-relaxed text-[#78716C]">
              {todayPretty} · {sentThisWeek} candidature{sentThisWeek !== 1 ? "s" : ""} envoyée
              {sentThisWeek !== 1 ? "s" : ""} cette semaine
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="#"
              className="inline-flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-3.5 py-2 text-sm font-medium text-stone-600 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-colors hover:bg-stone-50"
            >
              <BookOpen className="h-4 w-4 text-stone-500" strokeWidth={2} aria-hidden />
              Guide de démarrage
            </Link>
            <motion.div whileHover={{ scale: 1.02 }} transition={{ duration: 0.2 }}>
              <Link
                href="/campaigns/new"
                className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-[0_1px_3px_rgba(0,0,0,0.08)] transition-colors"
                style={{ backgroundColor: ORANGE }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = ORANGE_HOVER;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = ORANGE;
                }}
              >
                <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />
                Nouvelle campagne
              </Link>
            </motion.div>
          </div>
        </motion.header>

        <motion.section variants={sectionMotion} className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          <StatCard
            label="Total candidatures"
            countTarget={stats.total}
            accent={ORANGE}
            iconTint={ORANGE}
            iconBg="#FFF7ED"
            Icon={Mail}
          />
          <StatCard
            label="Envoyées"
            countTarget={stats.sent}
            accent="#16A34A"
            iconTint="#16A34A"
            iconBg="#F0FDF4"
            Icon={Send}
          />
          <StatCard
            label="Taux de réponse"
            countTarget={responseRate}
            isPercent
            accent="#2563EB"
            iconTint="#2563EB"
            iconBg="#EFF6FF"
            Icon={TrendingUp}
          />
          <StatCard
            label="Entretiens"
            countTarget={stats.interviews}
            accent="#7C3AED"
            iconTint="#7C3AED"
            iconBg="#F5F3FF"
            Icon={CalendarCheck}
          />
        </motion.section>

        <motion.section
          variants={sectionMotion}
          className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]"
        >
          <QuickStart steps={steps} done={done} doneCount={done.filter(Boolean).length} />
          <QuickActionsGrid items={quickActions} />
        </motion.section>

        <motion.section
          variants={sectionMotion}
          className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.65fr)]"
        >
          <div className="flex flex-col gap-4">
            <DashboardCvCard profile={profile} uploading={uploading} onFileChange={handleCvUpload} />
            <ActivityFeed recentApps={recentApps} />
          </div>

          <div className="flex flex-col overflow-hidden rounded-xl border border-stone-200 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)]">
            <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4">
              <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-stone-800">Campagnes actives</h2>
              <Link
                href="/campaigns/new"
                className="text-xs font-medium text-[#F97316] transition-opacity hover:opacity-80"
              >
                + Nouvelle
              </Link>
            </div>

            <div className="border-b border-stone-200 px-5 py-5">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-2xl font-bold tabular-nums tracking-tight text-[#1C1917]">{chartSum}</p>
                  <p className="mt-0.5 text-xs text-stone-500">
                    candidatures · {chartPeriod === "7j" ? "7 derniers jours" : "4 dernières semaines"}
                  </p>
                </div>
                <div className="flex rounded-lg bg-stone-100 p-0.5">
                  {(["7j", "30j"] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setChartPeriod(p)}
                      className={cn(
                        "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                        chartPeriod === p
                          ? "bg-white text-stone-800 shadow-sm ring-1 ring-stone-200/80"
                          : "text-stone-500 hover:text-stone-700"
                      )}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              <CampaignChart period={chartPeriod} values={chartValues} labels={chartLabels} />
            </div>

            <div className="flex-1 overflow-auto">
              <CampaignTable
                campaigns={campaigns.slice(0, 6)}
                onRowClick={(id) => router.push(`/campaigns/${id}`)}
              />
            </div>

            <div className="border-t border-stone-200 px-5 py-4">
              <Link
                href="/campaigns/new"
                className="flex w-full items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold text-white shadow-sm transition-colors"
                style={{ backgroundColor: ORANGE }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = ORANGE_HOVER;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = ORANGE;
                }}
              >
                <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />
                Créer ma première campagne
              </Link>
            </div>
          </div>
        </motion.section>
      </motion.div>
    </AppLayout>
  );
}
