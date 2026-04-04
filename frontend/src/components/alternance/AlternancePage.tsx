"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  BookmarkCheck,
  Building2,
  Calendar,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ExternalLink,
  GraduationCap,
  Loader2,
  MapPin,
  Monitor,
  Phone,
  Search,
  Sparkles,
  Users,
  X,
  Wand2,
  FileText,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { CompanyLogo } from "@/components/ui/CompanyLogo";
import type { LbaOffre, LbaRecruteur } from "@/lib/lba";

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

interface RomeSuggestion { code: string; label: string }

// ─── Score helper ─────────────────────────────────────────────────────────────

function scoreLevel(score: number): "high" | "medium" | "low" {
  // API peut retourner 1–3 (stars) ou 0–1 (probability float)
  if (score >= 3 || score >= 0.7) return "high";
  if (score >= 2 || score >= 0.4) return "medium";
  return "low";
}

const SCORE_CONFIG = {
  high:   { label: "Probabilité élevée",   dot: "bg-orange-500",   text: "text-orange-600",  bg: "bg-orange-50",  ring: "ring-orange-200" },
  medium: { label: "Probabilité moyenne",  dot: "bg-orange-300",   text: "text-orange-400",  bg: "bg-orange-50/60", ring: "ring-orange-100" },
  low:    { label: "Probabilité faible",   dot: "bg-stone-300",    text: "text-stone-400",   bg: "bg-stone-50",   ring: "ring-stone-200" },
};

