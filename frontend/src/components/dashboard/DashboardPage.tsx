"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  BookmarkCheck,
  Building2,
  Calendar,
  Check,
  ChevronRight,
  FileUp,
  Loader2,
  Send,
  TrendingUp,
  Zap,
} from "lucide-react";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as ReTooltip,
} from "recharts";
import { CampaignChart, type ChartPeriod } from "@/components/dashboard/CampaignChart";
import { api, apiUpload } from "@/lib/api";
import { createClient } from "@/lib/supabase";
import { useSelectionStore } from "@/store/selectionStore";
import type { Application, Campaign, CvParsed, Profile } from "@/lib/types";
import { cn } from "@/lib/utils";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const FR_MONTHS = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"] as const;
const FR_DOW    = ["D","L","M","M","J","V","S"] as const;

const STATUS_CONFIG = [
  { key: "sent",      label: "Envoyées",   color: "#F97316" },
  { key: "replied",   label: "Réponses",   color: "#22C55E" },
  { key: "interview", label: "Entretiens", color: "#3B82F6" },
  { key: "offer",     label: "Offres",     color: "#8B5CF6" },
  { key: "rejected",  label: "Refusées",   color: "#EF4444" },
];

const STATUS_COLORS: Record<string, string> = Object.fromEntries(
  STATUS_CONFIG.map((s) => [s.key, s.color])
);

const STATUS_LABELS: Record<string, string> = Object.fromEntries(
  STATUS_CONFIG.map((s) => [s.key, s.label])
);

function startOfIsoWeek(d: Date): Date {
  const x = new Date(d);
  const day = x.getDay();
  x.setDate(x.getDate() + (day === 0 ? -6 : 1 - day));
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

function buildChartSeries(apps: Application[], period: ChartPeriod): { labels: string[]; values: number[] } {
  const now = new Date();
  if (period === "hier") {
    const labels = ["0h","2h","4h","6h","8h","10h","12h","14h","16h","18h","20h","22h"];
    const values = Array(12).fill(0);
    const y0 = new Date(now); y0.setDate(now.getDate() - 1); y0.setHours(0,0,0,0);
    const y1 = new Date(y0); y1.setDate(y0.getDate() + 1);
    apps.forEach((a) => {
      if (!a.sent_at) return;
      const t = new Date(a.sent_at);
      if (t >= y0 && t < y1) values[Math.floor(t.getHours() / 2)] = (values[Math.floor(t.getHours() / 2)] ?? 0) + 1;
    });
    return { labels, values };
  }
  if (period === "semaine") {
    const start = startOfIsoWeek(now);
    const values = Array(7).fill(0);
    apps.forEach((a) => {
      if (!a.sent_at) return;
      const diff = Math.floor((new Date(a.sent_at).getTime() - start.getTime()) / 86400000);
      if (diff >= 0 && diff < 7) values[diff] = (values[diff] ?? 0) + 1;
    });
    const labels = Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return FR_DOW[d.getDay()]; });
    return { labels, values };
  }
  if (period === "mois") {
    const dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const values = Array(dim).fill(0);
    apps.forEach((a) => {
      if (!a.sent_at) return;
      const t = new Date(a.sent_at);
      if (t.getFullYear() === now.getFullYear() && t.getMonth() === now.getMonth())
        values[t.getDate() - 1] = (values[t.getDate() - 1] ?? 0) + 1;
    });
    return { labels: Array.from({ length: dim }, (_, i) => String(i + 1)), values };
  }
  const values = Array(12).fill(0);
  apps.forEach((a) => {
    if (!a.sent_at) return;
    const t = new Date(a.sent_at);
    if (t.getFullYear() === now.getFullYear()) values[t.getMonth()] = (values[t.getMonth()] ?? 0) + 1;
  });
  return { labels: [...FR_MONTHS], values };
}

const PERIOD_LABELS: Record<ChartPeriod, string> = {
  hier: "Hier", semaine: "Semaine", mois: "Ce mois", annee: "Cette année",
};

// ─── Animations ───────────────────────────────────────────────────────────────

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } };
const row = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] as const } } };

