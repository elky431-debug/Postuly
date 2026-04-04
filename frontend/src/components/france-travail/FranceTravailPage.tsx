"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  Search, MapPin, Briefcase, Clock, Euro, ChevronDown, ChevronUp,
  ExternalLink, Phone, Mail, Users, Star, Award, BookOpen,
  Car, Languages, Accessibility, CalendarDays, Building2,
  Sparkles, Copy, Check, X, Send, Zap,
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import type { FTOffre } from "@/app/api/france-travail/search/route";

// ─── Constantes ──────────────────────────────────────────────────────────────

const CONTRAT_OPTIONS = [
  { value: "", label: "Tous types" },
  { value: "CDI", label: "CDI" },
  { value: "CDD", label: "CDD" },
  { value: "MIS", label: "Intérim" },
  { value: "SAI", label: "Saisonnier" },
  { value: "PRO", label: "Professionnalisation" },
];

const EXPERIENCE_OPTIONS = [
  { value: "", label: "Toute expérience" },
  { value: "1", label: "Débutant accepté" },
  { value: "2", label: "1 à 3 ans" },
  { value: "3", label: "3 ans et plus" },
];

const DATE_OPTIONS = [
  { value: "", label: "Toutes dates" },
  { value: "today", label: "Aujourd'hui" },
  { value: "week", label: "Cette semaine" },
  { value: "month", label: "Ce mois" },
];

const TEMPS_OPTIONS = [
  { value: "", label: "Temps plein & partiel" },
  { value: "true", label: "Temps plein" },
  { value: "false", label: "Temps partiel" },
];

const CONTRAT_COLORS: Record<string, string> = {
  CDI: "bg-emerald-50 text-emerald-700 border-emerald-200",
  CDD: "bg-blue-50 text-blue-700 border-blue-200",
  MIS: "bg-violet-50 text-violet-700 border-violet-200",
  SAI: "bg-amber-50 text-amber-700 border-amber-200",
  PRO: "bg-orange-50 text-orange-700 border-orange-200",
};

function contractColor(type: string) {
  return CONTRAT_COLORS[type] ?? "bg-stone-50 text-stone-700 border-stone-200";
}

function formatDate(iso: string): string {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
  } catch { return iso.slice(0, 10); }
}

// ─── Logo entreprise ──────────────────────────────────────────────────────────

const PALETTE = ["#F97316","#3B82F6","#10B981","#8B5CF6","#EC4899","#F59E0B","#14B8A6"];
function hashColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  return PALETTE[Math.abs(h) % PALETTE.length];
}
function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