function ScoreBadge({ score }: { score: number }) {
  if (score === 0) return null;
  const level = scoreLevel(score);
  const cfg   = SCORE_CONFIG[level];
  return (
    <div className={cn("flex items-center gap-1.5 rounded-full px-2.5 py-1 ring-1", cfg.bg, cfg.ring)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", cfg.dot)} />
      <span className={cn("text-[10px] font-semibold", cfg.text)}>{cfg.label}</span>
    </div>
  );
}

// ─── Modal de candidature ────────────────────────────────────────────────────

interface ApplyModalProps {
  item:      LbaRecruteur & { already_applied: boolean };
  romeLabel: string;
  token:     string;
  onClose:   () => void;
  onApplied: (id: string) => void;
  romeCode:  string;
}

function ApplyModal({ item, romeLabel, token, onClose, onApplied, romeCode }: ApplyModalProps) {
  const [letter, setLetter]   = useState("");
  const [busy, setBusy]       = useState<"letter" | "send" | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const [done, setDone]       = useState(false);

  // Prevent scroll on body
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  async function generateLetter() {
    setBusy("letter");
    setError(null);
    try {
      const res = await fetch("/api/alternance/generate-letter", {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          companyName: item.name,
          nafText:     item.nafText || undefined,
          address:     item.address || undefined,
          romeLabel:   romeLabel || undefined,
        }),
      });
      const data = await res.json() as { letter?: string; error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? `HTTP ${res.status}`);
      setLetter(data.letter ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur génération");
    } finally {
      setBusy(null);
    }
  }

  async function sendApplication() {
    if (!letter.trim()) {
      setError("Écris ou génère une lettre de motivation avant d'envoyer.");
      return;
    }
    setBusy("send");
    setError(null);
    try {
      const res = await fetch("/api/alternance/apply", {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          recipientId: item.recipientId,
          jobId:       item.id,
          jobType:     "recruteur_lba",
          siret:       item.siret || undefined,
          companyName: item.name,
          romeCode,
          city:        item.address || undefined,
          message:     letter,
        }),
      });

      if (res.status === 409) {
        setDone(true);
        onApplied(item.id);
        return;
      }

      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        const msg = data.error ?? `HTTP ${res.status}`;
        // Cas CV manquant → lien vers Mon CV
        if (msg.toLowerCase().includes("cv")) {
          setError("__cv_missing__");
        } else {
          throw new Error(msg);
        }
        return;
      }

      setDone(true);
      onApplied(item.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur envoi");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={!busy ? onClose : undefined}
      />

      {/* Card */}
      <div className="relative z-10 flex w-full max-w-lg flex-col rounded-2xl bg-white shadow-[0_24px_64px_rgba(0,0,0,0.18)]">

        {/* Header */}
        <div className="border-b border-stone-100 px-6 py-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <CompanyLogo name={item.name} website={item.website || undefined} size="md" />
              <div>
                <p className="text-[15px] font-bold text-stone-900">{item.name}</p>
                {(item.city || item.address) && (
                  <p className="flex items-center gap-1 text-[11px] text-stone-400">
                    <MapPin className="h-3 w-3" strokeWidth={2} />
                    {item.city || item.address}
                  </p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-stone-400 transition hover:bg-stone-100 hover:text-stone-600"
            >
              <X className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>

          {/* Fiche entreprise */}
          <div className="mt-4 grid grid-cols-2 gap-2">
            {item.nafText && (
              <div className="flex items-start gap-2 rounded-xl bg-stone-50 px-3 py-2.5">
                <Building2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-stone-400" strokeWidth={2} />
                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-stone-400">Secteur</p>
                  <p className="text-[11px] font-medium text-stone-700">{item.nafText}</p>
                </div>
              </div>
            )}
            {item.size && (
              <div className="flex items-start gap-2 rounded-xl bg-stone-50 px-3 py-2.5">
                <Users className="mt-0.5 h-3.5 w-3.5 shrink-0 text-stone-400" strokeWidth={2} />
                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-stone-400">Taille</p>
                  <p className="text-[11px] font-medium text-stone-700">{item.size}</p>
                </div>
              </div>
            )}
            {item.phone && (
              <div className="flex items-start gap-2 rounded-xl bg-stone-50 px-3 py-2.5">
                <Phone className="mt-0.5 h-3.5 w-3.5 shrink-0 text-stone-400" strokeWidth={2} />
                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-stone-400">Téléphone</p>
                  <p className="text-[11px] font-medium text-stone-700">{item.phone}</p>
                </div>
              </div>
            )}
            {item.website && (
              <a
                href={item.website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-2 rounded-xl bg-stone-50 px-3 py-2.5 transition hover:bg-orange-50"
              >
                <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-stone-400" strokeWidth={2} />
                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-stone-400">Site web</p>
                  <p className="truncate text-[11px] font-medium text-orange-500">Visiter →</p>
                </div>
              </a>
            )}
          </div>
        </div>

        {/* Body */}
        {done ? (
          <div className="flex flex-col items-center gap-4 px-6 py-10 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-100">
              <CheckCircle2 className="h-7 w-7 text-orange-500" strokeWidth={2} />
            </div>
            <div>
              <p className="text-[15px] font-bold text-stone-900">Candidature envoyée !</p>
              <p className="mt-1 text-[13px] text-stone-400">
                Ta candidature spontanée a bien été transmise à <span className="font-semibold text-stone-600">{item.name}</span>.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="mt-2 rounded-xl bg-orange-500 px-6 py-2.5 text-[13px] font-semibold text-white transition hover:bg-orange-600"
            >
              Fermer
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-5 px-6 py-5">

            {/* CV attaché */}
            <div className="flex items-center gap-2.5 rounded-xl bg-stone-50 px-3.5 py-3 ring-1 ring-stone-100">
              <FileText className="h-4 w-4 shrink-0 text-stone-400" strokeWidth={2} />
              <span className="flex-1 text-[12px] text-stone-500">
                CV attaché automatiquement depuis ton profil
              </span>
              <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-600">
                Auto
              </span>
            </div>

            {/* Lettre */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold uppercase tracking-[0.1em] text-stone-400">
                  Lettre de motivation
                </label>
                <button
                  type="button"
                  onClick={generateLetter}
                  disabled={busy === "letter"}
                  className="flex items-center gap-1.5 rounded-lg bg-orange-50 px-3 py-1.5 text-[11px] font-semibold text-orange-600 ring-1 ring-orange-200/60 transition hover:bg-orange-100 disabled:opacity-60"
                >
                  {busy === "letter"
                    ? <Loader2 className="h-3 w-3 animate-spin" />
                    : <Wand2 className="h-3 w-3" strokeWidth={2} />}
                  {busy === "letter" ? "Génération…" : "Générer avec l'IA"}
                </button>
              </div>
              <textarea
                value={letter}
                onChange={(e) => setLetter(e.target.value)}
                placeholder="Clique sur « Générer avec l'IA » ou écris ta lettre ici…"
                rows={8}
                className="w-full resize-none rounded-xl bg-stone-50 px-4 py-3 text-[12.5px] leading-relaxed text-stone-700 ring-1 ring-stone-200 placeholder:text-stone-300 focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>

            {/* Erreur */}
            {error && error !== "__cv_missing__" && (
              <p className="rounded-xl bg-red-50 px-4 py-2.5 text-[12px] text-red-600">{error}</p>
            )}
            {error === "__cv_missing__" && (
              <div className="rounded-xl bg-red-50 px-4 py-3 text-[12px] text-red-600">
                Aucun CV trouvé sur ton profil.{" "}
                <Link href="/cv" className="font-semibold underline" onClick={onClose}>
                  Upload ton CV ici →
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        {!done && (
          <div className="flex items-center justify-end gap-2 border-t border-stone-100 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              disabled={!!busy}
              className="rounded-xl px-4 py-2.5 text-[13px] font-semibold text-stone-500 transition hover:bg-stone-100 disabled:opacity-60"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={sendApplication}
              disabled={!!busy || !letter.trim()}
              className="flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-2.5 text-[13px] font-semibold text-white transition hover:bg-orange-600 disabled:opacity-50"
            >
              {busy === "send"
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Envoi…</>
                : <><ChevronRight className="h-4 w-4" strokeWidth={2.5} /> Envoyer la candidature</>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
      <div className="flex items-center gap-3 rounded-2xl bg-stone-900 px-5 py-3 shadow-[0_8px_32px_rgba(0,0,0,0.2)]">
        <CheckCircle2 className="h-4 w-4 text-orange-400" strokeWidth={2} />
        <span className="text-[13px] font-medium text-white">{message}</span>
      </div>
    </div>
  );
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
  item, onOpenModal,
}: {
  item:        LbaRecruteur & { already_applied: boolean };
  onOpenModal: (item: LbaRecruteur & { already_applied: boolean }) => void;
}) {
  return (
    <div className={cn(
      "group flex flex-col rounded-2xl bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,0.05)] ring-1 transition-all",
      item.already_applied
        ? "ring-orange-200"
        : "ring-stone-100 hover:ring-orange-200 hover:shadow-[0_4px_20px_rgba(249,115,22,0.10)]"
    )}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <CompanyLogo name={item.name} website={item.website || undefined} size="md" />
        <div className="flex-1 min-w-0">
          <p className="truncate text-[14px] font-bold text-stone-900">{item.name}</p>
          {item.nafText && (
            <p className="truncate text-[11px] text-stone-500">{item.nafText}</p>
          )}
        </div>
        <span className="shrink-0 rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-bold text-orange-500 ring-1 ring-orange-200/60">
          Spontanée
        </span>
      </div>

      {/* Infos ligne */}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        {(item.city || item.address) && (
          <span className="flex items-center gap-1 text-[11px] text-stone-400">
            <MapPin className="h-3 w-3" strokeWidth={2} />
            {item.city || item.address}
          </span>
        )}
        {item.size && (
          <span className="flex items-center gap-1 text-[11px] text-stone-400">
            <Users className="h-3 w-3" strokeWidth={2} />
            {item.size}
          </span>
        )}
        {item.naf && (
          <span className="rounded bg-stone-100 px-1.5 py-0.5 text-[10px] font-medium text-stone-500">
            NAF {item.naf}
          </span>
        )}
      </div>

      {/* Contact */}
      {item.phone && (
        <a
          href={`tel:${item.phone}`}
          className="mt-2 flex items-center gap-1.5 text-[11px] text-stone-400 transition hover:text-orange-500"
        >
          <Phone className="h-3 w-3" strokeWidth={2} />
          {item.phone}
        </a>
      )}

      {/* Score */}
      {item.score > 0 && (
        <div className="mt-3">
          <ScoreBadge score={item.score} />
        </div>
      )}

      {/* Actions */}
      <div className="mt-4 flex items-center gap-2">
        {item.already_applied ? (
          <div className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-orange-50 py-2.5 text-[12px] font-semibold text-orange-500 ring-1 ring-orange-200/60">
            <BookmarkCheck className="h-4 w-4" strokeWidth={2} />
            Candidature envoyée
          </div>
        ) : item.recipientId ? (
          <button
            type="button"
            onClick={() => onOpenModal(item)}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-orange-500 py-2.5 text-[12px] font-semibold text-white transition hover:bg-orange-600"
          >
            Postuler <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.5} />
          </button>
        ) : (item.applyUrl || item.website) ? (
          <a
            href={item.applyUrl || item.website}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-orange-500 py-2.5 text-[12px] font-semibold text-white transition hover:bg-orange-600"
          >
            Postuler <ExternalLink className="h-3.5 w-3.5" strokeWidth={2.5} />
          </a>
        ) : null}
        {(item.website || item.applyUrl) && (
          <a
            href={item.website || item.applyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-stone-100 text-stone-400 transition hover:bg-orange-50 hover:text-orange-500"
            title="Voir la fiche officielle"
          >
            <ExternalLink className="h-4 w-4" strokeWidth={2} />
          </a>
        )}
      </div>
    </div>
  );
}

const REMOTE_LABEL: Record<string, string> = {
  remote:  "Full remote",
  hybrid:  "Hybride",
  onsite:  "",
};

function formatDate(iso: string): string {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
  } catch { return iso; }
}

function OffreCard({
  item, romeCode, token, onApplied,
}: {
  item: LbaOffre & { already_applied?: boolean };
  romeCode: string;
  token: string;
  onApplied: (id: string) => void;
}) {
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [applied, setApplied]   = useState(item.already_applied ?? false);
  const [expanded, setExpanded] = useState(false);
  const isPartner = item.type === "offre_partenaire";
  const remoteLabel = REMOTE_LABEL[item.contractRemote] ?? "";

  async function handleApply() {
    if (applied || loading || isPartner) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/alternance/apply", {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          recipientId: item.recipientId,
          jobId:       item.id,
          jobType:     "offre_lba",
          siret:       item.siret || undefined,
          companyName: item.companyName,
          romeCode,
          city:        item.city || item.address || undefined,
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
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <CompanyLogo name={item.companyName} size="md" />
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-bold leading-snug text-stone-900">{item.title}</p>
          <p className="truncate text-[11px] font-medium text-stone-500">{item.companyName}</p>
        </div>
        {isPartner && (
          <span className="shrink-0 rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-semibold text-stone-500">
            France Travail
          </span>
        )}
      </div>

      {/* Badges */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {item.contractType && (
          <span className="rounded-full bg-orange-50 px-2.5 py-1 text-[10px] font-semibold text-orange-600 ring-1 ring-orange-200/60">
            {item.contractType}
          </span>
        )}
        {item.contractDuration != null && (
          <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[10px] font-semibold text-stone-500">
            {item.contractDuration} mois
          </span>
        )}
        {remoteLabel && (
          <span className="flex items-center gap-1 rounded-full bg-stone-100 px-2.5 py-1 text-[10px] font-semibold text-stone-500">
            <Monitor className="h-2.5 w-2.5" strokeWidth={2} />
            {remoteLabel}
          </span>
        )}
        {item.targetDiploma && (
          <span className="flex items-center gap-1 rounded-full bg-stone-100 px-2.5 py-1 text-[10px] font-semibold text-stone-500">
            <GraduationCap className="h-2.5 w-2.5" strokeWidth={2} />
            {item.targetDiploma}
          </span>
        )}
      </div>

      {/* Localisation + date */}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        {(item.city || item.address) && (
          <span className="flex items-center gap-1 text-[11px] text-stone-400">
            <MapPin className="h-3 w-3" strokeWidth={2} />
            {item.city || item.address}
          </span>
        )}
        {item.startDate && (
          <span className="flex items-center gap-1 text-[11px] text-stone-400">
            <Calendar className="h-3 w-3" strokeWidth={2} />
            Dès le {formatDate(item.startDate)}
          </span>
        )}
      </div>

      {/* Description expandable */}
      {item.description && (
        <div className="mt-3">
          <p className={cn("text-[11.5px] leading-relaxed text-stone-400", !expanded && "line-clamp-3")}>
            {item.description}
          </p>
          {item.description.length > 160 && (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-orange-500 hover:text-orange-600"
            >
              {expanded
                ? <><ChevronUp className="h-3 w-3" strokeWidth={2} /> Réduire</>
                : <><ChevronDown className="h-3 w-3" strokeWidth={2} /> Voir plus</>}
            </button>
          )}
        </div>
      )}

      {/* Compétences recherchées */}
      {item.desiredSkills.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {item.desiredSkills.slice(0, 5).map((s) => (
            <span key={s} className="rounded bg-stone-50 px-2 py-0.5 text-[10px] font-medium text-stone-500 ring-1 ring-stone-100">
              {s}
            </span>
          ))}
        </div>
      )}

      {error && (
        <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-[11px] text-red-600">{error}</p>
      )}

      {/* Actions */}
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
            {loading
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <>Postuler <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.5} /></>}
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
  const [token, setToken]             = useState("");
  const [rome, setRome]               = useState("");
  const [romeQuery, setRomeQuery]     = useState("");
  const [romeLabel, setRomeLabel]     = useState("");
  const [suggestions, setSuggestions] = useState<RomeSuggestion[]>([]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [city, setCity]               = useState("");
  const [radius, setRadius]           = useState<number>(30);
  const [loading, setLoading]         = useState(false);
  const [searched, setSearched]       = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [result, setResult]           = useState<SearchResult | null>(null);
  const [tab, setTab]                 = useState<Tab>("recruteurs");
  const [modalItem, setModalItem]     = useState<(LbaRecruteur & { already_applied: boolean }) | null>(null);
  const [toast, setToast]             = useState<string | null>(null);
  const cityRef                       = useRef<HTMLInputElement>(null);
  const romeRef                       = useRef<HTMLInputElement>(null);
  const debounceRef                   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestRef                    = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();
    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setToken(session.access_token);
    });
  }, []);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (suggestRef.current && !suggestRef.current.contains(e.target as Node)) {
        setSuggestOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function onRomeInput(val: string) {
    setRomeQuery(val);
    setRome("");
    setRomeLabel("");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (val.trim().length < 2) { setSuggestions([]); setSuggestOpen(false); return; }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/alternance/rome-suggest?q=${encodeURIComponent(val.trim())}`);
        if (res.ok) {
          const data = await res.json() as RomeSuggestion[];
          setSuggestions(data);
          setSuggestOpen(data.length > 0);
        }
      } catch { /* ignore */ }
    }, 300);
  }

  function selectRome(code: string, label: string) {
    setRome(code);
    setRomeLabel(label);
    setRomeQuery(`${code} – ${label}`);
    setSuggestOpen(false);
    setSuggestions([]);
    cityRef.current?.focus();
  }

  function clearRome() {
    setRome(""); setRomeQuery(""); setRomeLabel("");
    setSuggestions([]); setSuggestOpen(false);
    romeRef.current?.focus();
  }

  const handleSearch = useCallback(async () => {
    if (!rome) { romeRef.current?.focus(); return; }
    if (!city.trim()) { cityRef.current?.focus(); return; }
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
      recruteurs: result.recruteurs.map((r) => r.id === id ? { ...r, already_applied: true } : r),
      offres_lba: result.offres_lba.map((o)  => o.id === id ? { ...o, already_applied: true } : o),
    });
  }

  function handleApplied(id: string) {
    markApplied(id);
    setModalItem(null);
    setToast("Candidature envoyée avec succès !");
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
          <h2 className="text-[18px] font-bold text-stone-900">Alternance</h2>
          <p className="mt-0.5 text-[14px] text-stone-400">
            Accède aux entreprises qui recrutent en alternance — y compris celles qui n'ont pas posté d'offre.
          </p>
        </div>
      </div>

      {/* ── Formulaire de recherche ─────────────────────────────────────── */}
      <div className="mb-8 rounded-2xl bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,0.05)] ring-1 ring-stone-100">
        <div className="flex flex-wrap gap-3">

          {/* ROME */}
          <div ref={suggestRef} className="relative flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-[0.1em] text-stone-400">
              Secteur / métier
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" strokeWidth={2} />
              <input
                ref={romeRef}
                type="text"
                value={romeQuery}
                onChange={(e) => onRomeInput(e.target.value)}
                onFocus={() => suggestions.length > 0 && setSuggestOpen(true)}
                placeholder="ex. marketing, développeur, RH…"
                className={cn(
                  "h-10 min-w-[260px] rounded-xl bg-stone-50 py-2 pl-9 pr-8 text-[13px] text-stone-800 ring-1 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-400",
                  rome ? "ring-orange-300" : "ring-stone-200"
                )}
              />
              {romeQuery && (
                <button type="button" onClick={clearRome} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-300 hover:text-stone-500">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {suggestOpen && suggestions.length > 0 && (
              <div className="absolute top-full z-50 mt-1 w-full min-w-[260px] rounded-xl border border-stone-200 bg-white py-1 shadow-[0_8px_24px_rgba(0,0,0,0.10)]">
                {suggestions.map((s) => (
                  <button
                    key={s.code}
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); selectRome(s.code, s.label); }}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-orange-50"
                  >
                    <span className="shrink-0 rounded-lg bg-orange-100 px-1.5 py-0.5 text-[10px] font-bold text-orange-600">
                      {s.code}
                    </span>
                    <span className="text-[13px] text-stone-700">{s.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Ville */}
          <div className="flex flex-1 flex-col gap-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-[0.1em] text-stone-400">
              Ville ou zone
            </label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" strokeWidth={2} />
              <input
                ref={cityRef}
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
            <label className="text-[10px] font-semibold uppercase tracking-[0.1em] text-stone-400">Rayon</label>
            <select
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
              className="h-10 w-24 rounded-xl border-0 bg-stone-50 px-3 text-[13px] font-medium text-stone-800 ring-1 ring-stone-200 focus:outline-none focus:ring-2 focus:ring-orange-400"
            >
              {RADIUS_OPTIONS.map((r) => <option key={r} value={r}>{r} km</option>)}
            </select>
          </div>

          {/* Bouton */}
          <div className="flex flex-col justify-end gap-1.5">
            <div className="h-[22px]" />
            <button
              type="button"
              onClick={() => void handleSearch()}
              disabled={loading || !rome}
              className="flex h-10 items-center gap-2 rounded-xl bg-orange-500 px-5 text-[13px] font-semibold text-white transition hover:bg-orange-600 disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" strokeWidth={2} />}
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
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <p className="text-[13px] text-stone-500">
              <span className="font-bold text-orange-500 tabular-nums">{result.total}</span>
              {" "}opportunité{result.total !== 1 ? "s" : ""} autour de{" "}
              <span className="font-semibold text-stone-700">{result.cityLabel || city}</span>
            </p>
            <div className="flex items-center gap-2">
              <TabBtn active={tab === "recruteurs"}         onClick={() => setTab("recruteurs")}         label="Recruteurs LBA"  count={counts.recruteurs} />
              <TabBtn active={tab === "offres_lba"}         onClick={() => setTab("offres_lba")}         label="Offres LBA"      count={counts.offres_lba} />
              <TabBtn active={tab === "offres_partenaires"} onClick={() => setTab("offres_partenaires")} label="France Travail"  count={counts.offres_partenaires} />
            </div>
          </div>

          {tab === "recruteurs" && counts.recruteurs > 0 && (
            <div className="mb-5 flex items-start gap-3 rounded-xl bg-orange-50 px-4 py-3 ring-1 ring-orange-200/60">
              <Users className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" strokeWidth={2} />
              <p className="text-[12px] text-orange-700">
                <span className="font-bold">Recruteurs LBA</span> — Ces entreprises ont été identifiées
                par algorithme comme ayant un fort potentiel de recrutement en alternance
                mais n'ont pas posté d'offre. Envoie une candidature spontanée directement depuis Postuly.
              </p>
            </div>
          )}

          {tab === "recruteurs" && (
            counts.recruteurs === 0
              ? <EmptyState message="Aucun recruteur LBA trouvé dans cette zone. Essaie un rayon plus large ou un autre secteur." />
              : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {result.recruteurs.map((item) => (
                    <RecruteurCard key={item.id} item={item} onOpenModal={setModalItem} />
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
                    <OffreCard key={item.id} item={item} romeCode={rome} token={token} onApplied={markApplied} />
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
                    <OffreCard key={item.id} item={item} romeCode={rome} token={token} onApplied={markApplied} />
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
            Tape ton secteur (ex. "marketing", "développeur"), entre une ville
            et découvre les entreprises qui recrutent en alternance — même celles sans aucune annonce publiée.
          </p>
        </div>
      )}

      {/* ── Modal candidature ────────────────────────────────────────────── */}
      {modalItem && (
        <ApplyModal
          item={modalItem}
          romeLabel={romeLabel}
          romeCode={rome}
          token={token}
          onClose={() => setModalItem(null)}
          onApplied={handleApplied}
        />
      )}

      {/* ── Toast ────────────────────────────────────────────────────────── */}
      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </div>
  );
}
