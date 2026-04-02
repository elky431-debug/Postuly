"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  BookmarkCheck,
  BriefcaseBusiness,
  Building2,
  ChevronRight,
  ExternalLink,
  Loader2,
  MapPin,
  Search,
  Sparkles,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import type { LbaOffre, LbaRecruteur } from "@/lib/lba";

// ─── Codes ROME disponibles ───────────────────────────────────────────────────

const ROME_CODES = [
  { code: "M1805", label: "Développement web & informatique" },
  { code: "M1806", label: "Consulting & expertise SI" },
  { code: "M1803", label: "Direction des systèmes d'info" },
  { code: "M1802", label: "Expertise technique IT" },
  { code: "D1508", label: "Management & commerce" },
  { code: "M1204", label: "Contrôle de gestion" },
  { code: "M1607", label: "Secrétariat & assistanat" },
  { code: "D1207", label: "Vente & relation client" },
  { code: "K2108", label: "Marketing & communication" },
  { code: "N4301", label: "Logistique & supply chain" },
  { code: "G1201", label: "Accueil & hôtellerie" },
  { code: "H2502", label: "Chaudronnerie industrielle" },
] as const;

const RADIUS_OPTIONS = [10, 20, 30, 50, 100] as const;

// ─── Types locaux ─────────────────────────────────────────────────────────────

type Tab = "recruteurs" | "offres_lba" | "offres_partenaires";

interface SearchResult {
  recruteurs:         (LbaRecruteur & { already_applied: boolean })[];
  offres_lba:         (LbaOffre    & { already_applied: boolean })[];
  offres_partenaires: LbaOffre[];
  cityLabel:          string;
  total:              number;
}

// ─── Sous-composants ──────────────────────────────────────────────────────────

function TabBtn({
  active, onClick, label, count,
}: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-xl px-4 py-2 text-[13px] font-semibold transition-all",
        active
          ? "bg-orange-500 text-white shadow-sm"
          : "bg-white text-stone-500 ring-1 ring-stone-200 hover:bg-orange-50 hover:text-orange-600"
      )}
    >
      {label}
      <span className={cn(
        "rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
        active ? "bg-white/20 text-white" : "bg-stone-100 text-stone-500"
      )}>
        {count}
      </span>
    </button>
  );
}

function RecruteurCard({
  item, romeCode, token, onApplied,
}: {
  item: LbaRecruteur & { already_applied: boolean };
  romeCode: string;
  token: string;
  onApplied: (id: string) => void;
}) {
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [applied, setApplied]   = useState(item.already_applied);

  async function handleApply() {
    if (applied || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/alternance/apply", {
        method:  "POST",
        headers: {
          "Content-Type":  "application/json",
          Authorization:   `Bearer ${token}`,
        },
        body: JSON.stringify({
          jobId:       item.siret || item.id,
          jobType:     "recruteur_lba",
          siret:       item.siret || undefined,
          companyName: item.name,
          romeCode,
          city:        item.address || undefined,
        }),
      });
      if (res.status === 409) { setApplied(true); onApplied(item.id); return; }
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        throw new Error(d.error ?? `HTTP ${res.status}`);
      }
      setApplied(true);
      onApplied(item.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur envoi");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={cn(
      "group flex flex-col rounded-2xl bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,0.05)] ring-1 transition-all",
      applied ? "ring-orange-200" : "ring-stone-100 hover:ring-orange-200 hover:shadow-[0_4px_20px_rgba(249,115,22,0.10)]"
    )}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-[15px] font-bold text-orange-600">
          {item.name[0]?.toUpperCase() ?? "?"}
        </div>
        <div className="flex-1 min-w-0">
          <p className="truncate text-[14px] font-bold text-stone-900">{item.name}</p>
          {item.nafText && (
            <p className="truncate text-[11px] text-stone-400">{item.nafText}</p>
          )}
        </div>
        {/* Badge spontanée */}
        <span className="shrink-0 rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-bold text-orange-500 ring-1 ring-orange-200/60">
          Spontanée
        </span>
      </div>

      {/* Infos */}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        {item.address && (
          <span className="flex items-center gap-1 text-[11px] text-stone-400">
            <MapPin className="h-3 w-3" strokeWidth={2} />
            {item.address}
          </span>
        )}
        {item.distance > 0 && (
          <span className="text-[11px] text-stone-400">
            {item.distance.toFixed(1)} km
          </span>
        )}
        {item.naf && (
          <span className="rounded bg-stone-100 px-1.5 py-0.5 text-[10px] font-medium text-stone-500">
            NAF {item.naf}
          </span>
        )}
      </div>

      {/* Erreur */}
      {error && (
        <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-[11px] text-red-600">{error}</p>
      )}

      {/* Actions */}
      <div className="mt-4 flex items-center gap-2">
        {applied ? (
          <div className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-orange-50 py-2.5 text-[12px] font-semibold text-orange-500 ring-1 ring-orange-200/60">
            <BookmarkCheck className="h-4 w-4" strokeWidth={2} />
            Candidature envoyée
          </div>
        ) : (
          <button
            type="button"
            onClick={handleApply}
            disabled={loading}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-orange-500 py-2.5 text-[12px] font-semibold text-white transition hover:bg-orange-600 disabled:opacity-70"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>Postuler <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.5} /></>
            )}
          </button>
        )}
        {item.url && (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-stone-100 text-stone-400 transition hover:bg-orange-50 hover:text-orange-500"
          >
            <ExternalLink className="h-4 w-4" strokeWidth={2} />
          </a>
        )}
      </div>
    </div>
  );
}