function CompanyAvatar({ offre, size = "md" }: { offre: FTOffre; size?: "sm" | "md" | "lg" }) {
  const [failed, setFailed] = useState(false);
  const name = offre.entreprise ?? "?";
  const bg = hashColor(name);
  const dim = size === "sm" ? "h-9 w-9 text-xs" : size === "lg" ? "h-16 w-16 text-base" : "h-12 w-12 text-sm";

  if (offre.logoUrl && !failed) {
    return (
      <img
        src={offre.logoUrl}
        alt={name}
        className={`${dim} rounded-xl object-contain bg-white border border-stone-100 p-1 shrink-0`}
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <div className={`${dim} rounded-xl flex items-center justify-center text-white font-bold shrink-0`} style={{ backgroundColor: bg }}>
      {getInitials(name)}
    </div>
  );
}

// ─── Modal candidature rapide ─────────────────────────────────────────────────

function ApplyModal({ offre, onClose }: { offre: FTOffre; onClose: () => void }) {
  const [letter, setLetter] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [gmailRequired, setGmailRequired] = useState(false);

  // Fermer avec Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  async function generateLetter() {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch("/api/alternance/generate-letter", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          companyName: offre.entreprise ?? "l'entreprise",
          nafText: offre.secteurActiviteLibelle ?? undefined,
          address: offre.lieu ?? undefined,
          jobTitle: offre.titre,
          jobDescription: offre.description?.slice(0, 600),
          contratType: offre.typeContrat ?? "CDI",
        }),
        signal: AbortSignal.timeout(30_000),
      });

      const data = (await res.json()) as { letter?: string; error?: string };
      if (data.error) { setError(data.error); return; }
      setLetter(data.letter ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de génération");
    } finally {
      setLoading(false);
    }
  }

  function copyLetter() {
    void navigator.clipboard.writeText(letter).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  async function sendDirectly() {
    if (!offre.emailContact) return;
    if (!letter.trim()) { setError("Génère ou écris une lettre avant d'envoyer."); return; }
    setSending(true);
    setError(null);
    setGmailRequired(false);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch("/api/france-travail/apply", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          to: offre.emailContact,
          subject: `Candidature – ${offre.titre}${offre.entreprise ? ` – ${offre.entreprise}` : ""}`,
          letter,
        }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string; gmailRequired?: boolean };
      if (data.gmailRequired) { setGmailRequired(true); return; }
      if (data.error) { setError(data.error); return; }
      setSuccess(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur d'envoi");
    } finally {
      setSending(false);
    }
  }

  function applyByMailto() {
    const subject = encodeURIComponent(`Candidature – ${offre.titre}${offre.entreprise ? ` – ${offre.entreprise}` : ""}`);
    const body = encodeURIComponent(letter || `Bonjour,\n\nJe souhaite postuler au poste de ${offre.titre}.\n\nCordialement`);
    window.open(`mailto:${offre.emailContact ?? ""}?subject=${subject}&body=${body}`, "_blank");
    setSuccess(true);
  }

  const applyUrl = offre.urlPostulation ?? offre.urlFranceTravail;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start gap-4 p-6 border-b border-stone-100">
          <CompanyAvatar offre={offre} size="lg" />
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-stone-900 text-lg leading-snug">{offre.titre}</h2>
            {offre.entreprise && <p className="text-stone-500 text-sm mt-0.5">{offre.entreprise}</p>}
            <div className="flex flex-wrap gap-2 mt-2">
              <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${contractColor(offre.typeContrat)}`}>
                {offre.typeContratLibelle || offre.typeContrat}
              </span>
              {offre.lieu && (
                <span className="flex items-center gap-1 text-xs text-stone-500">
                  <MapPin className="h-3 w-3" />{offre.lieu}
                </span>
              )}
              {offre.salaire && (
                <span className="flex items-center gap-1 text-xs text-stone-500">
                  <Euro className="h-3 w-3" />{offre.salaire}
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-stone-400 hover:bg-stone-100 hover:text-stone-600 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Corps */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {success ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 mb-4">
                <Check className="h-8 w-8 text-emerald-500" />
              </div>
              <h3 className="font-semibold text-stone-900 text-lg">Candidature envoyée !</h3>
              <p className="text-stone-500 text-sm mt-1">Email envoyé depuis ton Gmail avec ta lettre et ton CV en pièce jointe.</p>
              <button onClick={onClose} className="mt-6 px-5 py-2 rounded-xl bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 transition-colors">
                Fermer
              </button>
            </div>
          ) : (
            <>
              {/* Lettre de motivation */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-semibold text-stone-700">Lettre de motivation</label>
                  <button
                    type="button"
                    onClick={generateLetter}
                    disabled={loading}
                    className="flex items-center gap-1.5 rounded-lg bg-orange-50 border border-orange-200 px-3 py-1.5 text-xs font-semibold text-orange-700 hover:bg-orange-100 disabled:opacity-60 transition-colors"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    {loading ? "Génération…" : "Générer avec l'IA"}
                  </button>
                </div>
                {error && <p className="mb-2 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
                <textarea
                  value={letter}
                  onChange={(e) => setLetter(e.target.value)}
                  placeholder="Clique sur « Générer avec l'IA » pour rédiger une lettre personnalisée basée sur ton profil et l'offre, ou écris ta propre lettre…"
                  rows={12}
                  className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none leading-relaxed"
                />
                {letter && (
                  <button
                    type="button"
                    onClick={copyLetter}
                    className="mt-1.5 flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-700 transition-colors"
                  >
                    {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? "Copié !" : "Copier la lettre"}
                  </button>
                )}
              </div>

              {/* Gmail requis */}
              {gmailRequired && (
                <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
                  <p className="font-medium">Gmail non connecté</p>
                  <p className="mt-0.5 text-xs">Connecte ton Gmail dans <a href="/dashboard/parametres" className="underline font-medium">Paramètres</a> pour envoyer directement. Sinon utilise "Ouvrir dans ma messagerie".</p>
                </div>
              )}

              {/* Contact info */}
              {(offre.telContact || offre.emailContact) && (
                <div className="rounded-xl bg-stone-50 border border-stone-100 p-3 flex flex-wrap gap-3">
                  {offre.telContact && (
                    <a href={`tel:${offre.telContact}`} className="flex items-center gap-1.5 text-sm text-stone-600 hover:text-orange-600 transition-colors">
                      <Phone className="h-3.5 w-3.5" />{offre.telContact}
                    </a>
                  )}
                  {offre.emailContact && (
                    <span className="flex items-center gap-1.5 text-sm text-stone-600">
                      <Mail className="h-3.5 w-3.5" />{offre.emailContact}
                    </span>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer actions */}
        {!success && (
          <div className="flex items-center justify-between gap-3 p-6 border-t border-stone-100 bg-stone-50/50">
            <a
              href={offre.urlFranceTravail}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-700 transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Voir l'offre officielle
            </a>

            <div className="flex flex-wrap gap-2">
              {offre.emailContact && (
                <>
                  <button
                    type="button"
                    onClick={sendDirectly}
                    disabled={sending || !letter.trim()}
                    className="flex items-center gap-1.5 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50 transition-colors"
                  >
                    <Send className="h-4 w-4" />
                    {sending ? "Envoi…" : "Envoyer via Gmail"}
                  </button>
                  <button
                    type="button"
                    onClick={applyByMailto}
                    className="flex items-center gap-1.5 rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-semibold text-stone-700 hover:bg-stone-50 transition-colors"
                  >
                    <Mail className="h-4 w-4" />
                    Ouvrir dans ma messagerie
                  </button>
                </>
              )}
              {!offre.emailContact && (
                <a
                  href={applyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 transition-colors"
                >
                  <Zap className="h-4 w-4" />
                  {offre.urlPostulation ? "Postuler en ligne" : "Postuler sur France Travail"}
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Carte offre ─────────────────────────────────────────────────────────────

function OffreCard({ offre, onApply }: { offre: FTOffre; onApply: (o: FTOffre) => void }) {
  const [expanded, setExpanded] = useState(false);
  const descPreview = offre.description.slice(0, 280).replace(/\n+/g, " ");
  const hasMore = offre.description.length > 280;

  return (
    <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
      <div className="p-5">
        <div className="flex items-start gap-4">
          <CompanyAvatar offre={offre} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-semibold text-stone-900 text-[15px] leading-snug">{offre.titre}</h3>
                {offre.entreprise && <p className="mt-0.5 text-sm text-stone-500 font-medium">{offre.entreprise}</p>}
              </div>
              <div className="flex flex-wrap gap-1.5 shrink-0">
                <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${contractColor(offre.typeContrat)}`}>
                  {offre.typeContratLibelle || offre.typeContrat}
                </span>
                {offre.alternance && (
                  <span className="rounded-full border px-2.5 py-0.5 text-[11px] font-semibold bg-orange-50 text-orange-700 border-orange-200">Alternance</span>
                )}
                {offre.accessibleTH && (
                  <span title="Accessible aux travailleurs handicapés" className="rounded-full border px-2.5 py-0.5 text-[11px] font-semibold bg-blue-50 text-blue-700 border-blue-200">TH</span>
                )}
              </div>
            </div>

            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-500">
              {offre.lieu && <span className="flex items-center gap-1"><MapPin className="h-3 w-3 shrink-0" />{offre.lieu}</span>}
              {offre.salaire && <span className="flex items-center gap-1"><Euro className="h-3 w-3 shrink-0" />{offre.salaire}</span>}
              {offre.dureeTravail && <span className="flex items-center gap-1"><Clock className="h-3 w-3 shrink-0" />{offre.dureeTravail}</span>}
              {offre.experienceLibelle && <span className="flex items-center gap-1"><Briefcase className="h-3 w-3 shrink-0" />{offre.experienceLibelle}</span>}
              {offre.nombrePostes > 1 && <span className="flex items-center gap-1"><Users className="h-3 w-3 shrink-0" />{offre.nombrePostes} postes</span>}
              {offre.dateCreation && <span className="flex items-center gap-1 ml-auto"><CalendarDays className="h-3 w-3 shrink-0" />{formatDate(offre.dateCreation)}</span>}
            </div>
            {offre.salaireCommentaire && <p className="mt-1 text-xs text-stone-400">{offre.salaireCommentaire}</p>}
          </div>
        </div>

        {offre.description && (
          <p className="mt-4 text-sm text-stone-600 leading-relaxed">
            {expanded ? offre.description : descPreview}{!expanded && hasMore && "…"}
          </p>
        )}

        {!expanded && offre.competences.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {offre.competences.slice(0, 5).map((c) => (
              <span key={c} className="rounded-full bg-stone-100 px-2.5 py-0.5 text-[11px] text-stone-600 font-medium">{c}</span>
            ))}
            {offre.competences.length > 5 && (
              <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-[11px] text-stone-500">+{offre.competences.length - 5}</span>
            )}
          </div>
        )}
      </div>

      {expanded && (
        <div className="border-t border-stone-100 px-5 py-4 bg-stone-50/50 space-y-4">
          {offre.secteurActiviteLibelle && (
            <div className="flex items-center gap-2 text-sm text-stone-600">
              <Building2 className="h-4 w-4 text-stone-400 shrink-0" />
              Secteur : <strong>{offre.secteurActiviteLibelle}</strong>
            </div>
          )}
          {offre.competences.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2 flex items-center gap-1.5"><Star className="h-3.5 w-3.5" /> Compétences</p>
              <div className="flex flex-wrap gap-1.5">
                {offre.competences.map((c) => (
                  <span key={c} className="rounded-full bg-blue-50 border border-blue-100 px-2.5 py-0.5 text-[11px] text-blue-700 font-medium">{c}</span>
                ))}
              </div>
            </div>
          )}
          {offre.qualitesPro.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2 flex items-center gap-1.5"><Award className="h-3.5 w-3.5" /> Qualités professionnelles</p>
              <div className="flex flex-wrap gap-1.5">
                {offre.qualitesPro.map((q) => (
                  <span key={q} className="rounded-full bg-emerald-50 border border-emerald-100 px-2.5 py-0.5 text-[11px] text-emerald-700 font-medium">{q}</span>
                ))}
              </div>
            </div>
          )}
          {offre.formations.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2 flex items-center gap-1.5"><BookOpen className="h-3.5 w-3.5" /> Formation souhaitée</p>
              <ul className="space-y-0.5">{offre.formations.map((f) => <li key={f} className="text-sm text-stone-600">• {f}</li>)}</ul>
            </div>
          )}
          {(offre.permis.length > 0 || offre.langues.length > 0) && (
            <div className="flex flex-wrap gap-6">
              {offre.permis.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1.5 flex items-center gap-1.5"><Car className="h-3.5 w-3.5" /> Permis</p>
                  <div className="flex flex-wrap gap-1">{offre.permis.map((p) => <span key={p} className="rounded bg-amber-50 border border-amber-100 px-2 py-0.5 text-[11px] text-amber-700 font-medium">{p}</span>)}</div>
                </div>
              )}
              {offre.langues.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1.5 flex items-center gap-1.5"><Languages className="h-3.5 w-3.5" /> Langues</p>
                  <div className="flex flex-wrap gap-1">{offre.langues.map((l) => <span key={l} className="rounded bg-violet-50 border border-violet-100 px-2 py-0.5 text-[11px] text-violet-700 font-medium">{l}</span>)}</div>
                </div>
              )}
            </div>
          )}
          {offre.accessibleTH && (
            <div className="flex items-center gap-2 text-sm text-blue-600">
              <Accessibility className="h-4 w-4 shrink-0" />Poste accessible aux personnes en situation de handicap
            </div>
          )}
          {(offre.telContact || offre.emailContact) && (
            <div className="border-t border-stone-200 pt-3 flex flex-wrap gap-4">
              {offre.telContact && <a href={`tel:${offre.telContact}`} className="flex items-center gap-1.5 text-sm text-stone-600 hover:text-orange-600 transition-colors"><Phone className="h-3.5 w-3.5" />{offre.telContact}</a>}
              {offre.emailContact && <span className="flex items-center gap-1.5 text-sm text-stone-600"><Mail className="h-3.5 w-3.5" />{offre.emailContact}</span>}
            </div>
          )}
        </div>
      )}

      <div className="px-5 py-3 border-t border-stone-100 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1 text-xs text-stone-500 hover:text-stone-700 transition-colors"
        >
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          {expanded ? "Réduire" : "Voir les détails"}
        </button>

        <button
          type="button"
          onClick={() => onApply(offre)}
          className="flex items-center gap-1.5 rounded-lg bg-orange-500 px-4 py-2 text-xs font-semibold text-white hover:bg-orange-600 transition-colors"
        >
          <Zap className="h-3.5 w-3.5" />
          Postuler rapidement
        </button>
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
  const [dateFilter, setDateFilter] = useState("");
  const [tempsPlein, setTempsPlein] = useState("");
  const [salaireMin, setSalaireMin] = useState("");
  const [offres, setOffres] = useState<FTOffre[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [applyOffre, setApplyOffre] = useState<FTOffre | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Filtre salaire côté client (le texte du salaire contient souvent "X XXX €")
  const filteredOffres = salaireMin
    ? offres.filter((o) => {
        if (!o.salaire) return false;
        const match = o.salaire.replace(/\s/g, "").match(/(\d+)/);
        const val = match ? parseInt(match[1], 10) : 0;
        return val >= parseInt(salaireMin, 10) * 1000;
      })
    : offres;

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
      if (dateFilter) params.set("date", dateFilter);
      if (tempsPlein) params.set("tempsPlein", tempsPlein);
      params.set("page", String(p));

      const res = await fetch(`/api/france-travail/search?${params.toString()}`, { signal: ctrl.signal });
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
  }, [keywords, ville, contrat, experience, dateFilter, tempsPlein]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    search(0);
  }

  return (
    <div className="min-h-screen bg-[#F7F6F3]">
      {applyOffre && <ApplyModal offre={applyOffre} onClose={() => setApplyOffre(null)} />}

      {/* Search bar */}
      <div className="bg-white border-b border-stone-200 px-6 py-8">
        <div className="mx-auto max-w-4xl">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-stone-900">Offres France Travail</h1>
            <p className="mt-1 text-sm text-stone-500">Offres officielles France Travail · Génère ta lettre et postule en quelques secondes</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Ligne 1 : recherche principale */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400 pointer-events-none" />
                <input type="text" placeholder="Métier, poste, compétence…" value={keywords} onChange={(e) => setKeywords(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-stone-200 bg-stone-50 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
              </div>
              <div className="sm:w-48 relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400 pointer-events-none" />
                <input type="text" placeholder="Ville, département…" value={ville} onChange={(e) => setVille(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-stone-200 bg-stone-50 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
              </div>
              <button type="submit" disabled={loading} className="px-6 py-2.5 rounded-xl bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 disabled:opacity-60 transition-colors whitespace-nowrap">
                {loading ? "Recherche…" : "Rechercher"}
              </button>
            </div>

            {/* Ligne 2 : filtres avancés */}
            <div className="flex flex-wrap gap-2">
              <select value={contrat} onChange={(e) => setContrat(e.target.value)} className="px-3 py-1.5 rounded-lg border border-stone-200 bg-stone-50 text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-orange-400">
                {CONTRAT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <select value={experience} onChange={(e) => setExperience(e.target.value)} className="px-3 py-1.5 rounded-lg border border-stone-200 bg-stone-50 text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-orange-400">
                {EXPERIENCE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="px-3 py-1.5 rounded-lg border border-stone-200 bg-stone-50 text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-orange-400">
                {DATE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <select value={tempsPlein} onChange={(e) => setTempsPlein(e.target.value)} className="px-3 py-1.5 rounded-lg border border-stone-200 bg-stone-50 text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-orange-400">
                {TEMPS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <div className="relative">
                <Euro className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-stone-400 pointer-events-none" />
                <input type="number" placeholder="Salaire min (k€/an)" value={salaireMin} onChange={(e) => setSalaireMin(e.target.value)} min={0} max={200}
                  className="pl-7 pr-3 py-1.5 w-44 rounded-lg border border-stone-200 bg-stone-50 text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-orange-400" />
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Results */}
      <div className="mx-auto max-w-4xl px-6 py-6">
        {error && <div className="mb-4 rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">{error}</div>}

        {searched && !loading && (
          <p className="mb-4 text-sm text-stone-500">
            {filteredOffres.length === 0 ? "Aucune offre trouvée." : `${filteredOffres.length} offre${filteredOffres.length > 1 ? "s" : ""} affichée${filteredOffres.length > 1 ? "s" : ""}${total > filteredOffres.length ? ` (${total.toLocaleString("fr-FR")} au total)` : ""}`}
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

        {!loading && filteredOffres.length > 0 && (
          <>
            <div className="space-y-4">
              {filteredOffres.map((offre) => (
                <OffreCard key={offre.id} offre={offre} onApply={setApplyOffre} />
              ))}
            </div>
            <div className="mt-8 flex items-center justify-center gap-3">
              {page > 0 && (
                <button onClick={() => search(page - 1)} className="rounded-lg border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 transition-colors">
                  ← Précédent
                </button>
              )}
              <span className="text-sm text-stone-500">Page {page + 1}</span>
              {offres.length === 20 && (page + 1) * 20 < total && (
                <button onClick={() => search(page + 1)} className="rounded-lg border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 transition-colors">
                  Suivant →
                </button>
              )}
            </div>
          </>
        )}

        {!loading && searched && filteredOffres.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-stone-100">
              <Search className="h-8 w-8 text-stone-400" />
            </div>
            <h2 className="mt-4 text-base font-semibold text-stone-700">Aucune offre trouvée</h2>
            <p className="mt-1.5 max-w-xs text-sm text-stone-400">Essaie d'élargir ta recherche ou de changer les filtres.</p>
          </div>
        )}

        {!searched && !loading && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-50">
              <Zap className="h-8 w-8 text-orange-400" />
            </div>
            <h2 className="mt-4 text-base font-semibold text-stone-700">Postule en quelques secondes</h2>
            <p className="mt-1.5 max-w-xs text-sm text-stone-400">
              Lance une recherche · clique sur une offre · génère ta lettre avec l'IA · postule.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
