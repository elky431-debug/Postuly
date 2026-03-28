"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { AppLayout } from "@/components/layout/app-layout";
import { cn } from "@/lib/utils";
import { api, apiUpload } from "@/lib/api";
import type { Profile, Campaign, Application } from "@/lib/types";
import { STATUS_LABELS, STATUS_COLORS, CONTRACT_LABELS } from "@/lib/utils";
import Link from "next/link";

const O = "#FE6A2E";
const OL = "#FFF1E3";
const BG = "#F7F6F3";
const BD = "#EEEEED";
const MUTED = "#9B9A96";

/* ── petites helpers UI ── */
function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("bg-white rounded-2xl border overflow-hidden", className)} style={{ borderColor: BD }}>
      {children}
    </div>
  );
}

function CardHead({ title, action, href }: { title: string; action?: string; href?: string }) {
  return (
    <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: `1px solid ${BD}` }}>
      <span className="font-bold text-sm text-gray-900" style={{ fontFamily: "var(--font-syne)" }}>{title}</span>
      {action && href && (
        <Link href={href} className="text-xs font-medium" style={{ color: O }}>{action} →</Link>
      )}
    </div>
  );
}

function Sparkline({ color }: { color: string }) {
  return (
    <div className="flex items-end gap-0.5 h-7 mt-2">
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="flex-1 rounded-sm" style={{ height: 4, background: "#F3F2EE" }} />
      ))}
    </div>
  );
}