function OffreCard({
  item, romeCode, token, onApplied,
}: {
  item: LbaOffre & { already_applied?: boolean };
  romeCode: string;
  token: string;
  onApplied: (id: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [applied, setApplied] = useState(item.already_applied ?? false);
  const isPartner = item.type === "offre_partenaire";

  async function handleApply() {
    if (applied || loading || isPartner) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/alternance/apply", {
        method:  "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization:  `Bearer ${token}`,
        },
        body: JSON.stringify({
          jobId:       item.id,
          jobType:     "offre_lba",
          siret:       item.siret || undefined,
          companyName: item.companyName,
          romeCode,
          city:        item.city || undefined,
        }),
      });
      if (res.status === 409) { setApplied(true); onApplied(item.id); return; }
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        throw new Error(d.error ?? `HTTP ${res.status}`);
      }
      setApplied(true);
      onApplied(item.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur envoi");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={cn(
      "flex flex-col rounded-2xl bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,0.05)] ring-1 transition-all",
      applied ? "ring-orange-200" : "ring-stone-100 hover:ring-orange-200 hover:shadow-[0_4px_20px_rgba(249,115,22,0.10)]"
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-100">
          <BriefcaseBusiness className="h-5 w-5 text-orange-500" strokeWidth={2} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="truncate text-[14px] font-bold text-stone-900">{item.title}</p>
          <p className="truncate text-[11px] text-stone-500">{item.companyName}</p>
        </div>
        {isPartner && (
          <span className="shrink-0 rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-semibold text-stone-500">
            France Travail
          </span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        {item.city && (
          <span className="flex items-center gap-1 text-[11px] text-stone-400">
            <MapPin className="h-3 w-3" strokeWidth={2} />
            {item.city}
          </span>
        )}
        {item.contractDuration && (
          <span className="text-[11px] text-stone-400">{item.contractDuration}</span>
        )}
      </div>

      {item.description && (
        <p className="mt-2 line-clamp-2 text-[11.5px] leading-relaxed text-stone-400">
          {item.description}
        </p>
      )}

      {error && (
        <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-[11px] text-red-600">{error}</p>
      )}

      <div className="mt-4 flex items-center gap-2">
        {isPartner ? (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-orange-500 py-2.5 text-[12px] font-semibold text-white transition hover:bg-orange-600"
          >
            Voir l'offre <ExternalLink className="h-3.5 w-3.5" strokeWidth={2} />
          </a>
        ) : applied ? (
          <div className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-orange-50 py-2.5 text-[12px] font-semibold text-orange-500 ring-1 ring-orange-200/60">
            <BookmarkCheck className="h-4 w-4" strokeWidth={2} />
            Candidature envoyée
          </div>
        ) : (
          <button
            type="button"
            onClick={handleApply}
            disabled={loading}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-orange-500 py-2.5 text-[12px] font-semibold text-white transition hover:bg-orange-600 disabled:opacity-70"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>Postuler <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.5} /></>
            )}
          </button>
        )}
        {item.url && !isPartner && (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-stone-100 text-stone-400 transition hover:bg-orange-50 hover:text-orange-500"
          >
            <ExternalLink className="h-4 w-4" strokeWidth={2} />
          </a>
        )}
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center py-16 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-100">
        <Building2 className="h-6 w-6 text-orange-400" strokeWidth={1.5} />
      </div>
      <p className="text-[14px] font-medium text-stone-500">{message}</p>
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────

export function AlternancePage() {
  const [token, setToken]       = useState("");
  const [rome, setRome]         = useState<string>(ROME_CODES[0].code);
  const [city, setCity]         = useState("");
  const [radius, setRadius]     = useState<number>(30);
  const [loading, setLoading]   = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [result, setResult]     = useState<SearchResult | null>(null);
  const [tab, setTab]           = useState<Tab>("recruteurs");
  const inputRef                = useRef<HTMLInputElement>(null);

  // Récupérer le token
  useEffect(() => {
    const supabase = createClient();
    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setToken(session.access_token);
    });
  }, []);

  const handleSearch = useCallback(async () => {
    if (!city.trim()) {
      inputRef.current?.focus();
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ rome, city: city.trim(), radius: String(radius) });
      const res = await fetch(`/api/alternance/search?${params}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json() as SearchResult & { error?: string };
      if (data.error && !res.ok) {
        setError(data.error);
      } else {
        setResult(data);
        setSearched(true);
        setTab("recruteurs");
      }
    } catch {
      setError("Impossible de joindre l'API. Vérifie ta connexion.");
    } finally {
      setLoading(false);
    }
  }, [rome, city, radius, token]);

  function markApplied(id: string) {
    if (!result) return;
    setResult({
      ...result,
      recruteurs:  result.recruteurs.map((r)  => r.id === id ? { ...r, already_applied: true } : r),
      offres_lba:  result.offres_lba.map((o)  => o.id === id ? { ...o, already_applied: true } : o),
    });
  }

  const counts = {
    recruteurs:         result?.recruteurs.length         ?? 0,
    offres_lba:         result?.offres_lba.length         ?? 0,
    offres_partenaires: result?.offres_partenaires.length ?? 0,
  };

  return (
    <div className="mx-auto max-w-[1280px] px-7 pb-16 pt-7 xl:px-10">

      {/* ── Intro ──────────────────────────────────────────────────────── */}
      <div className="mb-7 flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-orange-100">
          <Sparkles className="h-6 w-6 text-orange-500" strokeWidth={2} />
        </div>
        <div>
          <h2 className="text-[18px] font-bold text-stone-900">La Bonne Alternance</h2>
          <p className="mt-0.5 text-[13px] text-stone-400">
            Accède aux entreprises qui recrutent en alternance — y compris celles qui n'ont pas posté d'offre.
          </p>
        </div>
      </div>

      {/* ── Formulaire de recherche ─────────────────────────────────────── */}
      <div className="mb-8 rounded-2xl bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,0.05)] ring-1 ring-stone-100">
        <div className="flex flex-wrap gap-3">

          {/* ROME */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-[0.1em] text-stone-400">
              Secteur (code ROME)
            </label>
            <select
              value={rome}
              onChange={(e) => setRome(e.target.value)}
              className="h-10 min-w-[220px] rounded-xl border-0 bg-stone-50 px-3 text-[13px] font-medium text-stone-800 ring-1 ring-stone-200 focus:outline-none focus:ring-2 focus:ring-orange-400"
            >
              {ROME_CODES.map(({ code, label }) => (
                <option key={code} value={code}>{code} – {label}</option>
              ))}
            </select>
          </div>

          {/* Ville */}
          <div className="flex flex-1 flex-col gap-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-[0.1em] text-stone-400">
              Ville ou zone
            </label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" strokeWidth={2} />
              <input
                ref={inputRef}
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void handleSearch()}
                placeholder="Paris, Lyon, Bordeaux…"
                className="h-10 w-full rounded-xl bg-stone-50 py-2 pl-9 pr-3 text-[13px] text-stone-800 ring-1 ring-stone-200 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>
          </div>

          {/* Rayon */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-[0.1em] text-stone-400">
              Rayon
            </label>
            <select
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
              className="h-10 w-24 rounded-xl border-0 bg-stone-50 px-3 text-[13px] font-medium text-stone-800 ring-1 ring-stone-200 focus:outline-none focus:ring-2 focus:ring-orange-400"
            >
              {RADIUS_OPTIONS.map((r) => (
                <option key={r} value={r}>{r} km</option>
              ))}
            </select>
          </div>

          {/* Bouton */}
          <div className="flex flex-col justify-end gap-1.5">
            <div className="h-[22px]" />
            <button
              type="button"
              onClick={() => void handleSearch()}
              disabled={loading}
              className="flex h-10 items-center gap-2 rounded-xl bg-orange-500 px-5 text-[13px] font-semibold text-white transition hover:bg-orange-600 disabled:opacity-70"
            >
              {loading
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Search className="h-4 w-4" strokeWidth={2} />}
              {loading ? "Recherche…" : "Rechercher"}
            </button>
          </div>
        </div>

        {error && (
          <p className="mt-3 rounded-xl bg-red-50 px-4 py-2.5 text-[12px] text-red-600">{error}</p>
        )}
      </div>

      {/* ── Résultats ───────────────────────────────────────────────────── */}
      {searched && result && (
        <>
          {/* Résumé */}
          <div className="mb-5 flex items-center justify-between">
            <p className="text-[13px] text-stone-500">
              <span className="font-bold text-orange-500 tabular-nums">{result.total}</span>
              {" "}opportunité{result.total !== 1 ? "s" : ""} autour de{" "}
              <span className="font-semibold text-stone-700">{result.cityLabel || city}</span>
            </p>

            {/* Tabs */}
            <div className="flex items-center gap-2">
              <TabBtn
                active={tab === "recruteurs"}
                onClick={() => setTab("recruteurs")}
                label="Recruteurs LBA"
                count={counts.recruteurs}
              />
              <TabBtn
                active={tab === "offres_lba"}
                onClick={() => setTab("offres_lba")}
                label="Offres LBA"
                count={counts.offres_lba}
              />
              <TabBtn
                active={tab === "offres_partenaires"}
                onClick={() => setTab("offres_partenaires")}
                label="France Travail"
                count={counts.offres_partenaires}
              />
            </div>
          </div>

          {/* Tip recruteurs */}
          {tab === "recruteurs" && counts.recruteurs > 0 && (
            <div className="mb-5 flex items-start gap-3 rounded-xl bg-orange-50 px-4 py-3 ring-1 ring-orange-200/60">
              <Users className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" strokeWidth={2} />
              <p className="text-[12px] text-orange-700">
                <span className="font-bold">Recruteurs LBA</span> — Ces entreprises ont été identifiées
                par algorithme comme ayant un fort potentiel de recrutement en alternance
                mais n'ont pas posté d'offre. Envoie une candidature spontanée directement
                depuis Postuly.
              </p>
            </div>
          )}

          {/* Grille de cartes */}
          {tab === "recruteurs" && (
            counts.recruteurs === 0
              ? <EmptyState message="Aucun recruteur LBA trouvé dans cette zone. Essaie un rayon plus large ou un autre secteur." />
              : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {result.recruteurs.map((item) => (
                    <RecruteurCard
                      key={item.id}
                      item={item}
                      romeCode={rome}
                      token={token}
                      onApplied={markApplied}
                    />
                  ))}
                </div>
              )
          )}

          {tab === "offres_lba" && (
            counts.offres_lba === 0
              ? <EmptyState message="Aucune offre LBA directe pour ce secteur. Consulte les recruteurs LBA pour des candidatures spontanées." />
              : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {result.offres_lba.map((item) => (
                    <OffreCard
                      key={item.id}
                      item={item}
                      romeCode={rome}
                      token={token}
                      onApplied={markApplied}
                    />
                  ))}
                </div>
              )
          )}

          {tab === "offres_partenaires" && (
            counts.offres_partenaires === 0
              ? <EmptyState message="Aucune offre partenaire France Travail pour ce secteur." />
              : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {result.offres_partenaires.map((item) => (
                    <OffreCard
                      key={item.id}
                      item={item as LbaOffre & { already_applied?: boolean }}
                      romeCode={rome}
                      token={token}
                      onApplied={markApplied}
                    />
                  ))}
                </div>
              )
          )}
        </>
      )}

      {/* ── État vide initial ────────────────────────────────────────────── */}
      {!searched && !loading && (
        <div className="flex flex-col items-center py-20 text-center">
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-orange-100">
            <Search className="h-7 w-7 text-orange-400" strokeWidth={1.5} />
          </div>
          <p className="text-[15px] font-semibold text-stone-700">Lance une recherche</p>
          <p className="mt-1.5 max-w-sm text-[13px] text-stone-400">
            Choisis ton secteur ROME, entre une ville et clique sur Rechercher pour
            découvrir les entreprises qui recrutent — même celles sans offre publiée.
          </p>
        </div>
      )}
    </div>
  );
}
