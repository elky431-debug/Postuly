"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  BarChart3,
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
    { Icon: Wand2, label: "Générer une lettre IA", sub: "Personnalisée par entreprise", href: "/campaigns/new" },
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
    <motion.div
      className="mx-auto max-w-[1600px] px-10 pb-16 pt-8"
      variants={container}
      initial="hidden"
      animate="show"
    >
      <motion.header variants={item} className="mb-10 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-[26px] font-bold leading-tight tracking-tight text-neutral-900">
            Bonjour{userName ? `, ${userName}` : ""} <span aria-hidden>👋</span>
          </h1>
          <p className="mt-1 text-[13px] text-neutral-500">
            {todayPretty} · {sentThisWeek} candidature{sentThisWeek !== 1 ? "s" : ""} envoyée
            {sentThisWeek !== 1 ? "s" : ""} cette semaine
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="#"
            className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 py-2 text-[13px] text-neutral-600 shadow-sm transition-colors hover:border-neutral-300 hover:text-neutral-900"
          >
            <BookOpen className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
            Guide de démarrage
          </Link>
          <Link
            href="/campaigns/new"
            className="inline-flex items-center gap-2 rounded-lg bg-[#F97316] px-4 py-2 text-[13px] font-medium text-white shadow-[0_0_20px_rgba(249,115,22,0.2)] transition hover:bg-[#EA6C0A] hover:shadow-[0_0_32px_rgba(249,115,22,0.28)]"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />
            Nouvelle campagne
          </Link>
        </div>
      </motion.header>

      <motion.section variants={item} className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
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

      <motion.section variants={item} className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-5 lg:gap-5">
        <div className="lg:col-span-3">
          <QuickStart steps={steps} done={done} doneCount={done.filter(Boolean).length} />
        </div>
        <div className="lg:col-span-2">
          <QuickActions items={quickActions} />
        </div>
      </motion.section>

      <motion.section variants={item} className="mb-8 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <CVDropZone profile={profile} uploading={uploading} onFileChange={handleCvUpload} />

        <div className="flex flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
            <h2 className="text-sm font-bold text-neutral-900">Campagnes actives</h2>
            <div className="flex items-center gap-2">
              <div className="flex rounded-lg bg-neutral-100 p-0.5">
                {(["7j", "30j"] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setChartPeriod(p)}
                    className={cn(
                      "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                      chartPeriod === p
                        ? "bg-white text-orange-600 shadow-sm ring-1 ring-neutral-200/80"
                        : "text-neutral-500 hover:text-neutral-800"
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="border-b border-neutral-100 px-5 py-5">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-2xl font-bold tabular-nums tracking-tight text-neutral-900">{chartSum}</p>
                <p className="mt-0.5 text-xs text-neutral-500">
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

          <div className="border-t border-neutral-100 px-5 py-4">
            <Link
              href="/campaigns/new"
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#F97316] py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#EA6C0A]"
            >
              <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />
              Créer ma première campagne
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
