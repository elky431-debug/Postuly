"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  BookmarkCheck,
  Building2,
  Calendar,
  Check,
  ChevronRight,
  FileUp,
  Loader2,
  MoreHorizontal,
  Send,
  TrendingUp,
  Users,
} from "lucide-react";
import { CampaignChart, type ChartPeriod } from "@/components/dashboard/CampaignChart";
import { api, apiUpload } from "@/lib/api";
import { createClient } from "@/lib/supabase";
import { useSelectionStore } from "@/store/selectionStore";
import type { Application, Campaign, CvParsed, Profile } from "@/lib/types";
import { cn } from "@/lib/utils";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const FR_MONTHS = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"] as const;
const FR_DOW    = ["D","L","M","M","J","V","S"] as const;

const STATUS_COLORS: Record<string, string> = {
  sent:      "#F97316",
  replied:   "#22C55E",
  interview: "#3B82F6",
  offer:     "#8B5CF6",
  rejected:  "#EF4444",
};

const STATUS_LABELS: Record<string, string> = {
  sent:      "Envoyée",
  replied:   "Réponse reçue",
  interview: "Entretien",
  offer:     "Offre",
  rejected:  "Refusée",
};

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

function buildChartSeries(apps: Application[], period: ChartPeriod) {
  const now = new Date();
  if (period === "hier") {
    const labels = ["0h","2h","4h","6h","8h","10h","12h","14h","16h","18h","20h","22h"];
    const values = Array(12).fill(0) as number[];
    const y0 = new Date(now); y0.setDate(now.getDate() - 1); y0.setHours(0,0,0,0);
    const y1 = new Date(y0); y1.setDate(y0.getDate() + 1);
    apps.forEach((a) => {
      if (!a.sent_at) return;
      const t = new Date(a.sent_at);
      if (t >= y0 && t < y1) { const idx = Math.floor(t.getHours() / 2); values[idx] = (values[idx] ?? 0) + 1; }
    });
    return { labels, values };
  }
  if (period === "semaine") {
    const start = startOfIsoWeek(now);
    const values = Array(7).fill(0) as number[];
    apps.forEach((a) => {
      if (!a.sent_at) return;
      const diff = Math.floor((new Date(a.sent_at).getTime() - start.getTime()) / 86400000);
      if (diff >= 0 && diff < 7) values[diff] = (values[diff] ?? 0) + 1;
    });
    const labels = Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return FR_DOW[d.getDay()]; }) as string[];
    return { labels, values };
  }
  if (period === "mois") {
    const dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const values = Array(dim).fill(0) as number[];
    apps.forEach((a) => {
      if (!a.sent_at) return;
      const t = new Date(a.sent_at);
      if (t.getFullYear() === now.getFullYear() && t.getMonth() === now.getMonth())
        values[t.getDate() - 1] = (values[t.getDate() - 1] ?? 0) + 1;
    });
    return { labels: Array.from({ length: dim }, (_, i) => String(i + 1)), values };
  }
  const values = Array(12).fill(0) as number[];
  apps.forEach((a) => {
    if (!a.sent_at) return;
    const t = new Date(a.sent_at);
    if (t.getFullYear() === now.getFullYear()) values[t.getMonth()] = (values[t.getMonth()] ?? 0) + 1;
  });
  return { labels: [...FR_MONTHS] as string[], values };
}

const PERIOD_LABELS: Record<ChartPeriod, string> = {
  hier: "Hier", semaine: "Semaine", mois: "Ce mois", annee: "Cette année",
};

// ─── Animations ───────────────────────────────────────────────────────────────

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } };
const fade = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] as const } } };

// ─── KPI Card — exactement comme SmilePay ────────────────────────────────────

