"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  BarChart3,
  BookmarkCheck,
  BookOpen,
  Calendar,
  CheckCircle,
  Plus,
  RefreshCw,
  Search,
  Send,
  TrendingUp,
  Wand2,
} from "lucide-react";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { CampaignChart } from "@/components/dashboard/CampaignChart";
import { CampaignTable } from "@/components/dashboard/CampaignTable";
import { CVDropZone } from "@/components/dashboard/CVDropZone";
import { QuickActions, type QuickActionItem } from "@/components/dashboard/QuickActions";
import { QuickStart } from "@/components/dashboard/QuickStart";
import { StatCard } from "@/components/dashboard/StatCard";
import { api, apiUpload } from "@/lib/api";
import { createClient } from "@/lib/supabase";
import type { Application, Campaign, CvParsed, Profile } from "@/lib/types";
import { cn } from "@/lib/utils";

const ORANGE = "#F97316";
const GREEN = "#22C55E";
const BLUE = "#3B82F6";
const VIOLET = "#8B5CF6";

const FR_DOW = ["D", "L", "M", "M", "J", "V", "S"] as const;

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.07 },
  },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as const },
  },
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

/**
 * Page dashboard Postuly — cartes sombres sur fond principal blanc.
 */
export function DashboardPage() {
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
    /* Ne pas utiliser Promise.all : une erreur campagnes/candidatures bloquait tout le chargement du profil. */
    const [rm, rc, ra] = await Promise.allSettled([
      api<Profile>("/api/profiles/me", { token: session.access_token }),
      api<Campaign[]>("/api/campaigns/", { token: session.access_token }),
      api<Application[]>("/api/applications/", { token: session.access_token }),
    ]);

    if (rm.status === "fulfilled") {
      setProfile(rm.value);
    }

    if (rc.status === "fulfilled") {
      setCampaigns(rc.value);
    }

    const applications = ra.status === "fulfilled" ? ra.value : [];
    setAllApps(applications);
    setRecentApps(applications.slice(0, 5));
    const s = {
      total: applications.length,
      sent: applications.filter((x) => x.status === "sent").length,
      replied: applications.filter((x) => ["replied", "interview", "offer"].includes(x.status)).length,
      interviews: applications.filter((x) => x.status === "interview").length,
    };
    setStats(s);

    const p = rm.status === "fulfilled" ? rm.value : null;
    const c = rc.status === "fulfilled" ? rc.value : [];
    setDone([Boolean(p?.cv_url?.trim() || p?.cv_parsed), c.length > 0, s.sent > 0]);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Après upload sur /cv puis retour arrière ou changement d’onglet, le profil peut être périmé.
  useEffect(() => {
    const onFocus = () => void loadData();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [loadData]);

  async function handleCvUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await apiUpload<{ cv_url: string; score: number; parsed: CvParsed }>(
        "/api/cv/upload",
        fd,
        token
      );
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              cv_url: r.cv_url || prev.cv_url,
              cv_score: r.score,
              cv_parsed: r.parsed,
            }
          : prev
      );
      setDone((prev) => {
        const n = [...prev];
        n[0] = true;
        return n;
      });
      /* Recharge le profil (cas où le state était vide avant upload). */
      await loadData();
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
    { Icon: Wand2, label: "Générer une lettre IA", sub: "Depuis ta sélection d’entreprises", href: "/dashboard/entreprises" },
    { Icon: Search, label: "Chercher des offres", sub: "France Travail + SIRENE", href: "/offres" },
    { Icon: BarChart3, label: "Voir rapport hebdo", sub: "Stats de la semaine", href: "/dashboard" },
  ];

  const steps = [
    { label: "Uploader ton CV", desc: "Analyse ATS automatique · score instantané", href: "/cv" },
    { label: "Sélectionner des entreprises", desc: "Recherche INSEE + emails Hunter / scrap", href: "/dashboard/entreprises" },
    {
      label: "Lancer les candidatures",
      desc: "Lettres IA + envoi Gmail via n8n depuis Ma sélection",
      href: "/dashboard/selections",
    },
  ];

  return (
    <motion.div
      className="mx-auto max-w-[1600px] px-5 pb-20 pt-10 sm:px-8 lg:px-12"
      variants={container}
      initial="hidden"
      animate="show"
    >
      <motion.header
        variants={item}
        className="mb-12 flex flex-col gap-6 border-b border-stone-200/80 pb-10 sm:flex-row sm:items-end sm:justify-between"
      >
        <div className="space-y-3">
          <h1 className="text-3xl font-bold leading-[1.15] tracking-tight text-stone-900 sm:text-[2rem]">
            Bonjour{userName ? `, ${userName}` : ""}{" "}
            <span className="inline-block origin-bottom-right" aria-hidden>
              👋
            </span>
          </h1>
          <p className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-stone-600">
            <span className="rounded-full bg-white px-3 py-1 font-medium text-stone-600 shadow-sm ring-1 ring-stone-200/80">
              {todayPretty}
            </span>
            <span className="text-stone-400">·</span>
            <span>
              {sentThisWeek} candidature{sentThisWeek !== 1 ? "s" : ""} envoyée
              {sentThisWeek !== 1 ? "s" : ""} cette semaine
            </span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="#"
            className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-[13px] font-medium text-stone-600 shadow-sm transition hover:border-stone-300 hover:bg-stone-50 hover:text-stone-900"
          >
            <BookOpen className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
            Guide de démarrage
          </Link>
          <Link
            href="/dashboard/selections"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-b from-orange-500 to-orange-600 px-5 py-2.5 text-[13px] font-semibold text-white shadow-lg shadow-orange-500/30 transition hover:from-orange-600 hover:to-orange-700 hover:shadow-xl hover:shadow-orange-500/35"
          >
            <BookmarkCheck className="h-4 w-4" strokeWidth={2.5} aria-hidden />
            Ma sélection
          </Link>
        </div>
      </motion.header>

      <motion.section variants={item} className="mb-10 grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-5">
        <StatCard
          label="Total candidatures"
          countTarget={stats.total}
          accent={ORANGE}
          Icon={Send}
          sparkSeed={`total-${stats.total}`}
          hasTrendData={stats.total > 0}
        />
        <StatCard
          label="Envoyées"
          countTarget={stats.sent}
          accent={GREEN}
          Icon={CheckCircle}
          sparkSeed={`sent-${stats.sent}`}
          hasTrendData={stats.sent > 0}
        />
        <StatCard
          label="Taux de réponse"
          countTarget={responseRate}
          isPercent
          accent={BLUE}
          Icon={TrendingUp}
          sparkSeed={`rate-${responseRate}`}
          hasTrendData={stats.sent > 0}
        />
        <StatCard
          label="Entretiens"
          countTarget={stats.interviews}
          accent={VIOLET}
          Icon={Calendar}
          sparkSeed={`iv-${stats.interviews}`}
          hasTrendData={stats.interviews > 0}
        />
      </motion.section>

      <motion.section variants={item} className="mb-10 grid grid-cols-1 gap-5 lg:grid-cols-5 lg:gap-6">
        <div className="lg:col-span-3">
          <QuickStart steps={steps} done={done} doneCount={done.filter(Boolean).length} />
        </div>
        <div className="lg:col-span-2">
          <QuickActions items={quickActions} />
        </div>
      </motion.section>

      <motion.section variants={item} className="mb-10 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <CVDropZone profile={profile} uploading={uploading} onFileChange={handleCvUpload} />

        <div className="flex flex-col overflow-hidden rounded-2xl border border-stone-200/90 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
          <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50/40 px-5 py-4">
            <div>
              <h2 className="text-sm font-bold text-stone-900">Volume d&apos;envois</h2>
              <p className="mt-0.5 text-[11px] text-stone-500">Candidatures sur la période</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex rounded-lg bg-stone-200/60 p-0.5 ring-1 ring-stone-200/80">
                {(["7j", "30j"] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setChartPeriod(p)}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-xs font-semibold transition-all",
                      chartPeriod === p
                        ? "bg-white text-orange-600 shadow-sm ring-1 ring-stone-200/90"
                        : "text-stone-500 hover:text-stone-800"
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="border-b border-stone-100 px-5 py-6">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-3xl font-bold tabular-nums tracking-tight text-stone-900">{chartSum}</p>
                <p className="mt-1 text-xs font-medium text-stone-500">
                  candidatures · {chartPeriod === "7j" ? "7 derniers jours" : "4 dernières semaines"}
                </p>
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

          <div className="border-t border-stone-100 bg-stone-50/30 px-5 py-4">
            <Link
              href="/dashboard/selections"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-orange-500 to-orange-600 py-3.5 text-sm font-semibold text-white shadow-md shadow-orange-500/25 transition hover:from-orange-600 hover:to-orange-700"
            >
              <BookmarkCheck className="h-4 w-4" strokeWidth={2.5} aria-hidden />
              Ouvrir Ma sélection
            </Link>
          </div>
        </div>
      </motion.section>

      <motion.section variants={item}>
        <ActivityFeed recentApps={recentApps} />
      </motion.section>
    </motion.div>
  );
}
