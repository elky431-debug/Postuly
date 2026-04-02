"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  BookmarkCheck,
  BookOpen,
  Building2,
  FileUp,
  Loader2,
  RefreshCw,
  Search,
  Send,
  Wand2,
} from "lucide-react";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as ReTooltip,
} from "recharts";
import { CampaignChart, type ChartPeriod } from "@/components/dashboard/CampaignChart";
import { QuickStart } from "@/components/dashboard/QuickStart";
import { api, apiUpload } from "@/lib/api";
import { createClient } from "@/lib/supabase";
import type { Application, Campaign, CvParsed, Profile } from "@/lib/types";
import { cn } from "@/lib/utils";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const FR_MONTHS = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"] as const;
const FR_DOW    = ["D","L","M","M","J","V","S"] as const;

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
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const y0 = new Date(yesterday);
    y0.setHours(0, 0, 0, 0);
    apps.forEach((a) => {
      if (!a.sent_at) return;
      const t = new Date(a.sent_at);
      const yEnd = new Date(y0);
      yEnd.setDate(y0.getDate() + 1);
      if (t >= y0 && t < yEnd) {
        const h = t.getHours();
        values[Math.floor(h / 2)] = (values[Math.floor(h / 2)] ?? 0) + 1;
      }
    });
    return { labels, values };
  }

  if (period === "semaine") {
    const values = Array(7).fill(0);
    const start = startOfIsoWeek(now);
    apps.forEach((a) => {
      if (!a.sent_at) return;
      const t = new Date(a.sent_at);
      const diff = Math.floor((t.getTime() - start.getTime()) / 86400000);
      if (diff >= 0 && diff < 7) values[diff] = (values[diff] ?? 0) + 1;
    });
    const labels = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return FR_DOW[d.getDay()];
    });
    return { labels, values };
  }

  if (period === "mois") {
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const values = Array(daysInMonth).fill(0);
    apps.forEach((a) => {
      if (!a.sent_at) return;
      const t = new Date(a.sent_at);
      if (t.getFullYear() === now.getFullYear() && t.getMonth() === now.getMonth()) {
        const d = t.getDate() - 1;
        values[d] = (values[d] ?? 0) + 1;
      }
    });
    const labels = Array.from({ length: daysInMonth }, (_, i) => String(i + 1));
    return { labels, values };
  }

  // annee
  const values = Array(12).fill(0);
  apps.forEach((a) => {
    if (!a.sent_at) return;
    const t = new Date(a.sent_at);
    if (t.getFullYear() === now.getFullYear()) {
      values[t.getMonth()] = (values[t.getMonth()] ?? 0) + 1;
    }
  });
  return { labels: [...FR_MONTHS], values };
}

// ─── Palette statuts ──────────────────────────────────────────────────────────

const STATUS_CONFIG = [
  { key: "sent",      label: "Envoyées",    color: "#F97316" },
  { key: "replied",   label: "Réponses",    color: "#22C55E" },
  { key: "interview", label: "Entretiens",  color: "#3B82F6" },
  { key: "offer",     label: "Offres",      color: "#8B5CF6" },
  { key: "rejected",  label: "Refusées",    color: "#EF4444" },
];

// ─── Composants ──────────────────────────────────────────────────────────────

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};
const row = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.38, ease: [0.25, 0.46, 0.45, 0.94] as const } },
};

const PERIOD_LABELS: Record<ChartPeriod, string> = {
  hier:    "Hier",
  semaine: "Semaine",
  mois:    "Ce mois",
  annee:   "Cette année",
};