// ─── KPI card ────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, color, icon: Icon, trend,
}: {
  label: string; value: string | number; sub: string;
  color: string; icon: React.ElementType;
  trend?: { value: number; label: string };
}) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.05)] ring-1 ring-stone-100">
      <div className="flex items-start justify-between">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{ background: `${color}14` }}
        >
          <Icon className="h-5 w-5" style={{ color }} strokeWidth={2} aria-hidden />
        </div>
        {trend !== undefined && (
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums",
              trend.value > 0 ? "bg-emerald-50 text-emerald-700" :
              trend.value < 0 ? "bg-red-50 text-red-600" :
              "bg-stone-100 text-stone-400"
            )}
          >
            {trend.value > 0 ? "+" : ""}{trend.label}
          </span>
        )}
      </div>
      <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.1em] text-stone-400">{label}</p>
      <p
        className="mt-1 text-[2rem] font-extrabold leading-none tabular-nums tracking-tight text-stone-900"
      >
        {value}
      </p>
      <p className="mt-1 text-[11px] text-stone-400">{sub}</p>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export function DashboardPage() {
  const router = useRouter();
  const selection = useSelectionStore((s) => s.selection);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [allApps, setAllApps] = useState<Application[]>([]);
  const [recentApps, setRecentApps] = useState<Application[]>([]);
  const [stats, setStats] = useState({ total: 0, sent: 0, replied: 0, interviews: 0 });
  const [uploading, setUploading] = useState(false);
  const [token, setToken] = useState("");
  const [done, setDone] = useState<boolean[]>([false, false, false]);
  const [chartPeriod, setChartPeriod] = useState<ChartPeriod>("semaine");

  void router;

  const loadData = useCallback(async () => {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    setToken(session.access_token);

    const [rm, rc, ra] = await Promise.allSettled([
      api<Profile>("/api/profiles/me", { token: session.access_token }),
      api<Campaign[]>("/api/campaigns/", { token: session.access_token }),
      api<Application[]>("/api/applications/", { token: session.access_token }),
    ]);

    if (rm.status === "fulfilled") setProfile(rm.value);
    const applications = ra.status === "fulfilled" ? ra.value : [];
    setAllApps(applications);
    setRecentApps(applications.slice(0, 6));
    const s = {
      total:      applications.length,
      sent:       applications.filter((x) => x.status === "sent").length,
      replied:    applications.filter((x) => ["replied","interview","offer"].includes(x.status)).length,
      interviews: applications.filter((x) => x.status === "interview").length,
    };
    setStats(s);
    const p = rm.status === "fulfilled" ? rm.value : null;
    const c = rc.status === "fulfilled" ? rc.value : [];
    setDone([Boolean(p?.cv_url?.trim() || p?.cv_parsed), c.length > 0, s.sent > 0]);
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);
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
      const r = await apiUpload<{ cv_url: string; score: number; parsed: CvParsed }>("/api/cv/upload", fd, token);
      setProfile((prev) => prev ? { ...prev, cv_url: r.cv_url || prev.cv_url, cv_score: r.score, cv_parsed: r.parsed } : prev);
      setDone((prev) => { const n = [...prev]; n[0] = true; return n; });
      await loadData();
    } catch { /* silencieux */ }
    setUploading(false);
  }

  const responseRate  = stats.sent > 0 ? Math.round((stats.replied / stats.sent) * 100) : 0;
  const sentThisWeek  = useMemo(() => countSentThisWeek(allApps), [allApps]);
  const chartData     = useMemo(() => buildChartSeries(allApps, chartPeriod), [allApps, chartPeriod]);
  const chartSum      = chartData.values.reduce((a, b) => a + b, 0);
  const hasCv         = Boolean(profile?.cv_parsed || profile?.cv_score != null || profile?.cv_url?.trim());

  const donutData = STATUS_CONFIG
    .map((s) => ({ ...s, value: allApps.filter((a) => a.status === s.key).length }))
    .filter((s) => s.value > 0);
  const donutTotal = donutData.reduce((a, b) => a + b.value, 0);

  const steps = [
    { label: "Uploader ton CV",              desc: "Score ATS instantané",                   href: "/cv" },
    { label: "Sélectionner des entreprises", desc: "Données SIRENE + emails Hunter",         href: "/dashboard/entreprises" },
    { label: "Lancer les candidatures",      desc: "Lettres IA + envoi Gmail",               href: "/dashboard/selections" },
  ];

  return (
    <motion.div
      className="mx-auto max-w-[1440px] px-8 pb-20 pt-8 xl:px-12"
      variants={container}
      initial="hidden"
      animate="show"
    >

      {/* ── Row 1 : KPI cards ────────────────────────────────────────────── */}
      <motion.div variants={row} className="mb-7 grid grid-cols-2 gap-5 lg:grid-cols-4">
        <KpiCard
          label="Total candidatures" value={stats.total} sub="depuis le début"
          color="#F97316" icon={Send}
          trend={{ value: sentThisWeek, label: `${sentThisWeek} cette semaine` }}
        />
        <KpiCard
          label="Envoyées" value={stats.sent} sub="emails partis"
          color="#22C55E" icon={TrendingUp}
          trend={stats.sent > 0 ? { value: 1, label: "actif" } : { value: 0, label: "—" }}
        />
        <KpiCard
          label="Taux de réponse" value={`${responseRate}%`} sub="retours positifs"
          color="#3B82F6" icon={TrendingUp}
          trend={responseRate > 0 ? { value: 1, label: `${responseRate}%` } : undefined}
        />
        <KpiCard
          label="Entretiens" value={stats.interviews} sub="obtenus"
          color="#8B5CF6" icon={Calendar}
          trend={stats.interviews > 0 ? { value: 1, label: `${stats.interviews}` } : undefined}
        />
      </motion.div>

      {/* ── Row 2 : Chart + Sélection card ──────────────────────────────── */}
      <motion.div variants={row} className="mb-7 grid grid-cols-1 gap-6 xl:grid-cols-3">

        {/* Area chart — 2/3 */}
        <div className="col-span-2 rounded-2xl bg-white shadow-[0_2px_12px_rgba(0,0,0,0.05)] ring-1 ring-stone-100">
          <div className="flex items-start justify-between border-b border-stone-100 px-6 py-4">
            <div>
              <h2
                className="text-[14px] font-bold text-stone-900"
                style={{ fontFamily: "var(--font-syne)" }}
              >
                Emails envoyés
              </h2>
              <p className="mt-0.5 text-[11px] text-stone-400">
                <span className="tabular-nums font-semibold text-stone-600">{chartSum}</span>
                {" "}candidature{chartSum !== 1 ? "s" : ""} · {PERIOD_LABELS[chartPeriod].toLowerCase()}
              </p>
            </div>
            {/* Period tabs */}
            <div className="flex rounded-xl bg-stone-100 p-[3px]">
              {(["hier","semaine","mois","annee"] as ChartPeriod[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setChartPeriod(p)}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-all whitespace-nowrap",
                    chartPeriod === p
                      ? "bg-white text-orange-600 shadow-sm ring-1 ring-stone-200/80"
                      : "text-stone-400 hover:text-stone-700"
                  )}
                >
                  {PERIOD_LABELS[p]}
                </button>
              ))}
            </div>
          </div>
          <div className="px-6 py-5">
            <CampaignChart period={chartPeriod} values={chartData.values} labels={chartData.labels} />
          </div>
        </div>

        {/* Sélection card — 1/3 */}
        <div className="flex flex-col gap-4">
          {/* Dark "card" like SmilePay credit card */}
          <div className="relative overflow-hidden rounded-2xl bg-[#1A1A1A] p-5 text-white shadow-[0_8px_32px_rgba(0,0,0,0.18)]">
            {/* Background pattern */}
            <div
              className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full opacity-10"
              style={{ background: "radial-gradient(circle, #F97316, transparent)" }}
            />
            <div
              className="pointer-events-none absolute -bottom-6 -left-6 h-24 w-24 rounded-full opacity-8"
              style={{ background: "radial-gradient(circle, #F97316, transparent)" }}
            />

            <div className="relative">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">
                  Ma Sélection
                </span>
                <BookmarkCheck className="h-4 w-4 text-orange-400" strokeWidth={2} />
              </div>

              <p
                className="mt-5 text-[3rem] font-extrabold leading-none tabular-nums tracking-tight text-white"
              >
                {selection.length}
              </p>
              <p className="mt-1 text-[12px] text-white/40">
                entreprise{selection.length !== 1 ? "s" : ""} sélectionnée{selection.length !== 1 ? "s" : ""}
              </p>

              {selection.length > 0 && (
                <div className="mt-4 space-y-1.5">
                  {selection.slice(0, 3).map((e) => (
                    <div key={e.siret} className="flex items-center gap-2">
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-orange-500/20 text-[9px] font-bold text-orange-400">
                        {e.nom?.[0]?.toUpperCase()}
                      </div>
                      <p className="truncate text-[11px] text-white/60">{e.nom}</p>
                    </div>
                  ))}
                  {selection.length > 3 && (
                    <p className="text-[10px] text-white/30">+{selection.length - 3} autres</p>
                  )}
                </div>
              )}

              <Link
                href="/dashboard/selections"
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 py-2.5 text-[12px] font-semibold text-white transition hover:bg-orange-600"
              >
                Voir ma sélection
                <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.5} />
              </Link>
            </div>
          </div>

          {/* Stats below card (like SmilePay's balance/status/exp) */}
          <div className="rounded-2xl bg-white px-5 py-4 shadow-[0_2px_12px_rgba(0,0,0,0.05)] ring-1 ring-stone-100">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-stone-400">Total</p>
                <p className="mt-1 text-[18px] font-extrabold tabular-nums text-stone-900">
                  {stats.total}
                </p>
              </div>
              <div className="border-x border-stone-100">
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-stone-400">Réponses</p>
                <p className="mt-1 text-[18px] font-extrabold tabular-nums text-emerald-600">
                  {stats.replied}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-stone-400">Entretiens</p>
                <p className="mt-1 text-[18px] font-extrabold tabular-nums text-blue-600">
                  {stats.interviews}
                </p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Row 3 : Activity + Quick start + Donut ──────────────────────── */}
      <motion.div variants={row} className="mb-7 grid grid-cols-1 gap-6 lg:grid-cols-3">

        {/* Activity — transaction style (SmilePay) */}
        <div className="rounded-2xl bg-white shadow-[0_2px_12px_rgba(0,0,0,0.05)] ring-1 ring-stone-100">
          <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4">
            <h2 className="text-[14px] font-bold text-stone-900" style={{ fontFamily: "var(--font-syne)" }}>
              Activité récente
            </h2>
            <Link href="/kanban" className="text-[11px] font-semibold text-orange-500 hover:text-orange-600">
              Tout voir →
            </Link>
          </div>
          <div className="divide-y divide-stone-50">
            {recentApps.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Send className="mb-3 h-8 w-8 text-stone-200" strokeWidth={1.5} />
                <p className="text-[12px] text-stone-400">Aucune candidature pour l'instant</p>
                <Link
                  href="/dashboard/entreprises"
                  className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold text-orange-500 hover:text-orange-600"
                >
                  Commencer <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
            ) : (
              recentApps.map((app) => {
                const color = STATUS_COLORS[app.status] ?? "#D1D5DB";
                const label = STATUS_LABELS[app.status] ?? app.status;
                const initials = (app.company?.name ?? "?")[0]?.toUpperCase() ?? "?";
                return (
                  <div key={app.id} className="flex items-center gap-3 px-5 py-3 transition hover:bg-stone-50/60">
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[13px] font-bold text-white"
                      style={{ background: color + "22", color }}
                    >
                      {initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-stone-800">
                        {app.company?.name ?? "Entreprise"}
                      </p>
                      <p className="text-[11px] text-stone-400">
                        {app.sent_at
                          ? new Date(app.sent_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })
                          : "—"}
                      </p>
                    </div>
                    <span
                      className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                      style={{ background: color + "18", color }}
                    >
                      {label}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Quick start — SmilePay "Planning" style */}
        <div className="rounded-2xl bg-white shadow-[0_2px_12px_rgba(0,0,0,0.05)] ring-1 ring-stone-100">
          <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-50">
                <Zap className="h-3.5 w-3.5 text-orange-500" strokeWidth={2} />
              </div>
              <h2 className="text-[14px] font-bold text-stone-900" style={{ fontFamily: "var(--font-syne)" }}>
                Démarrage rapide
              </h2>
            </div>
            <span className="text-[11px] font-semibold tabular-nums text-stone-400">
              {done.filter(Boolean).length}<span className="text-stone-300">/3</span>
            </span>
          </div>
          <div className="p-4 space-y-3">
            {/* Progress bar */}
            <div className="h-1.5 overflow-hidden rounded-full bg-stone-100">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${(done.filter(Boolean).length / 3) * 100}%`, background: "#F97316" }}
              />
            </div>
            {steps.map((step, i) => (
              <Link
                key={step.href}
                href={done[i] ? "#" : step.href}
                onClick={(e) => done[i] && e.preventDefault()}
                className={cn(
                  "flex items-center gap-3 rounded-xl border p-3.5 transition-all",
                  done[i]
                    ? "cursor-default border-stone-100 bg-stone-50/60"
                    : "border-stone-100 hover:border-orange-200/70 hover:bg-orange-50/30"
                )}
              >
                <div
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] font-bold",
                    done[i] ? "bg-emerald-100 text-emerald-600" : "bg-orange-50 text-orange-500 ring-1 ring-orange-200/50"
                  )}
                >
                  {done[i] ? <Check className="h-3.5 w-3.5" strokeWidth={2.5} /> : i + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={cn("text-[12px] font-semibold", done[i] ? "text-stone-400 line-through" : "text-stone-800")}>
                    {step.label}
                  </p>
                  <p className="text-[10px] text-stone-400">{step.desc}</p>
                </div>
                {!done[i] && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-stone-300" strokeWidth={2} />}
              </Link>
            ))}
          </div>
        </div>

        {/* Donut statuts */}
        <div className="rounded-2xl bg-white shadow-[0_2px_12px_rgba(0,0,0,0.05)] ring-1 ring-stone-100">
          <div className="border-b border-stone-100 px-5 py-4">
            <h2 className="text-[14px] font-bold text-stone-900" style={{ fontFamily: "var(--font-syne)" }}>
              Statut des candidatures
            </h2>
            <p className="mt-0.5 text-[11px] text-stone-400">
              <span className="font-semibold text-stone-600 tabular-nums">{donutTotal}</span> au total
            </p>
          </div>
          <div className="px-5 py-4">
            {donutTotal === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="flex h-[100px] w-[100px] items-center justify-center rounded-full bg-stone-50 ring-1 ring-stone-100">
                  <Send className="h-7 w-7 text-stone-300" strokeWidth={1.5} />
                </div>
                <p className="mt-3 text-[11px] text-stone-400">Aucune candidature</p>
                <Link href="/dashboard/entreprises" className="mt-2 text-[11px] font-semibold text-orange-500 hover:text-orange-600">
                  Commencer →
                </Link>
              </div>
            ) : (
              <>
                <div className="relative mx-auto h-[130px] w-[130px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={donutData} cx="50%" cy="50%" innerRadius={44} outerRadius={62} paddingAngle={3} dataKey="value" strokeWidth={0} isAnimationActive animationDuration={500}>
                        {donutData.map((e) => <Cell key={e.key} fill={e.color} />)}
                      </Pie>
                      <ReTooltip
                        formatter={(v, _n, props) => [`${String(v)} (${Math.round((Number(v) / donutTotal) * 100)}%)`, (props.payload as { label?: string })?.label ?? ""]}
                        contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E7E5E4", boxShadow: "0 8px 24px rgba(0,0,0,0.08)", padding: "6px 12px" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <p className="text-[20px] font-extrabold leading-none tabular-nums text-stone-900">{donutTotal}</p>
                    <p className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-stone-400">total</p>
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  {donutData.map((s) => (
                    <div key={s.key} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.color }} />
                        <span className="text-[12px] text-stone-600">{s.label}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[12px] font-semibold tabular-nums text-stone-800">{s.value}</span>
                        <span className="text-[10px] text-stone-400">{Math.round((s.value / donutTotal) * 100)}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </motion.div>

      {/* ── Row 4 : CV ──────────────────────────────────────────────────── */}
      <motion.div variants={row}>
        <div className="rounded-2xl bg-white shadow-[0_2px_12px_rgba(0,0,0,0.05)] ring-1 ring-stone-100">
          <div className="flex items-center justify-between border-b border-stone-100 px-6 py-4">
            <div>
              <h2 className="text-[14px] font-bold text-stone-900" style={{ fontFamily: "var(--font-syne)" }}>Mon CV</h2>
              <p className="mt-0.5 text-[11px] text-stone-400">
                {hasCv ? `Score ATS · ${profile?.cv_score != null ? `${profile.cv_score}/100` : "en attente"}` : "Aucun CV uploadé"}
              </p>
            </div>
            <Link href="/cv" className="text-[12px] font-semibold text-orange-500 hover:text-orange-600">Page dédiée →</Link>
          </div>
          <div className="p-6">
            {hasCv ? (
              <div className="flex flex-wrap items-center gap-6">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-stone-50 ring-1 ring-stone-100">
                    <span
                      className="text-[20px] font-extrabold tabular-nums"
                      style={{ color: profile?.cv_score != null ? profile.cv_score >= 70 ? "#16A34A" : profile.cv_score >= 40 ? "#D97706" : "#DC2626" : "#D1D5DB" }}
                    >
                      {profile?.cv_score ?? "—"}
                    </span>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-stone-400">Score ATS</p>
                    <p className="text-[13px] font-semibold" style={{ color: profile?.cv_score != null ? profile.cv_score >= 70 ? "#16A34A" : profile.cv_score >= 40 ? "#D97706" : "#DC2626" : "#9CA3AF" }}>
                      {profile?.cv_score == null ? "—" : profile.cv_score >= 70 ? "Excellent" : profile.cv_score >= 40 ? "Correct" : "À améliorer"}
                    </p>
                    {profile?.cv_score != null && (
                      <div className="mt-1.5 h-1.5 w-28 overflow-hidden rounded-full bg-stone-100">
                        <div className="h-full rounded-full" style={{ width: `${profile.cv_score}%`, background: profile.cv_score >= 70 ? "#16A34A" : profile.cv_score >= 40 ? "#D97706" : "#DC2626" }} />
                      </div>
                    )}
                  </div>
                </div>
                <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5 text-[12px] font-medium text-stone-600 transition hover:border-orange-200 hover:bg-orange-50/60 hover:text-orange-700">
                  <FileUp className="h-3.5 w-3.5" strokeWidth={2} />
                  Remplacer le CV
                  <input type="file" className="hidden" accept=".pdf,.docx" onChange={handleCvUpload} />
                </label>
              </div>
            ) : (
              <label className="block cursor-pointer">
                <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-stone-200 bg-stone-50/50 px-6 py-10 text-center transition hover:border-orange-300 hover:bg-orange-50/30">
                  {uploading ? <Loader2 className="h-8 w-8 animate-spin text-stone-300" /> : <FileUp className="h-8 w-8 text-stone-300" strokeWidth={1.5} />}
                  <p className="text-[13px] font-medium text-stone-600">{uploading ? "Analyse en cours…" : "Glisse ton CV ici ou clique pour parcourir"}</p>
                  <p className="text-[11px] text-stone-400">PDF · DOCX · max 5 MB</p>
                </div>
                <input type="file" className="hidden" accept=".pdf,.docx" onChange={handleCvUpload} disabled={uploading} />
              </label>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
