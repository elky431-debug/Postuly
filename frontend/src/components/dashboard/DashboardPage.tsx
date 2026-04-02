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
const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
const fade = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] as const } } };

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({
  label, value, sub, icon: Icon, trend,
}: {
  label: string; value: string | number; sub: string;
  icon: React.ElementType;
  trend?: { label: string; active: boolean };
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl bg-white p-5 shadow-[0_2px_10px_rgba(0,0,0,0.06)] ring-1 ring-stone-100 transition-all hover:shadow-[0_4px_20px_rgba(249,115,22,0.12)] hover:ring-orange-200">

      <div className="flex items-start justify-between">
        {/* Carré icône — visible comme SmilePay */}
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-100">
          <Icon className="h-5 w-5 text-orange-500" strokeWidth={2} aria-hidden />
        </div>
        <button type="button" className="text-stone-300 transition-colors hover:text-stone-500">
          <MoreHorizontal className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>

      <p className="mt-4 text-[11.5px] font-medium text-stone-400">{label}</p>

      <div className="mt-1 flex items-end gap-2">
        <p className="text-[28px] font-bold tabular-nums leading-none tracking-tight text-stone-900">
          {value}
        </p>
        {trend && (
          <span className={cn(
            "mb-0.5 inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold tabular-nums",
            trend.active
              ? "bg-orange-100 text-orange-600"
              : "bg-stone-100 text-stone-400"
          )}>
            {trend.label}
          </span>
        )}
      </div>

      <p className="mt-2 text-[11px] text-stone-400">{sub}</p>
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

  const responseRate = stats.sent > 0 ? Math.round((stats.replied / stats.sent) * 100) : 0;
  const sentThisWeek = useMemo(() => countSentThisWeek(allApps), [allApps]);
  const chartData    = useMemo(() => buildChartSeries(allApps, chartPeriod), [allApps, chartPeriod]);
  const chartSum     = chartData.values.reduce((a, b) => a + b, 0);
  const hasCv        = Boolean(profile?.cv_parsed || profile?.cv_score != null || profile?.cv_url?.trim());

  const steps = [
    { label: "Uploader ton CV",          href: "/cv",                    pct: done[0] ? 100 : 0 },
    { label: "Trouver des entreprises",  href: "/dashboard/entreprises", pct: done[1] ? 100 : selection.length > 0 ? 50 : 0 },
    { label: "Envoyer des candidatures", href: "/dashboard/selections",  pct: done[2] ? 100 : 0 },
  ];

  return (
    <motion.div
      className="mx-auto max-w-[1440px] px-7 pb-16 pt-7 xl:px-10"
      variants={container}
      initial="hidden"
      animate="show"
    >

      {/* ── Row 1 : 4 KPI cards ────────────────────────────────────────── */}
      <motion.div variants={fade} className="mb-6 grid grid-cols-2 gap-5 lg:grid-cols-4">
        <KpiCard
          label="Candidatures totales"
          value={stats.total}
          sub="depuis le début"
          icon={Send}
          trend={{ label: `+${sentThisWeek} cette sem.`, active: sentThisWeek > 0 }}
        />
        <KpiCard
          label="Emails envoyés"
          value={stats.sent}
          sub="candidatures parties"
          icon={TrendingUp}
          trend={{ label: stats.sent > 0 ? "actif" : "en attente", active: stats.sent > 0 }}
        />
        <KpiCard
          label="Taux de réponse"
          value={`${responseRate}%`}
          sub="retours positifs"
          icon={Users}
          trend={{ label: responseRate > 0 ? `+${responseRate}%` : "—", active: responseRate > 0 }}
        />
        <KpiCard
          label="Entretiens obtenus"
          value={stats.interviews}
          sub="cette recherche"
          icon={Calendar}
          trend={{ label: stats.interviews > 0 ? `+${stats.interviews}` : "—", active: stats.interviews > 0 }}
        />
      </motion.div>

      {/* ── Row 2 ─────────────────────────────────────────────────────── */}
      <motion.div variants={fade} className="grid grid-cols-1 gap-6 xl:grid-cols-3">

        {/* ── LEFT ── */}
        <div className="col-span-2 flex flex-col gap-6">

          {/* Chart */}
          <div className="rounded-2xl bg-white shadow-[0_2px_10px_rgba(0,0,0,0.06)] ring-1 ring-stone-100">
            <div className="flex items-center justify-between border-b border-stone-100 px-6 py-4">
              <div>
                <h2 className="text-[15px] font-bold text-stone-900">Flux d'envois</h2>
                <p className="mt-0.5 text-[11px] text-stone-400">
                  <span className="font-bold text-orange-500 tabular-nums">{chartSum}</span>
                  {" "}candidature{chartSum !== 1 ? "s" : ""} · {PERIOD_LABELS[chartPeriod].toLowerCase()}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                {(["hier","semaine","mois","annee"] as ChartPeriod[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setChartPeriod(p)}
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-all",
                      chartPeriod === p
                        ? "bg-orange-500 text-white shadow-sm"
                        : "bg-stone-100 text-stone-400 hover:bg-orange-100 hover:text-orange-600"
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

          {/* Activité récente */}
          <div className="rounded-2xl bg-white shadow-[0_2px_10px_rgba(0,0,0,0.06)] ring-1 ring-stone-100">
            <div className="flex items-center justify-between border-b border-stone-100 px-6 py-4">
              <h2 className="text-[15px] font-bold text-stone-900">Activité récente</h2>
              <Link href="/kanban" className="flex items-center gap-1 text-[12px] font-semibold text-orange-500 transition-colors hover:text-orange-600">
                Tout voir <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.5} />
              </Link>
            </div>

            {recentApps.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-100">
                  <Send className="h-5 w-5 text-orange-400" strokeWidth={1.5} />
                </div>
                <p className="text-[13px] font-medium text-stone-500">Aucune candidature pour l'instant</p>
                <Link href="/dashboard/entreprises" className="mt-2 inline-flex items-center gap-1 text-[12px] font-semibold text-orange-500 hover:text-orange-600">
                  Commencer <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-stone-50">
                {recentApps.map((app) => {
                  const label    = STATUS_LABELS[app.status] ?? app.status;
                  const name     = app.company?.name ?? "Entreprise";
                  const initials = name[0]?.toUpperCase() ?? "?";
                  const isActive = ["replied","interview","offer"].includes(app.status);
                  return (
                    <div key={app.id} className="flex items-center gap-4 px-6 py-3.5 transition hover:bg-orange-50/40">
                      {/* Initiale — carré orange comme SmilePay */}
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-[13px] font-bold text-orange-500">
                        {initials}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-semibold text-stone-800">{name}</p>
                        <p className="text-[11px] text-stone-400">
                          {app.sent_at
                            ? new Date(app.sent_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
                            : "—"}
                        </p>
                      </div>
                      {/* Badge statut */}
                      <span className={cn(
                        "shrink-0 rounded-md px-2.5 py-1 text-[11px] font-semibold",
                        isActive
                          ? "bg-orange-100 text-orange-600"
                          : "bg-stone-100 text-stone-400"
                      )}>
                        {label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT panel ── */}
        <div className="flex flex-col gap-5">

          {/* Carte sombre — dark orange comme SmilePay dark teal */}
          <div className="relative overflow-hidden rounded-2xl bg-[#1C0A00] p-6 shadow-[0_8px_32px_rgba(249,115,22,0.20)]">
            {/* Cercles décoratifs orange */}
            <div className="pointer-events-none absolute -right-6 -top-6 h-32 w-32 rounded-full bg-orange-500/25" />
            <div className="pointer-events-none absolute -bottom-6 -left-4 h-24 w-24 rounded-full bg-orange-600/15" />

            <div className="relative flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-orange-400/60">
                Ma Sélection
              </span>
              <BookmarkCheck className="h-4 w-4 text-orange-400" strokeWidth={2} />
            </div>

            <p className="relative mt-5 text-[44px] font-bold tabular-nums leading-none text-white">
              {selection.length}
            </p>
            <p className="relative mt-1 text-[12px] text-orange-200/50">
              entreprise{selection.length !== 1 ? "s" : ""} sélectionnée{selection.length !== 1 ? "s" : ""}
            </p>

            {selection.length > 0 && (
              <div className="relative mt-4 space-y-2">
                {selection.slice(0, 3).map((e) => (
                  <div key={e.siret} className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-orange-400/70" />
                    <p className="truncate text-[11px] text-orange-100/50">{e.nom}</p>
                  </div>
                ))}
                {selection.length > 3 && (
                  <p className="text-[10px] text-orange-300/30">+{selection.length - 3} autres</p>
                )}
              </div>
            )}

            <Link
              href="/dashboard/selections"
              className="relative mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 py-2.5 text-[12px] font-semibold text-white transition hover:bg-orange-400"
            >
              Voir ma sélection
              <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.5} />
            </Link>
          </div>

          {/* Stats block */}
          <div className="overflow-hidden rounded-2xl bg-white shadow-[0_2px_10px_rgba(0,0,0,0.06)] ring-1 ring-stone-100">
            <div className="grid grid-cols-2 divide-x divide-stone-100 border-b border-stone-100">
              <div className="px-5 py-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-400">Total</p>
                <p className="mt-1 text-[24px] font-bold tabular-nums text-stone-900">{stats.total}</p>
              </div>
              <div className="px-5 py-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-400">Cette semaine</p>
                <p className={cn(
                  "mt-1 text-[24px] font-bold tabular-nums",
                  sentThisWeek > 0 ? "text-orange-500" : "text-stone-900"
                )}>
                  {sentThisWeek > 0 ? `+${sentThisWeek}` : "0"}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 divide-x divide-stone-100">
              <div className="px-4 py-3">
                <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-stone-400">Type</p>
                <p className="mt-0.5 text-[11px] font-semibold text-stone-700">Spontanée</p>
              </div>
              <div className="px-4 py-3">
                <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-stone-400">Statut</p>
                <p className={cn("mt-0.5 text-[11px] font-semibold", stats.sent > 0 ? "text-orange-500" : "text-stone-400")}>
                  {stats.sent > 0 ? "Actif" : "En attente"}
                </p>
              </div>
              <div className="px-4 py-3">
                <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-stone-400">Réponses</p>
                <p className={cn("mt-0.5 text-[11px] font-semibold", stats.replied > 0 ? "text-orange-500" : "text-stone-700")}>
                  {stats.replied}
                </p>
              </div>
            </div>
          </div>

          {/* Objectifs */}
          <div className="overflow-hidden rounded-2xl bg-white shadow-[0_2px_10px_rgba(0,0,0,0.06)] ring-1 ring-stone-100">
            <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4">
              <h2 className="text-[14px] font-bold text-stone-900">Objectifs</h2>
              <Link href="/dashboard/entreprises" className="flex items-center gap-1 text-[12px] font-semibold text-orange-500 hover:text-orange-600">
                Continuer <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.5} />
              </Link>
            </div>
            <div className="space-y-5 p-5">
              {steps.map((step, i) => (
                <Link
                  key={step.href}
                  href={done[i] ? "#" : step.href}
                  onClick={(e) => done[i] && e.preventDefault()}
                  className="group block"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className={cn(
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                        done[i]
                          ? "bg-orange-100 text-orange-500"
                          : "bg-orange-100 text-orange-500"
                      )}>
                        {done[i] ? <Check className="h-3 w-3" strokeWidth={2.5} /> : i + 1}
                      </div>
                      <p className={cn(
                        "text-[12.5px] font-semibold transition-colors",
                        done[i] ? "text-stone-400 line-through" : "text-stone-800 group-hover:text-orange-600"
                      )}>
                        {step.label}
                      </p>
                    </div>
                    <span className={cn(
                      "text-[11px] font-semibold tabular-nums",
                      step.pct > 0 ? "text-orange-500" : "text-stone-400"
                    )}>
                      {step.pct}%
                    </span>
                  </div>
                  {/* Barre épaisse comme SmilePay */}
                  <div className="h-2 overflow-hidden rounded-full bg-stone-100">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${step.pct === 0 ? 3 : step.pct}%`, background: "#F97316" }}
                    />
                  </div>
                </Link>
              ))}
            </div>
            <div className="border-t border-stone-100 px-5 py-3">
              <Link
                href="/dashboard/entreprises"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-50 py-2.5 text-[12px] font-semibold text-orange-600 ring-1 ring-orange-200/60 transition hover:bg-orange-100"
              >
                <Building2 className="h-4 w-4" strokeWidth={2} />
                Ajouter des entreprises
              </Link>
            </div>
          </div>

          {/* CV upload */}
          {!hasCv && (
            <div className="overflow-hidden rounded-2xl bg-white shadow-[0_2px_10px_rgba(0,0,0,0.06)] ring-1 ring-stone-100">
              <label className="block cursor-pointer p-4">
                <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-orange-200 bg-orange-50 px-4 py-8 text-center transition hover:border-orange-400 hover:bg-orange-100/50">
                  {uploading
                    ? <Loader2 className="h-7 w-7 animate-spin text-orange-400" />
                    : <FileUp className="h-7 w-7 text-orange-400" strokeWidth={1.5} />}
                  <p className="text-[12.5px] font-semibold text-orange-600">{uploading ? "Analyse…" : "Uploader ton CV"}</p>
                  <p className="text-[11px] text-stone-400">PDF · DOCX · max 5 MB</p>
                </div>
                <input type="file" className="hidden" accept=".pdf,.docx" onChange={handleCvUpload} disabled={uploading} />
              </label>
            </div>
          )}

          {hasCv && profile?.cv_score != null && (
            <div className="flex items-center gap-4 rounded-2xl bg-white px-5 py-4 shadow-[0_2px_10px_rgba(0,0,0,0.06)] ring-1 ring-stone-100">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-orange-100">
                <span className="text-[18px] font-bold tabular-nums text-orange-600">
                  {profile.cv_score}
                </span>
              </div>
              <div className="flex-1">
                <p className="text-[12px] font-semibold text-stone-800">Score ATS</p>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-stone-100">
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${profile.cv_score}%`, background: "#F97316" }} />
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