/* ── page principale ── */
export default function DashboardPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [recentApps, setRecentApps] = useState<Application[]>([]);
  const [stats, setStats] = useState({ total: 0, sent: 0, replied: 0, interviews: 0 });
  const [uploading, setUploading] = useState(false);
  const [token, setToken] = useState("");
  const [userName, setUserName] = useState("");
  const [done, setDone] = useState<boolean[]>([false, false, false]);

  const loadData = useCallback(async () => {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    setToken(session.access_token);
    const raw = session.user.user_metadata?.full_name || session.user.email?.split("@")[0] || "";
    setUserName(raw.split(" ")[0]);
    try {
      const [p, c, a] = await Promise.all([
        api<Profile>("/api/profiles/me", { token: session.access_token }),
        api<Campaign[]>("/api/campaigns/", { token: session.access_token }),
        api<Application[]>("/api/applications/", { token: session.access_token }),
      ]);
      setProfile(p);
      setCampaigns(c);
      setRecentApps(a.slice(0, 5));
      const s = {
        total: a.length,
        sent: a.filter(x => x.status === "sent").length,
        replied: a.filter(x => ["replied", "interview", "offer"].includes(x.status)).length,
        interviews: a.filter(x => x.status === "interview").length,
      };
      setStats(s);
      setDone([!!p?.cv_url, c.length > 0, s.sent > 0]);
    } catch { /* backend non connecté */ }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleCvUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await apiUpload<{ cv_url: string; score: number }>("/api/cv/upload", fd, token);
      setProfile(prev => prev && { ...prev, cv_url: r.cv_url, cv_score: r.score });
      setDone(prev => { const n = [...prev]; n[0] = true; return n; });
    } catch { /* silencieux */ }
    setUploading(false);
  }

  const doneCount = done.filter(Boolean).length;
  const responseRate = stats.sent > 0 ? Math.round((stats.replied / stats.sent) * 100) : 0;
  const today = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

  const statCards = [
    { label: "Total candidatures", value: stats.total, icon: "📨", accent: O,         iconBg: OL },
    { label: "Envoyées",           value: stats.sent,  icon: "✅", accent: "#16A34A", iconBg: "#F0FDF4" },
    { label: "Taux de réponse",    value: `${responseRate}%`, icon: "📈", accent: "#2563EB", iconBg: "#EFF6FF" },
    { label: "Entretiens",         value: stats.interviews, icon: "🎯", accent: "#7C3AED", iconBg: "#F5F3FF" },
  ];

  const steps = [
    { label: "Uploader ton CV",                desc: "Analyse ATS automatique · score instantané", href: "#cv" },
    { label: "Créer ta première campagne",     desc: "Définis le poste, la zone et le contrat",    href: "/campaigns/new" },
    { label: "Envoyer tes premières candidatures", desc: "L'IA rédige et envoie depuis ton Gmail", href: "/campaigns" },
  ];

  const quickActions = [
    { icon: "🔁", label: "Activer relances auto", sub: "J+5 si pas de réponse",     href: "/relances" },
    { icon: "🤖", label: "Générer une lettre IA", sub: "Personnalisée par entreprise", href: "/campaigns/new" },
    { icon: "🔍", label: "Chercher des offres",   sub: "France Travail + SIRENE",    href: "/offres" },
    { icon: "📊", label: "Voir rapport hebdo",    sub: "Stats de la semaine",        href: "/dashboard" },
  ];

  return (
    <AppLayout>
      {/* on override le bg du main via un wrapper */}
      <div style={{ fontFamily: "var(--font-geist-sans)" }}>

        {/* ── TOPBAR ── */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-gray-900 leading-tight"
              style={{ fontFamily: "var(--font-syne)" }}>
              Bonjour{userName ? ` ${userName}` : ""} 👋
            </h1>
            <p className="text-xs mt-1" style={{ color: MUTED }}>
              {today.charAt(0).toUpperCase() + today.slice(1)} · {stats.sent} candidatures envoyées cette semaine
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="#" className="px-3 py-2 rounded-lg text-xs font-medium border"
              style={{ background: "#F3F2EE", borderColor: BD, color: MUTED }}>
              Guide de démarrage
            </Link>
            <Link href="/campaigns/new"
              className="px-4 py-2 rounded-lg text-xs font-semibold text-white"
              style={{ background: O }}>
              + Nouvelle campagne
            </Link>
          </div>
        </div>

        {/* ── STATS ── */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {statCards.map(s => (
            <div key={s.label} className="bg-white rounded-2xl p-5 border"
              style={{ borderColor: BD, borderLeft: `3px solid ${s.accent}` }}>
              <div className="flex items-center justify-between mb-4">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base"
                  style={{ background: s.iconBg }}>{s.icon}</div>
                <span className="text-xs rounded-full px-2 py-0.5"
                  style={{ fontFamily: "var(--font-dm-mono)", background: "#F3F2EE", color: MUTED }}>
                  — début
                </span>
              </div>
              <p className="text-3xl font-bold tracking-tight leading-none text-gray-900"
                style={{ fontFamily: "var(--font-syne)" }}>{s.value}</p>
              <p className="text-xs mt-1.5" style={{ color: MUTED }}>{s.label}</p>
              <Sparkline color={s.accent} />
            </div>
          ))}
        </div>

        {/* ── MID ROW : onboarding + quick actions ── */}
        <div className="grid gap-4 mb-6" style={{ gridTemplateColumns: "1.3fr 1fr" }}>

          {/* Onboarding */}
          <div className="bg-white rounded-2xl border p-6 relative overflow-hidden"
            style={{ borderColor: BD }}>
            {/* barre orange top */}
            <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl"
              style={{ background: `linear-gradient(90deg, ${O}, #ffb347)` }} />

            <div className="flex items-center justify-between mb-4">
              <span className="font-bold text-sm" style={{ fontFamily: "var(--font-syne)" }}>⚡ Démarrage rapide</span>
              <span className="text-xs" style={{ fontFamily: "var(--font-dm-mono)", color: MUTED }}>
                {doneCount} / 3 étapes
              </span>
            </div>

            {/* progress bar */}
            <div className="h-0.5 rounded-full mb-5 overflow-hidden" style={{ background: "#F3F2EE" }}>
              <div className="h-full rounded-full transition-all duration-700"
                style={{ width: `${(doneCount / 3) * 100}%`, background: `linear-gradient(90deg, ${O}, #ffb347)` }} />
            </div>

            <div className="flex flex-col gap-2.5">
              {steps.map((step, i) => (
                <Link key={i} href={done[i] ? "#" : step.href}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl border transition-all",
                    done[i] ? "opacity-40" : "hover:border-orange-200"
                  )}
                  style={{
                    background: done[i] ? "#F3F2EE" : "#FAFAF8",
                    borderColor: done[i] ? BD : BD,
                  }}
                >
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
                    style={{
                      fontFamily: "var(--font-dm-mono)",
                      background: done[i] ? "#F0FDF4" : "white",
                      border: `1px solid ${done[i] ? "#BBF7D0" : "#E0DFDB"}`,
                      color: done[i] ? "#16A34A" : MUTED,
                    }}>
                    {done[i] ? "✓" : i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm font-medium leading-tight", done[i] && "line-through")}
                      style={{ color: done[i] ? MUTED : "#111110" }}>
                      {step.label}
                    </p>
                    <p className="text-xs mt-0.5 truncate" style={{ color: MUTED }}>{step.desc}</p>
                  </div>
                  {!done[i] && <span style={{ color: "#C8C7C3" }}>›</span>}
                </Link>
              ))}
            </div>
          </div>

          {/* Quick actions */}
          <Card>
            <CardHead title="Actions rapides" />
            <div className="p-4 grid grid-cols-2 gap-2.5">
              {quickActions.map((qa, i) => (
                <Link key={i} href={qa.href}
                  className="rounded-xl p-4 border transition-all flex flex-col gap-2 group"
                  style={{ background: "#FAFAF8", borderColor: BD }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = "#FFD5B8";
                    (e.currentTarget as HTMLElement).style.background = OL;
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = BD;
                    (e.currentTarget as HTMLElement).style.background = "#FAFAF8";
                  }}
                >
                  <span className="text-lg">{qa.icon}</span>
                  <span className="text-xs font-semibold leading-tight text-gray-900">{qa.label}</span>
                  <span className="text-xs" style={{ color: MUTED }}>{qa.sub}</span>
                </Link>
              ))}
            </div>
          </Card>
        </div>

        {/* ── BOTTOM ROW : CV + activité | campagnes ── */}
        <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 1.6fr" }}>

          {/* Colonne gauche */}
          <div className="flex flex-col gap-4">

            {/* CV */}
            <Card id="cv">
              <CardHead title="Mon CV" action="Conseils IA" href="#" />
              <div className="p-4">
                {profile?.cv_url ? (
                  <div className="space-y-3">
                    <div className="flex items-end justify-between">
                      <div>
                        <p className="text-xs mb-1" style={{ color: MUTED }}>Score ATS</p>
                        <p className="text-4xl font-bold tracking-tight" style={{
                          fontFamily: "var(--font-syne)",
                          color: (profile.cv_score || 0) >= 70 ? "#16A34A" : (profile.cv_score || 0) >= 40 ? "#D97706" : "#DC2626"
                        }}>
                          {profile.cv_score}<span className="text-xl font-normal" style={{ color: "#C8C7C3" }}>/100</span>
                        </p>
                      </div>
                      <span className="text-xs" style={{ color: MUTED }}>
                        {(profile.cv_score || 0) >= 70 ? "Excellent" : (profile.cv_score || 0) >= 40 ? "Correct" : "À améliorer"}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "#F3F2EE" }}>
                      <div className="h-full rounded-full" style={{
                        width: `${profile.cv_score || 0}%`,
                        background: (profile.cv_score || 0) >= 70 ? "#16A34A" : (profile.cv_score || 0) >= 40 ? "#D97706" : "#DC2626"
                      }} />
                    </div>
                    <label className="flex items-center justify-center gap-2 py-2 rounded-xl border text-xs cursor-pointer transition-colors"
                      style={{ borderColor: BD, color: MUTED }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = "#FFD5B8")}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = BD)}
                    >
                      📄 Remplacer le CV
                      <input type="file" className="hidden" accept=".pdf,.docx" onChange={handleCvUpload} />
                    </label>
                  </div>
                ) : (
                  <label className="block cursor-pointer">
                    <div className="border-2 border-dashed rounded-xl p-7 flex flex-col items-center gap-2 text-center transition-all"
                      style={{ borderColor: "#E0DFDB", background: "#FAFAF8" }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLElement).style.borderColor = O;
                        (e.currentTarget as HTMLElement).style.background = OL;
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLElement).style.borderColor = "#E0DFDB";
                        (e.currentTarget as HTMLElement).style.background = "#FAFAF8";
                      }}
                    >
                      <span className="text-2xl">📄</span>
                      <p className="text-sm font-semibold text-gray-900">
                        {uploading ? "Analyse en cours..." : "Glisse ton CV ici"}
                      </p>
                      <p className="text-xs" style={{ color: MUTED }}>ou clique pour parcourir</p>
                      <div className="flex gap-1.5 mt-1">
                        {["PDF", "DOCX", "max 5 MB"].map(t => (
                          <span key={t} className="border rounded-md px-2 py-0.5 text-xs"
                            style={{ fontFamily: "var(--font-dm-mono)", borderColor: "#E0DFDB", color: MUTED, background: "white" }}>
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                    <input type="file" className="hidden" accept=".pdf,.docx" onChange={handleCvUpload} disabled={uploading} />
                  </label>
                )}
              </div>
            </Card>

            {/* Activité */}
            <Card>
              <CardHead title="Activité récente" action="Tout voir" href="/kanban" />
              <div className="divide-y" style={{ borderColor: BD }}>
                {recentApps.length === 0 ? (
                  <>
                    <div className="flex items-start gap-3 px-5 py-3.5">
                      <div className="w-2 h-2 rounded-full mt-1 shrink-0" style={{ background: O }} />
                      <p className="text-xs text-gray-900 flex-1 leading-relaxed">
                        Compte créé — bienvenue sur <span className="font-semibold" style={{ color: O }}>Postuly</span> !
                      </p>
                      <span className="text-xs shrink-0" style={{ fontFamily: "var(--font-dm-mono)", color: MUTED }}>maintenant</span>
                    </div>
                    <div className="flex items-start gap-3 px-5 py-3.5">
                      <div className="w-2 h-2 rounded-full mt-1 shrink-0" style={{ background: "#E0DFDB" }} />
                      <p className="text-xs flex-1 leading-relaxed" style={{ color: MUTED }}>Upload ton CV pour démarrer l'analyse ATS</p>
                      <span className="text-xs shrink-0" style={{ fontFamily: "var(--font-dm-mono)", color: "#D0CFC9" }}>—</span>
                    </div>
                    <div className="flex items-start gap-3 px-5 py-3.5">
                      <div className="w-2 h-2 rounded-full mt-1 shrink-0" style={{ background: "#E0DFDB" }} />
                      <p className="text-xs flex-1 leading-relaxed" style={{ color: MUTED }}>Crée ta première campagne de candidatures</p>
                      <span className="text-xs shrink-0" style={{ fontFamily: "var(--font-dm-mono)", color: "#D0CFC9" }}>—</span>
                    </div>
                  </>
                ) : recentApps.map(app => (
                  <div key={app.id} className="flex items-start gap-3 px-5 py-3.5">
                    <div className="w-2 h-2 rounded-full mt-1 shrink-0" style={{ background: O }} />
                    <p className="text-xs text-gray-900 flex-1 leading-relaxed">
                      <span className="font-medium">{app.company?.name || "Entreprise"}</span>
                      {" — "}{STATUS_LABELS[app.status]}
                    </p>
                    <span className="text-xs shrink-0" style={{ fontFamily: "var(--font-dm-mono)", color: MUTED }}>
                      {app.sent_at ? new Date(app.sent_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) : "—"}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Campagnes */}
          <Card className="flex flex-col">
            <CardHead title="Campagnes actives" action="+ Nouvelle" href="/campaigns/new" />

            {/* Mini graphe */}
            <div className="px-6 py-5" style={{ borderBottom: `1px solid ${BD}` }}>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-2xl font-bold tracking-tight" style={{ fontFamily: "var(--font-syne)" }}>{stats.total}</p>
                  <p className="text-xs mt-0.5" style={{ color: MUTED }}>candidatures · 7 derniers jours</p>
                </div>
                <div className="flex gap-1">
                  {["7j", "30j"].map((t, i) => (
                    <button key={t} className="px-2.5 py-1 rounded-lg text-xs"
                      style={{ background: i === 0 ? "#111110" : "#F3F2EE", color: i === 0 ? "white" : MUTED }}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-end gap-1.5 h-14">
                {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                    <div className="w-full rounded-sm" style={{ height: 6, background: "#F3F2EE" }} />
                    <span className="text-xs" style={{ fontFamily: "var(--font-dm-mono)", color: MUTED, fontSize: 9 }}>{d}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto">
              <table className="w-full" style={{ borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "#F7F6F3" }}>
                    {["Campagne", "Statut", "Envoyées", "Progression"].map(h => (
                      <th key={h} className="text-left px-5 py-2.5" style={{
                        fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase",
                        color: MUTED, fontWeight: 600, borderBottom: `1px solid ${BD}`
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {campaigns.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center py-12" style={{ color: MUTED }}>
                        <div className="text-3xl mb-2">🚀</div>
                        <p className="text-sm">Aucune campagne — crée-en une !</p>
                      </td>
                    </tr>
                  ) : campaigns.slice(0, 6).map(c => (
                    <tr key={c.id} style={{ borderBottom: `1px solid ${BD}`, cursor: "pointer" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "#F7F6F3")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                      onClick={() => window.location.href = `/campaigns/${c.id}`}
                    >
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-gray-900">{c.job_title}</p>
                        <p className="text-xs mt-0.5" style={{ color: MUTED }}>{c.location} · {CONTRACT_LABELS[c.contract_type]}</p>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium"
                          style={{
                            fontFamily: "var(--font-dm-mono)",
                            background: c.status === "running" ? "#F0FDF4" : "#F3F2EE",
                            color: c.status === "running" ? "#16A34A" : MUTED,
                          }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{
                            background: c.status === "running" ? "#16A34A" : "#C8C7C3"
                          }} />
                          {c.status === "draft" ? "Brouillon" : c.status === "running" ? "En cours" : c.status === "paused" ? "En pause" : "Terminée"}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-medium" style={{ fontFamily: "var(--font-dm-mono)" }}>—</td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1 rounded-full" style={{ background: "#F3F2EE" }}>
                            <div className="h-full rounded-full" style={{ width: "0%", background: O }} />
                          </div>
                          <span className="text-xs" style={{ fontFamily: "var(--font-dm-mono)", color: MUTED }}>0%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="px-5 py-4" style={{ borderTop: `1px solid ${BD}` }}>
              <Link href="/campaigns/new"
                className="flex items-center justify-center w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
                style={{ background: O }}>
                + Créer ma première campagne
              </Link>
            </div>
          </Card>
        </div>

      </div>
    </AppLayout>
  );
}