export function DashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [allApps, setAllApps] = useState<Application[]>([]);
  const [stats, setStats] = useState({ total: 0, sent: 0, replied: 0, interviews: 0 });
  const [uploading, setUploading] = useState(false);
  const [token, setToken] = useState("");
  const [userName, setUserName] = useState("");
  const [done, setDone] = useState<boolean[]>([false, false, false]);
  const [chartPeriod, setChartPeriod] = useState<ChartPeriod>("semaine");

  const loadData = useCallback(async () => {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    setToken(session.access_token);
    const raw =
      (session.user.user_metadata?.full_name as string | undefined) ||
      session.user.email?.split("@")[0] || "";
    setUserName(raw.split(" ")[0] ?? "");

    const [rm, _rc, ra] = await Promise.allSettled([
      api<Profile>("/api/profiles/me", { token: session.access_token }),
      api<Campaign[]>("/api/campaigns/", { token: session.access_token }),
      api<Application[]>("/api/applications/", { token: session.access_token }),
    ]);

    if (rm.status === "fulfilled") setProfile(rm.value);

    const applications = ra.status === "fulfilled" ? ra.value : [];
    setAllApps(applications);
    const s = {
      total:      applications.length,
      sent:       applications.filter((x) => x.status === "sent").length,
      replied:    applications.filter((x) => ["replied", "interview", "offer"].includes(x.status)).length,
      interviews: applications.filter((x) => x.status === "interview").length,
    };
    setStats(s);
    const p = rm.status === "fulfilled" ? rm.value : null;
    const c = _rc.status === "fulfilled" ? _rc.value : [];
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
      const r = await apiUpload<{ cv_url: string; score: number; parsed: CvParsed }>(
        "/api/cv/upload", fd, token
      );
      setProfile((prev) => prev ? { ...prev, cv_url: r.cv_url || prev.cv_url, cv_score: r.score, cv_parsed: r.parsed } : prev);
      setDone((prev) => { const n = [...prev]; n[0] = true; return n; });
      await loadData();
    } catch { /* silencieux */ }
    setUploading(false);
  }

  const responseRate = stats.sent > 0 ? Math.round((stats.replied / stats.sent) * 100) : 0;
  const sentThisWeek = useMemo(() => countSentThisWeek(allApps), [allApps]);
  const todayLabel = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  const todayPretty = todayLabel.charAt(0).toUpperCase() + todayLabel.slice(1);

  const chartData = useMemo(() => buildChartSeries(allApps, chartPeriod), [allApps, chartPeriod]);
  const chartSum  = chartData.values.reduce((a, b) => a + b, 0);

  const donutData = STATUS_CONFIG
    .map((s) => ({ ...s, value: allApps.filter((a) => a.status === s.key).length }))
    .filter((s) => s.value > 0);
  const donutTotal = donutData.reduce((a, b) => a + b.value, 0);

  const steps = [
    { label: "Uploader ton CV",              desc: "Analyse ATS automatique · score instantané",                 href: "/cv" },
    { label: "Sélectionner des entreprises", desc: "Recherche INSEE + emails Hunter / scraping",                  href: "/dashboard/entreprises" },
    { label: "Lancer les candidatures",      desc: "Lettres IA + envoi Gmail depuis Ma sélection",               href: "/dashboard/selections" },
  ];

  const quickActions = [
    { Icon: RefreshCw, label: "Activer relances auto",  sub: "J+5 si pas de réponse",               href: "/relances" },
    { Icon: Wand2,     label: "Générer une lettre IA",  sub: "Depuis ta sélection d'entreprises",   href: "/dashboard/entreprises" },
    { Icon: Search,    label: "Chercher des entreprises", sub: "Données SIRENE / INSEE",             href: "/dashboard/entreprises" },
    { Icon: Building2, label: "Voir mes candidatures",  sub: "Suivi via le Kanban",                  href: "/kanban" },
  ];

  const hasCv = Boolean(profile?.cv_parsed || profile?.cv_score != null || profile?.cv_url?.trim());

  return (
    <motion.div
      className="mx-auto max-w-[1440px] px-8 pb-20 pt-10 xl:px-12"
      variants={container}
      initial="hidden"
      animate="show"
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <motion.header variants={row} className="mb-10 flex items-end justify-between gap-6">
        <div>
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-stone-400">
            {todayPretty}
          </p>
          <h1
            className="text-[2.4rem] font-extrabold leading-[1.05] tracking-[-0.03em] text-stone-900"
            style={{ fontFamily: "var(--font-syne)" }}
          >
            Bonjour{userName ? `, ${userName}` : ""}
          </h1>
          <p className="mt-2 text-[13px] text-stone-500">
            <span className="font-semibold text-stone-700 tabular-nums">{sentThisWeek}</span>
            {" "}candidature{sentThisWeek !== 1 ? "s" : ""} envoyée
            {sentThisWeek !== 1 ? "s" : ""} cette semaine
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2.5">
          <Link
            href="#"
            className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-[13px] font-medium text-stone-600 shadow-sm transition hover:bg-stone-50 hover:text-stone-900"
          >
            <BookOpen className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
            Guide
          </Link>
          <Link
            href="/dashboard/selections"
            className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-2.5 text-[13px] font-semibold text-white shadow-md shadow-orange-500/25 transition hover:bg-orange-600"
          >
            <BookmarkCheck className="h-4 w-4" strokeWidth={2} aria-hidden />
            Ma sélection
          </Link>
        </div>
      </motion.header>

      {/* ── KPI row ─────────────────────────────────────────────────────── */}
      <motion.div variants={row} className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: "Total candidatures", value: stats.total,     sub: "depuis le début",          color: "#F97316" },
          { label: "Envoyées",           value: stats.sent,      sub: "emails partis",             color: "#22C55E" },
          { label: "Taux de réponse",    value: responseRate,    sub: "% de retours positifs",    color: "#3B82F6", pct: true },
          { label: "Entretiens",         value: stats.interviews, sub: "obtenus",                  color: "#8B5CF6" },
        ].map(({ label, value, sub, color, pct }) => (
          <div
            key={label}
            className="relative overflow-hidden rounded-2xl bg-white px-5 py-5 ring-1 ring-stone-200/70"
          >
            {/* top color bar */}
            <div className="absolute inset-x-0 top-0 h-[3px] rounded-t-2xl" style={{ background: color }} />
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-stone-400">{label}</p>
            <p
              className="mt-3 text-[2.6rem] font-extrabold leading-none tabular-nums tracking-tight text-stone-900"
              style={{ fontFamily: "var(--font-syne)", color }}
            >
              {pct ? `${value}%` : value}
            </p>
            <p className="mt-1.5 text-[11px] text-stone-400">{sub}</p>
          </div>
        ))}
      </motion.div>

      {/* ── Charts row ──────────────────────────────────────────────────── */}
      <motion.div variants={row} className="mb-8 grid grid-cols-1 gap-6 xl:grid-cols-3">

        {/* Bar chart — 2/3 */}
        <div className="col-span-2 overflow-hidden rounded-2xl bg-white ring-1 ring-stone-200/70">
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
              {(["hier", "semaine", "mois", "annee"] as ChartPeriod[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setChartPeriod(p)}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-all whitespace-nowrap",
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
          <div className="px-6 py-6">
            <CampaignChart period={chartPeriod} values={chartData.values} labels={chartData.labels} />
          </div>
        </div>

        {/* Donut chart — 1/3 */}
        <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-stone-200/70">
          <div className="border-b border-stone-100 px-6 py-4">
            <h2
              className="text-[14px] font-bold text-stone-900"
              style={{ fontFamily: "var(--font-syne)" }}
            >
              Statut des candidatures
            </h2>
            <p className="mt-0.5 text-[11px] text-stone-400">
              <span className="tabular-nums font-semibold text-stone-600">{donutTotal}</span> au total
            </p>
          </div>
          <div className="px-6 py-4">
            {donutTotal === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="flex h-[120px] w-[120px] items-center justify-center rounded-full bg-stone-50 ring-1 ring-stone-100">
                  <Send className="h-8 w-8 text-stone-300" strokeWidth={1.5} />
                </div>
                <p className="mt-4 text-[12px] text-stone-400">
                  Aucune candidature pour l'instant.
                </p>
                <Link
                  href="/dashboard/entreprises"
                  className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-orange-50 px-3 py-1.5 text-[12px] font-semibold text-orange-600 transition hover:bg-orange-100"
                >
                  <Building2 className="h-3.5 w-3.5" />
                  Commencer
                </Link>
              </div>
            ) : (
              <>
                <div className="relative mx-auto h-[140px] w-[140px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={donutData}
                        cx="50%"
                        cy="50%"
                        innerRadius={48}
                        outerRadius={66}
                        paddingAngle={3}
                        dataKey="value"
                        strokeWidth={0}
                        isAnimationActive
                        animationDuration={500}
                      >
                        {donutData.map((entry) => (
                          <Cell key={entry.key} fill={entry.color} />
                        ))}
                      </Pie>
                      <ReTooltip
                        formatter={(v, _n, props) => [
                          `${String(v)} (${Math.round((Number(v) / donutTotal) * 100)}%)`,
                          (props.payload as { label?: string })?.label ?? "",
                        ]}
                        contentStyle={{
                          fontSize: 12,
                          borderRadius: 8,
                          border: "1px solid #E7E5E4",
                          backgroundColor: "#fff",
                          boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
                          padding: "6px 12px",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Centre label */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <p
                      className="text-[22px] font-extrabold leading-none text-stone-900 tabular-nums"
                      style={{ fontFamily: "var(--font-syne)" }}
                    >
                      {donutTotal}
                    </p>
                    <p className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-stone-400">
                      total
                    </p>
                  </div>
                </div>

                {/* Legend */}
                <div className="mt-4 space-y-2">
                  {donutData.map((s) => (
                    <div key={s.key} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.color }} />
                        <span className="text-[12px] text-stone-600">{s.label}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[12px] font-semibold tabular-nums text-stone-800">{s.value}</span>
                        <span className="text-[10px] text-stone-400">
                          {Math.round((s.value / donutTotal) * 100)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </motion.div>

      {/* ── Quick actions + Quick start ─────────────────────────────────── */}
      <motion.div variants={row} className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-5">

        {/* Quick actions — 3/5 */}
        <div className="lg:col-span-3">
          <div className="rounded-2xl bg-white ring-1 ring-stone-200/70">
            <div className="border-b border-stone-100 px-6 py-4">
              <h2
                className="text-[14px] font-bold text-stone-900"
                style={{ fontFamily: "var(--font-syne)" }}
              >
                Actions rapides
              </h2>
            </div>
            <div className="grid grid-cols-2 gap-3 p-4">
              {quickActions.map(({ Icon, label, sub, href }) => (
                <Link
                  key={label}
                  href={href}
                  className="group flex items-start gap-3 rounded-xl border border-stone-100 bg-stone-50/40 p-4 transition-all hover:border-orange-200/70 hover:bg-orange-50/40"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white ring-1 ring-stone-200/80 transition-all group-hover:bg-orange-50 group-hover:ring-orange-200">
                    <Icon className="h-4 w-4 text-stone-400 transition-colors group-hover:text-orange-500" strokeWidth={2} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-stone-800">{label}</p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-stone-500">{sub}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Quick start — 2/5 */}
        <div className="lg:col-span-2">
          <QuickStart steps={steps} done={done} doneCount={done.filter(Boolean).length} />
        </div>
      </motion.div>

      {/* ── CV + upload ─────────────────────────────────────────────────── */}
      <motion.div variants={row}>
        <div className="rounded-2xl bg-white ring-1 ring-stone-200/70">
          <div className="flex items-center justify-between border-b border-stone-100 px-6 py-4">
            <div>
              <h2
                className="text-[14px] font-bold text-stone-900"
                style={{ fontFamily: "var(--font-syne)" }}
              >
                Mon CV
              </h2>
              <p className="mt-0.5 text-[11px] text-stone-400">
                {hasCv
                  ? `Score ATS · ${profile?.cv_score != null ? `${profile.cv_score}/100` : "en attente"}`
                  : "Aucun CV uploadé"}
              </p>
            </div>
            <Link
              href="/cv"
              className="text-[12px] font-semibold text-orange-500 transition hover:text-orange-600"
            >
              Page dédiée →
            </Link>
          </div>
          <div className="p-6">
            {hasCv ? (
              <div className="flex flex-wrap items-center gap-6">
                {/* ATS score */}
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-stone-50 ring-1 ring-stone-100">
                    <span
                      className="text-[22px] font-extrabold tabular-nums leading-none"
                      style={{
                        fontFamily: "var(--font-syne)",
                        color: profile?.cv_score != null
                          ? profile.cv_score >= 70 ? "#16A34A" : profile.cv_score >= 40 ? "#D97706" : "#DC2626"
                          : "#D1D5DB",
                      }}
                    >
                      {profile?.cv_score ?? "—"}
                    </span>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-stone-400">Score ATS</p>
                    <p
                      className="text-[13px] font-semibold"
                      style={{
                        color: profile?.cv_score != null
                          ? profile.cv_score >= 70 ? "#16A34A" : profile.cv_score >= 40 ? "#D97706" : "#DC2626"
                          : "#9CA3AF",
                      }}
                    >
                      {profile?.cv_score == null ? "—" : profile.cv_score >= 70 ? "Excellent" : profile.cv_score >= 40 ? "Correct" : "À améliorer"}
                    </p>
                    {profile?.cv_score != null && (
                      <div className="mt-1.5 h-1.5 w-28 overflow-hidden rounded-full bg-stone-100">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${profile.cv_score}%`,
                            background: profile.cv_score >= 70 ? "#16A34A" : profile.cv_score >= 40 ? "#D97706" : "#DC2626",
                          }}
                        />
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
                <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-stone-200 bg-stone-50/60 px-6 py-10 text-center transition hover:border-orange-300 hover:bg-orange-50/30">
                  {uploading ? (
                    <Loader2 className="h-8 w-8 animate-spin text-stone-300" />
                  ) : (
                    <FileUp className="h-8 w-8 text-stone-300" strokeWidth={1.5} />
                  )}
                  <p className="text-[13px] font-medium text-stone-600">
                    {uploading ? "Analyse en cours…" : "Glisse ton CV ici ou clique pour parcourir"}
                  </p>
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