function KpiCard({
  label, value, sub, color, icon: Icon, trend,
}: {
  label: string; value: string | number; sub: string;
  color: string; icon: React.ElementType;
  trend?: { label: string; positive: boolean | null };
}) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,0.04)] ring-1 ring-stone-100">
      <div className="flex items-start justify-between">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{ background: `${color}18` }}
        >
          <Icon className="h-5 w-5" style={{ color }} strokeWidth={2} aria-hidden />
        </div>
        <button type="button" className="text-stone-300 hover:text-stone-500 transition-colors">
          <MoreHorizontal className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>

      <p className="mt-4 text-[12px] font-medium text-stone-400">{label}</p>

      <div className="mt-1 flex items-center gap-2.5">
        <p className="text-[26px] font-bold tabular-nums leading-none tracking-tight text-stone-900">
          {value}
        </p>
        {trend && (
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums",
              trend.positive === true  ? "bg-emerald-50 text-emerald-600" :
              trend.positive === false ? "bg-red-50 text-red-500" :
              "bg-stone-100 text-stone-400"
            )}
          >
            {trend.label}
          </span>
        )}
      </div>

      <p className="mt-1 text-[11px] text-stone-400">{sub}</p>
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────

export function DashboardPage() {
  const selection = useSelectionStore((s) => s.selection);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [allApps, setAllApps] = useState<Application[]>([]);
  const [recentApps, setRecentApps] = useState<Application[]>([]);
  const [stats, setStats] = useState({ total: 0, sent: 0, replied: 0, interviews: 0 });
  const [uploading, setUploading] = useState(false);
  const [token, setToken] = useState("");
  const [done, setDone] = useState<boolean[]>([false, false, false]);
  const [chartPeriod, setChartPeriod] = useState<ChartPeriod>("semaine");

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
    setRecentApps(applications.slice(0, 5));
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

  const steps = [
    { label: "Uploader ton CV",              desc: "Score ATS instantané",            href: "/cv",                          pct: done[0] ? 100 : 0 },
    { label: "Trouver des entreprises",      desc: "Base SIRENE + emails Hunter",     href: "/dashboard/entreprises",       pct: done[1] ? 100 : selection.length > 0 ? 50 : 0 },
    { label: "Envoyer des candidatures",     desc: "Lettres IA + envoi Gmail",        href: "/dashboard/selections",        pct: done[2] ? 100 : 0 },
  ];

  return (
    <motion.div
      className="mx-auto max-w-[1440px] px-7 pb-16 pt-7 xl:px-10"
      variants={container}
      initial="hidden"
      animate="show"
    >

      {/* ── Row 1 : 4 KPI cards ─────────────────────────────────────────── */}
      <motion.div variants={fade} className="mb-6 grid grid-cols-2 gap-5 lg:grid-cols-4">
        <KpiCard
          label="Candidatures totales"
          value={stats.total}
          sub="depuis le début"
          color="#F97316"
          icon={Send}
          trend={{ label: `${sentThisWeek} cette semaine`, positive: sentThisWeek > 0 }}
        />
        <KpiCard
          label="Emails envoyés"
          value={stats.sent}
          sub="candidatures parties"
          color="#22C55E"
          icon={TrendingUp}
          trend={stats.sent > 0 ? { label: "+actif", positive: true } : { label: "—", positive: null }}
        />
        <KpiCard
          label="Taux de réponse"
          value={`${responseRate}%`}
          sub="retours positifs"
          color="#3B82F6"
          icon={Users}
          trend={responseRate > 0 ? { label: `${responseRate}%`, positive: true } : { label: "—", positive: null }}
        />
        <KpiCard
          label="Entretiens obtenus"
          value={stats.interviews}
          sub="cette recherche"
          color="#8B5CF6"
          icon={Calendar}
          trend={stats.interviews > 0 ? { label: `+${stats.interviews}`, positive: true } : { label: "—", positive: null }}
        />
      </motion.div>

      {/* ── Row 2 : Chart + Right panel ─────────────────────────────────── */}
      <motion.div variants={fade} className="grid grid-cols-1 gap-6 xl:grid-cols-3">

        {/* ── LEFT: chart card + activité (comme SmilePay) ── */}
        <div className="col-span-2 flex flex-col gap-6">

          {/* Chart card */}
          <div className="rounded-2xl bg-white shadow-[0_2px_8px_rgba(0,0,0,0.04)] ring-1 ring-stone-100">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-stone-100 px-6 py-4">
              <div>
                <h2 className="text-[15px] font-bold text-stone-900">Flux d'envois</h2>
                <p className="mt-0.5 text-[11px] text-stone-400">
                  <span className="font-semibold text-stone-700 tabular-nums">{chartSum}</span>
                  {" "}candidature{chartSum !== 1 ? "s" : ""} · {PERIOD_LABELS[chartPeriod].toLowerCase()}
                </p>
              </div>
              {/* Period tabs — SmilePay style dropdown pills */}
              <div className="flex items-center gap-2">
                {(["hier","semaine","mois","annee"] as ChartPeriod[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setChartPeriod(p)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11.5px] font-semibold transition-all",
                      chartPeriod === p
                        ? "bg-orange-500 text-white shadow-sm"
                        : "bg-stone-50 text-stone-500 hover:bg-stone-100 hover:text-stone-800"
                    )}
                  >
                    {PERIOD_LABELS[p]}
                  </button>
                ))}
              </div>
            </div>
            {/* Chart */}
            <div className="px-6 py-5">
              <CampaignChart period={chartPeriod} values={chartData.values} labels={chartData.labels} />
            </div>
          </div>

          {/* Activité récente (Transaction style SmilePay) */}
          <div className="rounded-2xl bg-white shadow-[0_2px_8px_rgba(0,0,0,0.04)] ring-1 ring-stone-100">
            <div className="flex items-center justify-between border-b border-stone-100 px-6 py-4">
              <h2 className="text-[15px] font-bold text-stone-900">Activité récente</h2>
              <Link href="/kanban" className="flex items-center gap-1 text-[12px] font-semibold text-orange-500 hover:text-orange-600 transition-colors">
                Tout voir <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.5} />
              </Link>
            </div>

            {recentApps.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-center">
                <Send className="mb-3 h-8 w-8 text-stone-200" strokeWidth={1.5} />
                <p className="text-[13px] text-stone-400">Aucune candidature pour l'instant</p>
                <Link href="/dashboard/entreprises" className="mt-2 inline-flex items-center gap-1 text-[12px] font-semibold text-orange-500 hover:text-orange-600">
                  Commencer <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-stone-50">
                {recentApps.map((app) => {
                  const color  = STATUS_COLORS[app.status] ?? "#D1D5DB";
                  const label  = STATUS_LABELS[app.status] ?? app.status;
                  const name   = app.company?.name ?? "Entreprise";
                  const initials = name[0]?.toUpperCase() ?? "?";
                  const isPositive = ["replied","interview","offer"].includes(app.status);
                  const isNegative = app.status === "rejected";
                  return (
                    <div key={app.id} className="flex items-center gap-4 px-6 py-3.5 transition hover:bg-stone-50/60">
                      {/* Icône (comme Photoshop icon dans SmilePay) */}
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[14px] font-bold"
                        style={{ background: color + "18", color }}
                      >
                        {initials}
                      </div>
                      {/* Nom + date */}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-semibold text-stone-800">{name}</p>
                        <p className="text-[11px] text-stone-400">
                          {app.sent_at
                            ? new Date(app.sent_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
                            : "—"}
                        </p>
                      </div>
                      {/* Statut coloré (comme +$11.5 dans SmilePay) */}
                      <span
                        className={cn(
                          "shrink-0 text-[13px] font-semibold tabular-nums",
                          isPositive ? "text-emerald-600" : isNegative ? "text-red-500" : "text-stone-600"
                        )}
                      >
                        {isPositive ? "+" : isNegative ? "−" : "·"} {label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT panel (1/3) comme SmilePay : carte + stats + planning ── */}
        <div className="flex flex-col gap-5">

          {/* Carte sombre "Ma Sélection" (remplace la carte bancaire SmilePay) */}
          <div className="relative overflow-hidden rounded-2xl bg-[#1C2333] p-6 shadow-[0_8px_32px_rgba(0,0,0,0.15)]">
            {/* Cercles décoratifs */}
            <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-orange-500/10" />
            <div className="pointer-events-none absolute -bottom-8 -left-8 h-28 w-28 rounded-full bg-orange-500/6" />

            {/* Header */}
            <div className="relative flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">
                Ma Sélection
              </span>
              <BookmarkCheck className="h-4 w-4 text-orange-400" strokeWidth={2} />
            </div>

            {/* Nombre d'entreprises (comme le numéro de carte) */}
            <p className="relative mt-6 text-[42px] font-bold tabular-nums leading-none text-white">
              {selection.length}
            </p>
            <p className="relative mt-1 text-[12px] text-white/40">
              entreprise{selection.length !== 1 ? "s" : ""} sélectionnée{selection.length !== 1 ? "s" : ""}
            </p>

            {/* Liste des entreprises (comme le nom du porteur) */}
            {selection.length > 0 && (
              <div className="relative mt-5 space-y-2">
                {selection.slice(0, 3).map((e) => (
                  <div key={e.siret} className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-orange-400/70" />
                    <p className="truncate text-[11px] text-white/55">{e.nom}</p>
                  </div>
                ))}
                {selection.length > 3 && (
                  <p className="text-[10px] text-white/30">+{selection.length - 3} autres</p>
                )}
              </div>
            )}

            <Link
              href="/dashboard/selections"
              className="relative mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 py-2.5 text-[12px] font-semibold text-white transition hover:bg-orange-600"
            >
              Voir ma sélection
              <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.5} />
            </Link>
          </div>

          {/* Stats block (comme "Your Balance | Traffic/Week" de SmilePay) */}
          <div className="rounded-2xl bg-white shadow-[0_2px_8px_rgba(0,0,0,0.04)] ring-1 ring-stone-100">
            <div className="grid grid-cols-2 divide-x divide-stone-100 border-b border-stone-100">
              <div className="px-5 py-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-400">Total</p>
                <p className="mt-1 text-[22px] font-bold tabular-nums text-stone-900">{stats.total}</p>
              </div>
              <div className="px-5 py-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-400">Cette semaine</p>
                <p className={cn("mt-1 text-[22px] font-bold tabular-nums", sentThisWeek > 0 ? "text-emerald-600" : "text-stone-900")}>
                  {sentThisWeek > 0 ? `+${sentThisWeek}` : sentThisWeek}
                </p>
              </div>
            </div>
            {/* Metadata row (comme Currency/Status/Exp dans SmilePay) */}
            <div className="grid grid-cols-3 divide-x divide-stone-100 px-0 py-0">
              <div className="px-4 py-3">
                <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-stone-400">Type</p>
                <p className="mt-0.5 text-[11px] font-semibold text-stone-700">Spontanée</p>
              </div>
              <div className="px-4 py-3">
                <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-stone-400">Statut</p>
                <p className="mt-0.5 text-[11px] font-semibold text-emerald-600">
                  {stats.sent > 0 ? "Actif" : "En attente"}
                </p>
              </div>
              <div className="px-4 py-3">
                <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-stone-400">Réponses</p>
                <p className="mt-0.5 text-[11px] font-semibold text-stone-700">{stats.replied}</p>
              </div>
            </div>
          </div>

          {/* Objectifs section (comme "Planning" dans SmilePay avec progress bars) */}
          <div className="rounded-2xl bg-white shadow-[0_2px_8px_rgba(0,0,0,0.04)] ring-1 ring-stone-100">
            <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4">
              <h2 className="text-[14px] font-bold text-stone-900">Objectifs</h2>
              <Link href="/dashboard/entreprises" className="flex items-center gap-1 text-[12px] font-semibold text-orange-500 hover:text-orange-600">
                Continuer <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.5} />
              </Link>
            </div>
            <div className="space-y-4 p-5">
              {steps.map((step, i) => (
                <Link
                  key={step.href}
                  href={done[i] ? "#" : step.href}
                  onClick={(e) => done[i] && e.preventDefault()}
                  className="group block"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                        done[i] ? "bg-emerald-100 text-emerald-600" : "bg-orange-50 text-orange-500 ring-1 ring-orange-200/60"
                      )}>
                        {done[i] ? <Check className="h-3 w-3" strokeWidth={2.5} /> : i + 1}
                      </div>
                      <p className={cn("text-[12px] font-semibold", done[i] ? "text-stone-400 line-through" : "text-stone-800 group-hover:text-orange-600 transition-colors")}>
                        {step.label}
                      </p>
                    </div>
                    {/* Amount style like SmilePay "$800 / $5700" */}
                    <span className="text-[10px] font-medium tabular-nums text-stone-400">
                      {step.pct}%
                    </span>
                  </div>
                  {/* Progress bar like SmilePay */}
                  <div className="h-2 overflow-hidden rounded-full bg-stone-100">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${step.pct}%`,
                        background: done[i] ? "#22C55E" : "#F97316",
                      }}
                    />
                  </div>
                </Link>
              ))}
            </div>

            {/* "+ Add new card" equivalent → "+ Ajouter des entreprises" */}
            <div className="border-t border-stone-100 px-5 py-3">
              <Link
                href="/dashboard/entreprises"
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-stone-200 bg-stone-50 py-2.5 text-[12px] font-semibold text-stone-600 transition hover:border-orange-200 hover:bg-orange-50/50 hover:text-orange-600"
              >
                <Building2 className="h-4 w-4" strokeWidth={2} />
                Ajouter des entreprises
              </Link>
            </div>
          </div>

          {/* CV section compacte */}
          {!hasCv && (
            <div className="rounded-2xl bg-white shadow-[0_2px_8px_rgba(0,0,0,0.04)] ring-1 ring-stone-100">
              <label className="block cursor-pointer p-5">
                <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-stone-200 bg-stone-50/60 px-4 py-8 text-center transition hover:border-orange-300 hover:bg-orange-50/30">
                  {uploading ? <Loader2 className="h-7 w-7 animate-spin text-stone-300" /> : <FileUp className="h-7 w-7 text-stone-300" strokeWidth={1.5} />}
                  <p className="text-[12px] font-medium text-stone-600">{uploading ? "Analyse…" : "Uploader ton CV"}</p>
                  <p className="text-[11px] text-stone-400">PDF · DOCX · max 5 MB</p>
                </div>
                <input type="file" className="hidden" accept=".pdf,.docx" onChange={handleCvUpload} disabled={uploading} />
              </label>
            </div>
          )}
          {hasCv && profile?.cv_score != null && (
            <div className="flex items-center gap-4 rounded-2xl bg-white px-5 py-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)] ring-1 ring-stone-100">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-stone-50 ring-1 ring-stone-100">
                <span className="text-[18px] font-bold tabular-nums" style={{ color: profile.cv_score >= 70 ? "#16A34A" : profile.cv_score >= 40 ? "#D97706" : "#DC2626" }}>
                  {profile.cv_score}
                </span>
              </div>
              <div className="flex-1">
                <p className="text-[12px] font-semibold text-stone-800">Score ATS</p>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-stone-100">
                  <div className="h-full rounded-full" style={{ width: `${profile.cv_score}%`, background: profile.cv_score >= 70 ? "#16A34A" : profile.cv_score >= 40 ? "#D97706" : "#DC2626" }} />
                </div>
              </div>
              <Link href="/cv" className="text-[11px] font-semibold text-orange-500 hover:text-orange-600">Voir →</Link>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
