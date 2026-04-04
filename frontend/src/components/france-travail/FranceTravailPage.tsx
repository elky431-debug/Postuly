"use client";

import { useState, useCallback, useRef } from "react";
import {
  Search, MapPin, Briefcase, Clock, Euro, ChevronDown, ChevronUp,
  ExternalLink, Phone, Mail, Users, Star, Award, BookOpen,
  Car, Languages, Accessibility, CalendarDays, Building2,
} from "lucide-react";
import type { FTOffre } from "@/app/api/france-travail/search/route";

// ─── Constantes ──────────────────────────────────────────────────────────────

const CONTRAT_OPTIONS = [
  { value: "", label: "Tous types" },
  { value: "CDI", label: "CDI" },
  { value: "CDD", label: "CDD" },
  { value: "MIS", label: "Intérim" },
  { value: "SAI", label: "Saisonnier" },
  { value: "PRO", label: "Professionnalisation" },
  { value: "REP", label: "Reprise d'entreprise" },
  { value: "DEA", label: "Détachement" },
];

const EXPERIENCE_OPTIONS = [
  { value: "", label: "Toute expérience" },
  { value: "1", label: "Débutant accepté" },
  { value: "2", label: "1 à 3 ans" },
  { value: "3", label: "3 ans et plus" },
];

const CONTRAT_COLORS: Record<string, string> = {
  CDI: "bg-emerald-50 text-emerald-700 border-emerald-200",
  CDD: "bg-blue-50 text-blue-700 border-blue-200",
  MIS: "bg-violet-50 text-violet-700 border-violet-200",
  SAI: "bg-amber-50 text-amber-700 border-amber-200",
  PRO: "bg-orange-50 text-orange-700 border-orange-200",
  ALT: "bg-orange-50 text-orange-700 border-orange-200",
};

function contractColor(type: string) {
  return CONTRAT_COLORS[type] ?? "bg-stone-50 text-stone-700 border-stone-200";
}

function formatDate(iso: string): string {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

// ─── CompanyLogo inline ───────────────────────────────────────────────────────

const PALETTE = ["#F97316","#3B82F6","#10B981","#8B5CF6","#EC4899","#F59E0B","#14B8A6"];
function hashColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  return PALETTE[Math.abs(h) % PALETTE.length];
}
function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
}

function CompanyAvatar({ offre }: { offre: FTOffre }) {
  const [failed, setFailed] = useState(false);
  const name = offre.entreprise ?? "?";
  const bg = hashColor(name);

  if (offre.logoUrl && !failed) {
    return (
      <img
        src={offre.logoUrl}
        alt={name}
        className="h-12 w-12 rounded-xl object-contain bg-white border border-stone-100 p-1"
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <div
      className="h-12 w-12 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0"
      style={{ backgroundColor: bg }}
    >
      {initials(name).toUpperCase() || "?"}
    </div>
  );
}

// ─── Carte offre ─────────────────────────────────────────────────────────────

function OffreCard({ offre }: { offre: FTOffre }) {
  const [expanded, setExpanded] = useState(false);
  const descPreview = offre.description.slice(0, 300).replace(/\n+/g, " ");
  const hasMore = offre.description.length > 300;
  const applyUrl = offre.urlPostulation ?? offre.urlFranceTravail;

  return (
    <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="p-5">
        <div className="flex items-start gap-4">
          <CompanyAvatar offre={offre} />

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-semibold text-stone-900 text-[15px] leading-snug">{offre.titre}</h3>
                {offre.entreprise && (
                  <p className="mt-0.5 text-sm text-stone-500 font-medium">{offre.entreprise}</p>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5 shrink-0">
                <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${contractColor(offre.typeContrat)}`}>
                  {offre.typeContratLibelle || offre.typeContrat}
                </span>
                {offre.alternance && (
                  <span className="rounded-full border px-2.5 py-0.5 text-[11px] font-semibold bg-orange-50 text-orange-700 border-orange-200">
                    Alternance
                  </span>
                )}
                {offre.accessibleTH && (
                  <span title="Accessible aux travailleurs handicapés" className="rounded-full border px-2.5 py-0.5 text-[11px] font-semibold bg-blue-50 text-blue-700 border-blue-200">
                    TH
                  </span>
                )}
              </div>
            </div>

            {/* Meta row */}
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-500">
              {offre.lieu && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3 shrink-0" />
                  {offre.lieu}
                </span>
              )}
              {offre.salaire && (
                <span className="flex items-center gap-1">
                  <Euro className="h-3 w-3 shrink-0" />
                  {offre.salaire}
                </span>
              )}
              {offre.dureeTravail && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3 shrink-0" />
                  {offre.dureeTravail}
                </span>
              )}
              {offre.experienceLibelle && (
                <span className="flex items-center gap-1">
                  <Briefcase className="h-3 w-3 shrink-0" />
                  {offre.experienceLibelle}
                </span>
              )}
              {offre.nombrePostes > 1 && (
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3 shrink-0" />
                  {offre.nombrePostes} postes
                </span>
              )}
              {offre.dateCreation && (
                <span className="flex items-center gap-1 ml-auto">
                  <CalendarDays className="h-3 w-3 shrink-0" />
                  {formatDate(offre.dateCreation)}
                </span>
              )}
            </div>

            {/* Salary comment */}
            {offre.salaireCommentaire && (
              <p className="mt-1.5 text-xs text-stone-400">{offre.salaireCommentaire}</p>
            )}
          </div>
        </div>

        {/* Description preview */}
        {offre.description && (
          <div className="mt-4">
            <p className="text-sm text-stone-600 leading-relaxed whitespace-pre-line">
              {expanded ? offre.description : descPreview}
              {!expanded && hasMore && "…"}
            </p>
          </div>
        )}

        {/* Chips rapides */}
        {!expanded && offre.competences.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {offre.competences.slice(0, 5).map((c) => (
              <span key={c} className="rounded-full bg-stone-100 px-2.5 py-0.5 text-[11px] text-stone-600 font-medium">
                {c}
              </span>
            ))}
            {offre.competences.length > 5 && (
              <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-[11px] text-stone-500">
                +{offre.competences.length - 5}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Section détails (expandable) */}
      {expanded && (
        <div className="border-t border-stone-100 px-5 py-4 bg-stone-50/50 space-y-4">

          {offre.secteurActiviteLibelle && (
            <div className="flex items-center gap-2 text-sm text-stone-600">
              <Building2 className="h-4 w-4 text-stone-400 shrink-0" />
              <span>Secteur : <strong>{offre.secteurActiviteLibelle}</strong></span>
            </div>
          )}

          {offre.competences.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Star className="h-3.5 w-3.5" /> Compétences requises
              </p>
              <div className="flex flex-wrap gap-1.5">
                {offre.competences.map((c) => (
                  <span key={c} className="rounded-full bg-blue-50 border border-blue-100 px-2.5 py-0.5 text-[11px] text-blue-700 font-medium">
                    {c}
                  </span>
                ))}
              </div>
            </div>
          )}

          {offre.qualitesPro.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Award className="h-3.5 w-3.5" /> Qualités professionnelles
              </p>
              <div className="flex flex-wrap gap-1.5">
                {offre.qualitesPro.map((q) => (
                  <span key={q} className="rounded-full bg-emerald-50 border border-emerald-100 px-2.5 py-0.5 text-[11px] text-emerald-700 font-medium">
                    {q}
                  </span>
                ))}
              </div>
            </div>
          )}

          {offre.formations.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <BookOpen className="h-3.5 w-3.5" /> Formation souhaitée
              </p>
              <ul className="space-y-0.5">
                {offre.formations.map((f) => (
                  <li key={f} className="text-sm text-stone-600">• {f}</li>
                ))}
              </ul>
            </div>
          )}

          {(offre.permis.length > 0 || offre.langues.length > 0) && (
            <div className="flex flex-wrap gap-6">
              {offre.permis.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                    <Car className="h-3.5 w-3.5" /> Permis
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {offre.permis.map((p) => (
                      <span key={p} className="rounded bg-amber-50 border border-amber-100 px-2 py-0.5 text-[11px] text-amber-700 font-medium">{p}</span>
                    ))}
                  </div>
                </div>
              )}
              {offre.langues.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                    <Languages className="h-3.5 w-3.5" /> Langues
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {offre.langues.map((l) => (
                      <span key={l} className="rounded bg-violet-50 border border-violet-100 px-2 py-0.5 text-[11px] text-violet-700 font-medium">{l}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {offre.accessibleTH && (
            <div className="flex items-center gap-2 text-sm text-blue-600">
              <Accessibility className="h-4 w-4 shrink-0" />
              Poste accessible aux personnes en situation de handicap
            </div>
          )}

          {/* Contact */}
          {(offre.telContact || offre.emailContact) && (
            <div className="border-t border-stone-200 pt-3 flex flex-wrap gap-4">
              {offre.telContact && (
                <a href={`tel:${offre.telContact}`} className="flex items-center gap-1.5 text-sm text-stone-600 hover:text-orange-600 transition-colors">
                  <Phone className="h-3.5 w-3.5" />
                  {offre.telContact}
                </a>
              )}
              {offre.emailContact && (
                <a href={`mailto:${offre.emailContact}`} className="flex items-center gap-1.5 text-sm text-stone-600 hover:text-orange-600 transition-colors">
                  <Mail className="h-3.5 w-3.5" />
                  {offre.emailContact}
                </a>
              )}
            </div>
          )}
        </div>
      )}

      {/* Footer actions */}
      <div className="px-5 py-3 border-t border-stone-100 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1 text-xs text-stone-500 hover:text-stone-700 transition-colors"
        >
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          {expanded ? "Réduire" : "Voir les détails"}
        </button>

        <a
          href={applyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 rounded-lg bg-orange-500 px-4 py-2 text-xs font-semibold text-white hover:bg-orange-600 transition-colors"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          {offre.urlPostulation ? "Postuler" : "Voir l'offre"}
        </a>
      </div>
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────

export function FranceTravailPage() {
  const [keywords, setKeywords] = useState("");
  const [ville, setVille] = useState("");
  const [contrat, setContrat] = useState("");
  const [experience, setExperience] = useState("");
  const [offres, setOffres] = useState<FTOffre[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const search = useCallback(async (p = 0) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setLoading(true);
    setError(null);
    if (p === 0) setOffres([]);

    try {
      const params = new URLSearchParams();
      if (keywords.trim()) params.set("keywords", keywords.trim());
      if (ville.trim()) params.set("ville", ville.trim());
      if (contrat) params.set("contrat", contrat);
      if (experience) params.set("experience", experience);
      params.set("page", String(p));

      const res = await fetch(`/api/france-travail/search?${params.toString()}`, {
        signal: ctrl.signal,
      });
      const data = (await res.json()) as { offres: FTOffre[]; total: number; error?: string };

      if (data.error) { setError(data.error); return; }
      setOffres(data.offres);
      setTotal(data.total);
      setPage(p);
      setSearched(true);
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      setError("Erreur de connexion.");
    } finally {
      setLoading(false);
    }
  }, [keywords, ville, contrat, experience]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    search(0);
  }

  return (
    <div className="min-h-screen bg-[#F7F6F3]">
      {/* Hero search */}
      <div className="bg-white border-b border-stone-200 px-6 py-8">
        <div className="mx-auto max-w-4xl">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-stone-900">Offres France Travail</h1>
            <p className="mt-1 text-sm text-stone-500">
              Accès direct aux offres d'emploi officielles de France Travail (ex Pôle Emploi)
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            {/* Keywords */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Métier, poste, compétence…"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-stone-200 bg-stone-50 text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
              />
            </div>

            {/* Ville */}
            <div className="sm:w-48 relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Ville, département…"
                value={ville}
                onChange={(e) => setVille(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-stone-200 bg-stone-50 text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
              />
            </div>

            {/* Contrat */}
            <select
              value={contrat}
              onChange={(e) => setContrat(e.target.value)}
              className="sm:w-40 px-3 py-2.5 rounded-xl border border-stone-200 bg-stone-50 text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-orange-400"
            >
              {CONTRAT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>

            {/* Expérience */}
            <select
              value={experience}
              onChange={(e) => setExperience(e.target.value)}
              className="sm:w-44 px-3 py-2.5 rounded-xl border border-stone-200 bg-stone-50 text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-orange-400"
            >
              {EXPERIENCE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>

            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 rounded-xl bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 disabled:opacity-60 transition-colors whitespace-nowrap"
            >
              {loading ? "Recherche…" : "Rechercher"}
            </button>
          </form>
        </div>
      </div>

      {/* Results */}
      <div className="mx-auto max-w-4xl px-6 py-6">
        {error && (
          <div className="mb-4 rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">{error}</div>
        )}

        {searched && !loading && (
          <p className="mb-4 text-sm text-stone-500">
            {total === 0 ? "Aucune offre trouvée." : `${total.toLocaleString("fr-FR")} offre${total > 1 ? "s" : ""} trouvée${total > 1 ? "s" : ""}`}
          </p>
        )}

        {loading && (
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-stone-200 p-5 animate-pulse">
                <div className="flex gap-4">
                  <div className="h-12 w-12 rounded-xl bg-stone-200" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-2/3 rounded bg-stone-200" />
                    <div className="h-3 w-1/3 rounded bg-stone-100" />
                    <div className="h-3 w-1/2 rounded bg-stone-100" />
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  <div className="h-3 w-full rounded bg-stone-100" />
                  <div className="h-3 w-4/5 rounded bg-stone-100" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && offres.length > 0 && (
          <>
            <div className="space-y-4">
              {offres.map((offre) => (
                <OffreCard key={offre.id} offre={offre} />
              ))}
            </div>

            {/* Pagination */}
            <div className="mt-8 flex items-center justify-center gap-3">
              {page > 0 && (
                <button
                  type="button"
                  onClick={() => search(page - 1)}
                  className="rounded-lg border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 transition-colors"
                >
                  ← Précédent
                </button>
              )}
              <span className="text-sm text-stone-500">
                Page {page + 1} · {offres.length} offres
              </span>
              {offres.length === 20 && (page + 1) * 20 < total && (
                <button
                  type="button"
                  onClick={() => search(page + 1)}
                  className="rounded-lg border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 transition-colors"
                >
                  Suivant →
                </button>
              )}
            </div>
          </>
        )}

        {!loading && searched && offres.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-stone-100">
              <Search className="h-8 w-8 text-stone-400" />
            </div>
            <h2 className="mt-4 text-base font-semibold text-stone-700">Aucune offre trouvée</h2>
            <p className="mt-1.5 max-w-xs text-sm text-stone-400">
              Essaie d'élargir ta recherche ou de changer les filtres.
            </p>
          </div>
        )}

        {!searched && !loading && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-50">
              <Search className="h-8 w-8 text-orange-400" />
            </div>
            <h2 className="mt-4 text-base font-semibold text-stone-700">Lance une recherche</h2>
            <p className="mt-1.5 max-w-xs text-sm text-stone-400">
              Entre un métier, une ville ou un type de contrat pour voir les offres France Travail.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
