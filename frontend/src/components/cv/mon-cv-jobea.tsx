"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Briefcase,
  Award,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileDown,
  FileText,
  Globe,
  GraduationCap,
  Heart,
  Info,
  Sparkles,
  Upload,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { draftFromParsed, emptyCvDraft, parsedFromDraft } from "@/lib/cv-form";
import { CvVerifyFormSteps } from "@/components/cv/cv-verify-form-steps";
import type { MonCvFlowStep } from "@/lib/mon-cv-flow";
import { SelectMenu, type SelectMenuOption } from "@/components/ui/select-menu";
import type {
  Campaign,
  CvCoachAnalysis,
  CvExperienceParsed,
  CvParsed,
  Profile,
} from "@/lib/types";

const CONTRACT_SELECT_OPTIONS: SelectMenuOption[] = [
  { value: "", label: "Choisir…" },
  { value: "stage", label: "Stage" },
  { value: "alternance", label: "Alternance" },
  { value: "cdd", label: "CDD" },
  { value: "cdi", label: "CDI" },
];

const PROFIL_SELECT_OPTIONS: SelectMenuOption[] = [
  { value: "", label: "Selon mon compte Postuly" },
  { value: "etudiant", label: "Étudiant / jeune diplômé" },
  { value: "jeune_actif", label: "Jeune actif" },
  { value: "reconversion", label: "En reconversion" },
];

/** Charte Postuly (sidebar / dashboard) */
const ORANGE = "#FE6A2E";
const ORANGE_LIGHT = "#FFF1E3";
const ORANGE_GOLD = "#FFB347";
const BD = "#EEEEED";
/** Dégradé boutons et barres de progression */
const CTA_GRAD = `linear-gradient(90deg, ${ORANGE}, ${ORANGE_GOLD})`;
/** Encadrés type « info » */
const CALLOUT_BG = "#FFF8F4";
const CALLOUT_BORDER = "#FFD5B8";
/** Hub Mon CV : surfaces neutres + accent orange */
const HUB_SURFACE = "#FAFAF9";
const HUB_SHADOW =
  "0 1px 2px rgba(15, 23, 42, 0.04), 0 12px 40px -12px rgba(254, 106, 46, 0.12)";

const PRACTICAL_TIPS = [
  "Saviez-vous que 30 % des embauches proviennent de candidatures spontanées ? Vous êtes peut-être à une seule candidature de votre prochain job.",
  "Les recruteurs passent en moyenne moins de 10 secondes sur un CV : une accroche claire en tête fait la différence.",
  "Les mots-clés du poste visé, présents naturellement dans ton CV, améliorent le passage des ATS.",
  "Une expérience décrite avec un résultat chiffré vaut mieux qu’une simple liste de tâches.",
];

const ANALYSIS_STEPS = [
  "Analyse intelligente en cours…",
  "Extraction des compétences…",
  "Détection des expériences…",
  "Traitement des expériences professionnelles…",
  "Extraction des compétences techniques…",
  "Évaluation de l’adéquation au poste…",
  "Finalisation du rapport…",
];

/** Icônes des étapes de vérification (ordre = VERIFY_LABELS). */
const VERIFY_STEP_ICONS = [
  User,
  FileText,
  Briefcase,
  GraduationCap,
  Award,
  Globe,
  Heart,
] as const;

const VERIFY_LABELS = [
  "Profil",
  "Document",
  "Expériences",
  "Formation",
  "Compétences",
  "Langues",
  "Centres d’intérêt",
] as const;

function scoreHue(v: number): string {
  if (v >= 70) return "#16A34A";
  if (v >= 50) return "#CA8A04";
  return "#DC2626";
}

function contractBadge(code: string): string {
  const u = code.toUpperCase();
  if (u === "CDI" || u === "CDD" || u === "STAGE") return u;
  if (code === "alternance") return "Alternance";
  return u || "—";
}

function experienceDateRange(e: CvExperienceParsed): string {
  const a = e.start_date?.trim();
  const b = e.end_date?.trim();
  if (e.is_current) return a ? `${a} — Aujourd’hui` : "En cours";
  if (a && b) return `${a} — ${b}`;
  return a || b || "";
}

function cvInfoRows(cv: CvParsed | null, profileFullName: string | null | undefined) {
  const p = cv?.personal;
  const name = p?.full_name?.trim() || profileFullName?.trim() || "—";
  const loc = [p?.city, p?.postal_code].filter(Boolean).join(" ") || "—";
  return [
    { k: "Nom complet", v: name },
    { k: "Email", v: cv?.email?.trim() || "—" },
    { k: "Téléphone", v: cv?.phone?.trim() || "—" },
    { k: "Localisation", v: loc },
  ];
}

function cvExperienceRows(cv: CvParsed | null): { title: string; sub: string }[] {
  if (!cv) return [];
  if (cv.experience_items && cv.experience_items.length > 0) {
    return cv.experience_items.map((e) => ({
      title: e.job_title?.trim() || "Expérience",
      sub: [e.company?.trim(), experienceDateRange(e)].filter(Boolean).join(" · ") || "—",
    }));
  }
  return (cv.experiences ?? []).filter(Boolean).slice(0, 10).map((t) => ({ title: t, sub: "" }));
}

/** Jauge circulaire score (charte Postuly). */
function CvScoreRing({ value, hue }: { value: number; hue: string }) {
  const reactId = useId().replace(/:/g, "");
  const gradId = `cv-ring-${reactId}`;
  const r = 52;
  const c = 2 * Math.PI * r;
  const pct = Math.min(100, Math.max(0, value));
  const offset = c - (pct / 100) * c;
  return (
    <div className="relative mx-auto flex h-[9.5rem] w-[9.5rem] shrink-0 items-center justify-center sm:h-40 sm:w-40">
      <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120" aria-hidden>
        <circle cx="60" cy="60" r={r} fill="none" stroke="#F3F4F6" strokeWidth="10" />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#FE6A2E" />
            <stop offset="100%" stopColor="#FFB347" />
          </linearGradient>
        </defs>
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-bold tabular-nums leading-none" style={{ color: hue }}>
          {value}
        </span>
        <span className="mt-1 text-[11px] font-medium uppercase tracking-wide text-gray-400">
          / 100
        </span>
      </div>
    </div>
  );
}

function prioriteToSeverity(p: string): "MAJOR" | "MINOR" {
  return String(p).toLowerCase().includes("majeur") ? "MAJOR" : "MINOR";
}

function difficulteToPriority(d: string): "HIGH" | "LOW" | "MEDIUM" {
  const x = String(d).toLowerCase();
  if (x.includes("difficile")) return "HIGH";
  if (x.includes("moyen")) return "MEDIUM";
  return "LOW";
}

export function parseAvantApres(raw: string): {
  avant?: string;
  apres?: string;
  brut: string;
} {
  const t = raw.trim();
  const mAvant = t.match(/AVANT\s*:\s*([\s\S]*?)(?=APRES\s*:|$)/i);
  const mApres = t.match(/APRES\s*:\s*([\s\S]*)$/i);
  if (mAvant || mApres) {
    return {
      avant: mAvant?.[1]?.trim(),
      apres: mApres?.[1]?.trim(),
      brut: t,
    };
  }
  return { brut: t };
}

type AnalysisPhase = "hub" | "setup" | "analyzing" | "results";

export type MonCvJobeaProps = {
  profile: Profile | null;
  uploading: boolean;
  uploadError: string | null;
  uploadOk: string | null;
  lastFileName: string | null;
  dragOver: boolean;
  onDrop: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onFileInput: (e: React.ChangeEvent<HTMLInputElement>) => void;
  accept: string;
  coachPoste: string;
  setCoachPoste: (v: string) => void;
  coachContrat: Campaign["contract_type"] | "";
  setCoachContrat: (v: Campaign["contract_type"] | "") => void;
  coachProfilHint: "" | "etudiant" | "jeune_actif" | "reconversion";
  setCoachProfilHint: (v: "" | "etudiant" | "jeune_actif" | "reconversion") => void;
  coachError: string | null;
  coachResult: CvCoachAnalysis | null;
  analysisPhase: AnalysisPhase;
  analysisProgress: number;
  onStartAnalysis: () => void;
  onResetAnalysis: () => void;
  /** Hub Jobea : rouvrir les résultats coach. */
  onViewCoachResultsFromHub?: () => void;
  /** Hub Jobea : repartir sur un nouvel upload / analyse. */
  onNewCvAnalysisFromHub?: () => void;
  /** Étape persistée du parcours Mon CV (localStorage). */
  flowStep: MonCvFlowStep;
  /** Après extraction IA : ouvre le formulaire de vérification des infos. */
  onOpenCvInfos: () => void;
  /** Hub : ouvre le wizard données CV sans quitter le parcours « terminé ». */
  onOpenCvDataFromHub?: () => void;
  /** Annule l’édition données depuis le hub et revient au résumé. */
  onCancelCvDataEditFromHub?: () => void;
  /** True si le wizard est ouvert depuis le hub (parcours completed). */
  cvDataEditFromHub?: boolean;
  /** Après « Valider mon dossier » : étape avant l’analyse coach. */
  onAfterValidateDossier: () => void;
  /** Après l’analyse : redirection vers les campagnes. */
  onStartCampaigns: () => void;
  /** Analyse coach présente dans le cache navigateur (bandeau « Dossier validé »). */
  hasCoachCache?: boolean;
  /** Restaure l’analyse depuis le cache et affiche les résultats. */
  onRestoreCoachFromCache?: () => void;
  /** Jeton Supabase pour PATCH profil (sauvegarde formulaire). */
  token: string;
  onCvFormSaved?: () => void | Promise<void>;
  /** Supprime le CV du profil (URL, score, données parsées). */
  onRemoveCv?: () => void | Promise<void>;
  removingCv?: boolean;
};

export function MonCvJobeaExperience(props: MonCvJobeaProps) {
  const {
    profile,
    uploading,
    uploadError,
    uploadOk,
    lastFileName,
    dragOver,
    onDrop,
    onDragOver,
    onDragLeave,
    onFileInput,
    accept,
    coachPoste,
    setCoachPoste,
    coachContrat,
    setCoachContrat,
    coachProfilHint,
    setCoachProfilHint,
    coachError,
    coachResult,
    analysisPhase,
    analysisProgress,
    onStartAnalysis,
    onResetAnalysis,
    onViewCoachResultsFromHub,
    onNewCvAnalysisFromHub,
    flowStep,
    onOpenCvInfos,
    onOpenCvDataFromHub,
    onCancelCvDataEditFromHub,
    cvDataEditFromHub = false,
    onAfterValidateDossier,
    onStartCampaigns,
    hasCoachCache = false,
    onRestoreCoachFromCache,
    token,
    onCvFormSaved,
    onRemoveCv,
    removingCv = false,
  } = props;

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailStep, setDetailStep] = useState(1);
  const [tipIndex, setTipIndex] = useState(0);
  const [verifyStep, setVerifyStep] = useState(0);
  const [cvDraft, setCvDraft] = useState(() => emptyCvDraft());
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "ok" | "err">("idle");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [dossierValidating, setDossierValidating] = useState(false);

  const hasParsed = Boolean(profile?.cv_parsed);
  const fileLabel =
    lastFileName ||
    (profile?.cv_url ? decodeURIComponent(profile.cv_url.split("/").pop() || "CV") : null);

  const activeAnalysisStep = useMemo(() => {
    const p = analysisProgress;
    if (p >= 95) return ANALYSIS_STEPS.length - 1;
    return Math.min(
      ANALYSIS_STEPS.length - 1,
      Math.floor((p / 100) * ANALYSIS_STEPS.length)
    );
  }, [analysisProgress]);

  useEffect(() => {
    if (analysisPhase !== "analyzing") return;
    const id = window.setInterval(() => {
      setTipIndex((i) => (i + 1) % PRACTICAL_TIPS.length);
    }, 8000);
    return () => clearInterval(id);
  }, [analysisPhase]);

  useEffect(() => {
    if (!profile?.cv_parsed) {
      setCvDraft(emptyCvDraft());
      return;
    }
    const d = draftFromParsed(profile.cv_parsed);
    if (profile.full_name?.trim() && !d.personal.full_name.trim()) {
      d.personal.full_name = profile.full_name.trim();
    }
    setCvDraft(d);
    setSaveStatus("idle");
    setSaveMessage(null);
  }, [profile?.cv_parsed, profile?.full_name]);

  useEffect(() => {
    if (flowStep === "verify") setVerifyStep(0);
  }, [flowStep]);

  const cv = profile?.cv_parsed;

  async function saveCvForm(): Promise<boolean> {
    if (!token.trim()) {
      setSaveMessage("Connecte-toi pour enregistrer.");
      setSaveStatus("err");
      return false;
    }
    setSaveStatus("saving");
    setSaveMessage(null);
    try {
      const cv_parsed = parsedFromDraft(cvDraft);
      const body: { cv_parsed: typeof cv_parsed; full_name?: string } = { cv_parsed };
      const fn = cvDraft.personal.full_name.trim();
      if (fn) body.full_name = fn;
      await api("/api/profiles/me", {
        method: "PATCH",
        token,
        body,
      });
      setSaveStatus("ok");
      setSaveMessage("Modifications enregistrées.");
      await onCvFormSaved?.();
      return true;
    } catch (e) {
      setSaveStatus("err");
      setSaveMessage(e instanceof Error ? e.message : "Échec de l’enregistrement.");
      return false;
    }
  }

  async function handleValidateDossier() {
    setDossierValidating(true);
    try {
      const ok = await saveCvForm();
      if (!ok) return;
      setSaveMessage("Dossier validé et enregistré.");
      onAfterValidateDossier();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setDossierValidating(false);
    }
  }

  const resetDetail = useCallback(() => {
    setDetailOpen(false);
    setDetailStep(1);
  }, []);

  if (detailOpen && coachResult) {
    return (
      <div className="max-w-3xl mx-auto pb-16" style={{ fontFamily: "var(--font-geist-sans)" }}>
        <button
          type="button"
          onClick={resetDetail}
          className="text-sm font-medium text-[#FE6A2E] hover:underline mb-6 transition-colors"
        >
          ← Retour aux résultats
        </button>
        <AnalyseDetaillee
          analysis={coachResult}
          step={detailStep}
          onStep={setDetailStep}
          onClose={resetDetail}
        />
      </div>
    );
  }

  const isHub = analysisPhase === "hub" && hasParsed;
  const showOrangeHero =
    !isHub &&
    analysisPhase !== "analyzing" &&
    !(coachResult && analysisPhase === "results") &&
    flowStep === "import" &&
    !hasParsed;

  const showCompactCvHeader =
    !isHub &&
    analysisPhase !== "analyzing" &&
    !(coachResult && analysisPhase === "results") &&
    flowStep === "extracted_gate" &&
    hasParsed;

  const showTopBreadcrumb =
    isHub ||
    showOrangeHero ||
    showCompactCvHeader ||
    (!isHub &&
      analysisPhase !== "analyzing" &&
      !(coachResult && analysisPhase === "results") &&
      hasParsed &&
      (flowStep === "verify" || flowStep === "before_coach"));

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-20" style={{ fontFamily: "var(--font-geist-sans)" }}>
      {showTopBreadcrumb && (
        <p className="text-xs text-gray-500 tracking-wide">
          <Link
            href="/dashboard"
            className="text-gray-500 hover:text-[#FE6A2E] transition-colors"
          >
            Tableau de bord
          </Link>
          <span className="mx-1.5 text-gray-300">/</span>
          <span className="text-gray-800 font-medium">Mon CV</span>
        </p>
      )}

      {showOrangeHero && (
        <>
          <div
            className="relative overflow-hidden rounded-3xl border px-6 py-10 sm:px-10 sm:py-12 text-center"
            style={{
              borderColor: BD,
              background: `linear-gradient(165deg, ${ORANGE_LIGHT} 0%, #FFFFFF 40%, #FFFFFF 100%)`,
              boxShadow:
                "0 4px 28px rgba(254, 106, 46, 0.09), 0 1px 3px rgba(0, 0, 0, 0.04)",
            }}
          >
            <div
              className="pointer-events-none absolute -top-20 -right-10 h-44 w-44 rounded-full opacity-[0.12] blur-3xl"
              style={{ background: ORANGE }}
              aria-hidden
            />
            <div
              className="pointer-events-none absolute -bottom-8 -left-8 h-36 w-36 rounded-full opacity-[0.1] blur-2xl"
              style={{ background: ORANGE_GOLD }}
              aria-hidden
            />
            <div className="relative">
              <p className="text-base sm:text-lg text-gray-600 leading-relaxed max-w-xl mx-auto">
                Obtenez un score sur 100, des suggestions de corrections et découvrez vos vrais
                débouchés
              </p>
              <h1
                className="text-3xl sm:text-4xl font-bold text-gray-900 mt-6 tracking-tight"
                style={{ fontFamily: "var(--font-syne)" }}
              >
                Upload de votre CV
              </h1>
              <div
                className="mx-auto mt-5 h-1 w-20 rounded-full"
                style={{ background: CTA_GRAD }}
                aria-hidden
              />
              <p className="text-sm text-gray-500 mt-5 max-w-md mx-auto leading-relaxed">
                Uploadez votre CV pour une analyse automatique par IA
              </p>
            </div>
          </div>
        </>
      )}

      {showCompactCvHeader && (
        <div className="text-center space-y-3 pt-1">
          <h1
            className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight"
            style={{ fontFamily: "var(--font-syne)" }}
          >
            Analysez votre CV
          </h1>
          <p className="text-base sm:text-lg text-gray-600 leading-relaxed max-w-2xl mx-auto">
            Obtenez un score sur 100, des suggestions de corrections et découvrez vos vrais débouchés.
          </p>
        </div>
      )}

      {isHub && (
        <>
          <div className="text-center space-y-2 pt-1 pb-2">
            <h1
              className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight"
              style={{ fontFamily: "var(--font-syne)" }}
            >
              Analysez votre CV
            </h1>
            <p className="text-sm sm:text-base text-gray-500 leading-relaxed max-w-xl mx-auto">
              Score, conseils personnalisés et débouchés adaptés à ton profil.
            </p>
          </div>

          <div
            className="rounded-3xl border bg-white overflow-hidden"
            style={{ borderColor: BD, boxShadow: HUB_SHADOW }}
          >
            <div className="h-1 w-full" style={{ background: CTA_GRAD }} aria-hidden />
            <div className="p-6 sm:p-9 space-y-8">
              <header className="space-y-1">
                <h2
                  className="text-base font-bold text-gray-900 tracking-tight"
                  style={{ fontFamily: "var(--font-syne)" }}
                >
                  Upload de votre CV
                </h2>
                <p className="text-sm text-gray-500">
                  Poste visé et fichier — tout est prêt pour affiner ton parcours.
                </p>
              </header>

              <section
                className="rounded-2xl border p-5 sm:p-6 space-y-5"
                style={{ borderColor: BD, background: HUB_SURFACE }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-sm"
                    style={{ background: ORANGE_LIGHT, color: ORANGE }}
                    aria-hidden
                  >
                    🎯
                  </div>
                  <div className="min-w-0 pt-0.5">
                    <h3 className="text-sm font-semibold text-gray-900">Poste recherché</h3>
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                      L’IA s’appuie sur ces infos pour personnaliser l’analyse.
                    </p>
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <label className="block sm:col-span-2">
                    <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                      Intitulé du poste <span className="text-red-500 normal-case">*</span>
                    </span>
                    <input
                      type="text"
                      value={coachPoste}
                      onChange={(e) => setCoachPoste(e.target.value)}
                      className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#FE6A2E]/20 focus:border-orange-200/80 transition-shadow"
                    />
                  </label>
                  <div className="block">
                    <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                      Type de contrat
                    </span>
                    <SelectMenu
                      label="Type de contrat"
                      options={CONTRACT_SELECT_OPTIONS}
                      value={coachContrat}
                      onChange={(v) => setCoachContrat(v as Campaign["contract_type"] | "")}
                      placeholder="Choisir…"
                    />
                  </div>
                  <div className="block">
                    <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                      Profil (optionnel)
                    </span>
                    <SelectMenu
                      label="Profil (optionnel)"
                      options={PROFIL_SELECT_OPTIONS}
                      value={coachProfilHint}
                      onChange={(v) =>
                        setCoachProfilHint(v as "" | "etudiant" | "jeune_actif" | "reconversion")
                      }
                    />
                  </div>
                </div>
              </section>

              {coachResult ? (
                <section className="rounded-2xl border border-gray-100 bg-white px-5 py-5 sm:px-6 sm:py-6 shadow-[inset_0_0_0_1px_rgba(254,106,46,0.06)]">
                  <div className="flex gap-4">
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white"
                      style={{ background: CTA_GRAD }}
                      aria-hidden
                    >
                      <Check className="h-5 w-5" strokeWidth={2.5} />
                    </span>
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="text-sm font-semibold text-gray-900">CV déjà analysé</p>
                      <p className="text-sm text-gray-500 leading-relaxed">
                        Consulte tes données extraites, rouvre l’analyse coach ou envoie un nouveau
                        fichier.
                      </p>
                      <div className="mt-6 flex w-full flex-nowrap items-stretch gap-2 overflow-x-auto pb-0.5 sm:gap-2.5 [scrollbar-width:thin]">
                        <button
                          type="button"
                          onClick={() => onOpenCvDataFromHub?.()}
                          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 shadow-sm transition-colors hover:border-orange-200 hover:bg-orange-50/60"
                        >
                          <ClipboardList className="h-4 w-4 shrink-0 opacity-80" strokeWidth={2} aria-hidden />
                          Voir les données du CV
                        </button>
                        <button
                          type="button"
                          onClick={() => onViewCoachResultsFromHub?.()}
                          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-shadow hover:shadow-lg"
                          style={{ background: CTA_GRAD }}
                        >
                          <Sparkles className="h-4 w-4 shrink-0 opacity-95" strokeWidth={2} aria-hidden />
                          Voir l’analyse de mon CV
                        </button>
                      </div>
                    </div>
                  </div>
                </section>
              ) : (
                <section
                  className="rounded-2xl border px-5 py-5 sm:px-6 sm:py-6"
                  style={{ borderColor: CALLOUT_BORDER, background: ORANGE_LIGHT }}
                >
                  <div className="flex gap-4">
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                      style={{ background: "rgba(254,106,46,0.2)", color: "#9A3412" }}
                      aria-hidden
                    >
                      <Check className="h-5 w-5" strokeWidth={2.5} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900">Dossier validé</p>
                      <p className="text-sm text-gray-600 mt-1.5 leading-relaxed">
                        Vérifie l’intitulé du poste et le type de contrat ci-dessus, puis lance l’analyse
                        coach pour obtenir ton score et des pistes d’amélioration.
                        {hasCoachCache && (
                          <span className="block mt-2 text-gray-500 text-xs">
                            Une analyse est déjà enregistrée sur cet appareil : tu peux la rouvrir sans
                            relancer l’IA.
                          </span>
                        )}
                      </p>
                      <div className="flex flex-col sm:flex-row flex-wrap gap-2.5 mt-6">
                        {hasCoachCache && (
                          <button
                            type="button"
                            onClick={() => onRestoreCoachFromCache?.()}
                            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-5 text-sm font-semibold text-gray-900 shadow-sm transition-colors hover:bg-gray-50"
                          >
                            <Sparkles className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
                            Voir l’analyse de mon CV
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={!coachPoste.trim() || !coachContrat || uploading}
                          onClick={() => onStartAnalysis()}
                          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl px-6 text-sm font-semibold text-white shadow-md transition-shadow hover:shadow-lg disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
                          style={{ background: CTA_GRAD }}
                        >
                          Voir l’analyse de mon CV
                        </button>
                      </div>
                      {(!coachPoste.trim() || !coachContrat) && (
                        <p className="text-xs text-amber-800/90 mt-3">
                          Renseigne l’intitulé du poste et le type de contrat pour lancer une nouvelle
                          analyse.
                        </p>
                      )}
                    </div>
                  </div>
                </section>
              )}
            </div>
          </div>

          {/* Bouton flottant : nouvelle analyse CV (hors du flux pour rester en bas à droite de la fenêtre) */}
          {coachResult && (
            <button
              type="button"
              onClick={() => onNewCvAnalysisFromHub?.()}
              className="fixed bottom-6 right-6 z-40 inline-flex items-center gap-2.5 rounded-full border border-gray-200 bg-white py-2.5 pl-2.5 pr-5 text-sm font-semibold text-slate-800 shadow-[0_4px_14px_rgba(15,23,42,0.12)] transition hover:border-orange-200 hover:bg-orange-50/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FE6A2E]/35"
            >
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700"
                aria-hidden
              >
                <Upload className="h-4 w-4" strokeWidth={2.25} />
              </span>
              Analyser un nouveau CV
            </button>
          )}
        </>
      )}

      {coachResult && analysisPhase === "results" && (
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs text-gray-500 mb-1">
              <Link
                href="/dashboard"
                className="text-gray-500 hover:text-[#FE6A2E] transition-colors"
              >
                Tableau de bord
              </Link>
              <span className="mx-1.5 text-gray-300">/</span>
              <span className="text-gray-800 font-medium">Mon CV</span>
            </p>
            <h1
              className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight"
              style={{ fontFamily: "var(--font-syne)" }}
            >
              Résultats de l’analyse
            </h1>
          </div>
          <button
            type="button"
            onClick={onResetAnalysis}
            className="text-xs font-semibold px-3 py-2 rounded-xl border text-[#C2410C] hover:opacity-90 transition-opacity"
            style={{ borderColor: CALLOUT_BORDER, background: ORANGE_LIGHT }}
          >
            Nouvelle analyse
          </button>
        </header>
      )}

      {uploadOk && (
        <div
          className="text-sm px-5 py-3.5 rounded-2xl border flex items-start gap-3 shadow-sm"
          style={{ borderColor: "#6EE7B7", background: "#ECFDF5", color: "#065F46" }}
        >
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" strokeWidth={2} aria-hidden />
          <span className="font-medium">{uploadOk}</span>
        </div>
      )}
      {uploadError && (
        <div className="text-sm px-5 py-3.5 rounded-2xl border border-red-200 bg-red-50 text-red-900 shadow-sm">
          {uploadError}
        </div>
      )}

      {coachResult && analysisPhase === "results" && (
        <div
          className="rounded-2xl border bg-white px-4 py-3.5 flex flex-wrap items-center gap-3 text-sm shadow-sm"
          style={{ borderColor: BD }}
        >
          <span className="font-semibold text-gray-900">Analyse enregistrée</span>
          <span className="text-gray-400">·</span>
          <span className="text-gray-600 truncate max-w-[200px]">{coachPoste}</span>
          {coachContrat && (
            <span
              className="text-xs font-bold px-2.5 py-0.5 rounded-full"
              style={{ background: ORANGE_LIGHT, color: "#C2410C" }}
            >
              {contractBadge(coachContrat)}
            </span>
          )}
          {fileLabel && (
            <>
              <span className="text-gray-400">·</span>
              <span className="text-xs text-gray-500 truncate max-w-[180px]">{fileLabel}</span>
            </>
          )}
          <div className="ml-auto flex flex-wrap items-center gap-2 shrink-0">
            {onRemoveCv && (
              <button
                type="button"
                disabled={removingCv || uploading}
                onClick={() => void onRemoveCv()}
                className="text-xs font-medium px-3 py-1.5 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-40"
              >
                {removingCv ? "Suppression…" : "Supprimer"}
              </button>
            )}
            <label className="text-xs font-semibold text-[#FE6A2E] cursor-pointer hover:underline">
              Remplacer le CV
              <input type="file" className="hidden" accept={accept} onChange={onFileInput} />
            </label>
          </div>
        </div>
      )}

      {/* Poste + fichier (ordre type Jobea : objectif puis upload) */}
      {!(coachResult && analysisPhase === "results") && analysisPhase !== "hub" && (
      <section id="poste-recherche-card" className="space-y-6">
        <div
          className="rounded-2xl border bg-white shadow-sm overflow-hidden"
          style={{ borderColor: BD, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
        >
          <div className="h-1 w-full" style={{ background: CTA_GRAD }} aria-hidden />
          <div className="p-6 sm:p-8">
          <div className="flex items-start gap-4 mb-6">
            <div
              className="shrink-0 w-12 h-12 rounded-xl flex items-center justify-center text-xl shadow-sm ring-1 ring-black/[0.04]"
              style={{ background: ORANGE_LIGHT, color: ORANGE }}
              aria-hidden
            >
              🎯
            </div>
            <div className="min-w-0">
              <h2
                className="text-lg font-bold text-gray-900"
                style={{ fontFamily: "var(--font-syne)" }}
              >
                Poste recherché
              </h2>
              <p className="text-sm text-gray-500 mt-1 leading-relaxed">
                L’IA évaluera votre CV en fonction de ce poste pour des conseils personnalisés.
              </p>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="block sm:col-span-2">
              <span className="text-sm font-semibold text-gray-800">
                Intitulé du poste <span className="text-red-500">*</span>
              </span>
              <div className="relative mt-1.5">
                <input
                  type="text"
                  value={coachPoste}
                  onChange={(e) => setCoachPoste(e.target.value)}
                  placeholder="Ex. Vendeur, chargé de communication…"
                  disabled={analysisPhase === "analyzing"}
                  className={cn(
                    "w-full rounded-xl border border-gray-200 px-3 py-3 text-sm pr-11 transition-shadow",
                    "focus:outline-none focus:ring-2 focus:ring-[#FE6A2E]/25 focus:border-orange-200/80",
                    uploading && "opacity-80"
                  )}
                />
                {uploading && (
                  <span
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full border-2 border-orange-200 border-t-[#FE6A2E] animate-spin pointer-events-none"
                    aria-hidden
                  />
                )}
              </div>
            </label>
            <div className="block">
              <span className="text-sm font-semibold text-gray-800">Type de contrat</span>
              <SelectMenu
                label="Type de contrat"
                options={CONTRACT_SELECT_OPTIONS}
                value={coachContrat}
                onChange={(v) => setCoachContrat(v as Campaign["contract_type"] | "")}
                placeholder="Choisir…"
                disabled={analysisPhase === "analyzing"}
                dense
              />
            </div>
            <div className="block">
              <span className="text-sm font-semibold text-gray-800">Profil (optionnel)</span>
              <SelectMenu
                label="Profil (optionnel)"
                options={PROFIL_SELECT_OPTIONS}
                value={coachProfilHint}
                onChange={(v) =>
                  setCoachProfilHint(v as "" | "etudiant" | "jeune_actif" | "reconversion")
                }
                disabled={analysisPhase === "analyzing"}
                dense
              />
            </div>
          </div>
          </div>
        </div>

        <div
          id="cv-upload-zone"
          className="rounded-2xl border bg-white shadow-sm overflow-hidden"
          style={{ borderColor: BD, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
        >
          <div className="h-1 w-full opacity-90" style={{ background: CTA_GRAD }} aria-hidden />
          <div className="p-6 sm:p-8">
          {!hasParsed && !uploading ? (
            <label className="block cursor-pointer">
              <div
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                className={cn(
                  "border-2 border-dashed rounded-2xl min-h-[240px] flex flex-col items-center justify-center px-6 py-12 text-center transition-colors",
                  dragOver
                    ? "border-[#FE6A2E]/50 bg-orange-50/70 ring-2 ring-[#FE6A2E]/15"
                    : "border-gray-200 bg-gradient-to-b from-gray-50/80 to-white"
                )}
              >
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center mb-5 shadow-sm ring-1 ring-black/[0.04]"
                  style={{ background: ORANGE_LIGHT, color: ORANGE }}
                >
                  <svg
                    className="w-7 h-7"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.75}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                    />
                  </svg>
                </div>
                <p className="text-gray-900 font-semibold text-base max-w-sm">
                  Glissez-déposez votre CV ici ou cliquez pour parcourir
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  Formats acceptés : PDF, DOCX (max 10 Mo)
                </p>
                <span
                  className="mt-8 inline-flex items-center justify-center px-8 py-3 rounded-xl text-sm font-semibold text-white shadow-md hover:opacity-95 transition-opacity"
                  style={{ background: CTA_GRAD }}
                >
                  Parcourir les fichiers
                </span>
              </div>
              <input type="file" className="sr-only" accept={accept} onChange={onFileInput} />
            </label>
          ) : uploading ? (
            <div className="border-2 border-dashed border-gray-200 rounded-2xl min-h-[240px] flex flex-col items-center justify-center bg-gray-50/60">
              <span
                className="w-10 h-10 rounded-full border-[3px] border-orange-200 border-t-[#FE6A2E] animate-spin mb-4"
                aria-hidden
              />
              <p className="text-sm font-medium text-gray-700">Analyse du fichier en cours…</p>
              <p className="text-xs text-gray-500 mt-1">Extraction IA des informations</p>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div
                className="flex items-center gap-3 rounded-xl border px-4 py-4 flex-1 min-w-0"
                style={{ borderColor: BD, background: ORANGE_LIGHT }}
              >
                <FileText className="h-8 w-8 shrink-0 text-[#FE6A2E]" strokeWidth={1.5} aria-hidden />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {fileLabel || "CV enregistré"}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">Fichier prêt — vérifie les données ci-dessous</p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 shrink-0 w-full sm:w-auto">
                {onRemoveCv && (
                  <button
                    type="button"
                    disabled={removingCv || uploading || analysisPhase === "analyzing"}
                    onClick={() => void onRemoveCv()}
                    className="inline-flex justify-center items-center px-5 py-3 rounded-xl text-sm font-semibold border border-red-200 text-red-700 bg-white hover:bg-red-50 disabled:opacity-40"
                  >
                    {removingCv ? "Suppression…" : "Supprimer"}
                  </button>
                )}
                <label className="inline-flex justify-center items-center px-5 py-3 rounded-xl text-sm font-semibold text-white cursor-pointer hover:opacity-95 shadow-md hover:shadow-lg transition-shadow" style={{ background: CTA_GRAD }}>
                  Remplacer le fichier
                  <input type="file" className="hidden" accept={accept} onChange={onFileInput} />
                </label>
              </div>
            </div>
          )}
          </div>
        </div>
      </section>
      )}

      {flowStep === "extracted_gate" &&
        hasParsed &&
        analysisPhase !== "hub" &&
        analysisPhase !== "analyzing" && (
          <section
            className="rounded-2xl border bg-white shadow-sm overflow-hidden"
            style={{ borderColor: BD, boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}
          >
            <div className="p-6 sm:p-8">
              <div className="flex gap-3">
                <span
                  className="shrink-0 flex h-10 w-10 items-center justify-center rounded-full"
                  style={{ background: "#EDE9FE", color: "#5B21B6" }}
                  aria-hidden
                >
                  <CheckCircle2 className="h-5 w-5" strokeWidth={2} />
                </span>
                <div className="min-w-0 flex-1">
                  <h2
                    className="text-lg font-bold text-gray-900"
                    style={{ fontFamily: "var(--font-syne)", color: "#5B21B6" }}
                  >
                    Extraction terminée
                  </h2>
                  <p className="text-sm text-gray-600 mt-2 leading-relaxed">
                    L’IA a lu ton fichier et extrait tes informations. Ouvre l’écran de vérification pour
                    corriger si besoin avant l’analyse coach.
                  </p>
                  <button
                    type="button"
                    onClick={onOpenCvInfos}
                    className="mt-5 inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-sm font-semibold text-white shadow-md hover:shadow-lg transition-shadow"
                    style={{ background: CTA_GRAD }}
                  >
                    <ClipboardList className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
                    Voir les informations du CV
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

      {/* Après upload : vérification des champs extraits */}
      {hasParsed &&
        cv &&
        analysisPhase !== "analyzing" &&
        !(coachResult && analysisPhase === "results") &&
        analysisPhase !== "hub" &&
        flowStep === "verify" && (
        <section
          id="cv-verify-section"
          className="overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-[0_4px_24px_-4px_rgba(15,23,42,0.08),0_12px_40px_-12px_rgba(254,106,46,0.1)]"
        >
          <div className="h-1 w-full bg-gradient-to-r from-[#FE6A2E] to-[#FFB347]" aria-hidden />
          <div className="bg-gradient-to-b from-stone-50/90 to-white px-5 pb-8 pt-6 sm:px-8 sm:pt-8">
          {cvDataEditFromHub && (
            <button
              type="button"
              onClick={() => onCancelCvDataEditFromHub?.()}
              className="group mb-6 inline-flex items-center gap-2 text-sm font-medium text-neutral-600 transition-colors hover:text-[#FE6A2E]"
            >
              <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" strokeWidth={2} aria-hidden />
              Retour au résumé Mon CV
            </button>
          )}
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-1">
              <h2
                className="text-xl font-bold tracking-tight text-neutral-900 sm:text-2xl"
                style={{ fontFamily: "var(--font-syne)" }}
              >
                Vérifiez vos informations
              </h2>
              <p className="max-w-xl text-sm leading-relaxed text-neutral-500">
                L’IA a pré-rempli les champs ci-dessous. Corrige si besoin puis enregistre.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <div className="rounded-full border border-neutral-200/80 bg-white px-3 py-1.5 text-xs font-medium text-neutral-600 shadow-sm">
                <span className="text-[#FE6A2E]">{verifyStep + 1}</span>
                <span className="text-neutral-400"> / {VERIFY_LABELS.length}</span>
              </div>
              <div className="h-10 w-px bg-neutral-200" aria-hidden />
              <div className="text-right">
                <p className="text-2xl font-bold tabular-nums leading-none text-[#FE6A2E]" style={{ fontFamily: "var(--font-syne)" }}>
                  {Math.round(((verifyStep + 1) / VERIFY_LABELS.length) * 100)}%
                </p>
                <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-neutral-400">
                  complété
                </p>
              </div>
            </div>
          </div>
          <div className="mb-8 h-2 overflow-hidden rounded-full bg-neutral-100/90">
            <div
              className="h-full rounded-full transition-all duration-500 ease-out"
              style={{
                width: `${((verifyStep + 1) / VERIFY_LABELS.length) * 100}%`,
                background: CTA_GRAD,
              }}
            />
          </div>
          <div className="mb-8 rounded-2xl border border-neutral-100 bg-white/70 p-2 shadow-inner sm:p-3">
            <div className="flex gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:justify-between">
            {VERIFY_LABELS.map((label, i) => {
              const Icon = VERIFY_STEP_ICONS[i];
              const done = i < verifyStep;
              const active = i === verifyStep;
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => setVerifyStep(i)}
                  className={cn(
                    "flex min-w-[72px] shrink-0 flex-col items-center gap-2 rounded-xl px-2 py-3 transition-all duration-200 sm:min-w-0 sm:flex-1",
                    active &&
                      "bg-white shadow-md ring-1 ring-neutral-200/80 ring-offset-2 ring-offset-stone-50",
                    done && !active && "bg-emerald-50/80 text-emerald-800",
                    !done && !active && "bg-transparent text-neutral-400 hover:bg-neutral-50/80 hover:text-neutral-600"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-xl transition-colors",
                      active && "bg-gradient-to-br from-orange-50 to-amber-50 text-[#FE6A2E] shadow-sm",
                      done && !active && "bg-emerald-100/80 text-emerald-700",
                      !done && !active && "bg-neutral-100 text-neutral-400"
                    )}
                    aria-hidden
                  >
                    {done && !active ? (
                      <Check className="h-5 w-5" strokeWidth={2.5} />
                    ) : (
                      <Icon className="h-5 w-5" strokeWidth={1.75} />
                    )}
                  </span>
                  <span
                    className={cn(
                      "max-w-[4.5rem] text-center text-[10px] font-semibold leading-tight sm:max-w-none sm:text-[11px]",
                      active && "text-neutral-900",
                      done && !active && "text-emerald-800",
                      !done && !active && "text-neutral-500"
                    )}
                  >
                    {label}
                  </span>
                </button>
              );
            })}
            </div>
          </div>
          {saveMessage && (
            <p
              className={cn(
                "mb-6 rounded-xl border px-4 py-3 text-sm",
                saveStatus === "ok" && "border-emerald-200 bg-emerald-50/90 text-emerald-900",
                saveStatus === "err" && "border-red-200 bg-red-50/90 text-red-900"
              )}
            >
              {saveMessage}
            </p>
          )}
          <div className="rounded-2xl border border-neutral-100 bg-white/90 p-5 shadow-sm sm:p-6">
            <CvVerifyFormSteps step={verifyStep} draft={cvDraft} setDraft={setCvDraft} />
          </div>
          <div className="mt-8 flex flex-col gap-4 border-t border-neutral-100 pt-8 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <button
              type="button"
              disabled={verifyStep === 0}
              onClick={() => setVerifyStep((s) => Math.max(0, s - 1))}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-700 shadow-sm transition-colors hover:bg-neutral-50 disabled:pointer-events-none disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" strokeWidth={2} aria-hidden />
              Précédent
            </button>
            <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
              <button
                type="button"
                disabled={saveStatus === "saving" || dossierValidating}
                onClick={() => void handleValidateDossier()}
                className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg hover:brightness-[1.02] disabled:opacity-50"
                style={{ background: CTA_GRAD }}
              >
                {dossierValidating ? "Validation…" : "Valider mon dossier"}
              </button>
              {verifyStep < VERIFY_LABELS.length - 1 && (
                <button
                  type="button"
                  disabled={dossierValidating}
                  onClick={() => setVerifyStep((s) => Math.min(VERIFY_LABELS.length - 1, s + 1))}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-[#FE6A2E] bg-white px-5 py-2.5 text-sm font-semibold text-[#C2410C] transition-colors hover:bg-orange-50/90 disabled:opacity-40"
                >
                  Suivant
                  <ChevronRight className="h-4 w-4" strokeWidth={2} aria-hidden />
                </button>
              )}
            </div>
          </div>
          </div>
        </section>
      )}

      {/* Progression analyse */}
      {analysisPhase === "analyzing" && (
        <section
          className="rounded-2xl border bg-white shadow-sm space-y-6 overflow-hidden"
          style={{ borderColor: BD, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
        >
          <div className="h-1 w-full" style={{ background: CTA_GRAD }} aria-hidden />
          <div className="p-6 sm:p-8 space-y-6">
          <div>
            <p className="text-sm font-medium text-gray-600 mb-1">
              {ANALYSIS_STEPS[activeAnalysisStep]}
            </p>
            <p
              className="text-4xl font-bold tabular-nums"
              style={{ color: ORANGE, fontFamily: "var(--font-syne)" }}
            >
              {Math.round(analysisProgress)}%
            </p>
            <div className="h-3 rounded-full bg-gray-100 mt-4 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300 ease-out"
                style={{
                  width: `${Math.min(100, analysisProgress)}%`,
                  background: CTA_GRAD,
                }}
              />
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Étapes de l’analyse
            </p>
            <ul className="space-y-2">
              {ANALYSIS_STEPS.map((label, i) => {
                const done = i < activeAnalysisStep || analysisProgress >= 95;
                const active = i === activeAnalysisStep && analysisProgress < 95;
                return (
                  <li
                    key={label}
                    className="flex items-center justify-between text-sm py-2 border-b border-gray-50 last:border-0"
                  >
                    <span
                      className={
                        done ? "text-green-600" : active ? "text-[#FE6A2E] font-medium" : "text-gray-400"
                      }
                    >
                      {done ? "✓ " : active ? "◉ " : "○ "}
                      {label}
                    </span>
                    <span className="text-xs text-gray-400 tabular-nums">
                      {done ? "100%" : active ? `${Math.round(analysisProgress)}%` : "—"}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
          <div
            className="rounded-xl border px-4 py-3 text-sm flex gap-3"
            style={{
              background: CALLOUT_BG,
              borderColor: CALLOUT_BORDER,
              color: "#7C2D12",
            }}
          >
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-800/80" strokeWidth={2} aria-hidden />
            <p>
              <strong>Patience :</strong> l’analyse prend entre 40 secondes et 1 minute. Ne quitte pas la page
              pendant le traitement.
            </p>
          </div>
          <div
            className="rounded-xl border p-4"
            style={{ borderColor: BD, background: ORANGE_LIGHT }}
          >
            <p className="text-xs font-semibold text-[#C2410C] text-center mb-2 tracking-wide">
              CONSEIL PRATIQUE
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                aria-label="Conseil précédent"
                className="shrink-0 w-8 h-8 rounded-full border border-gray-200 hover:bg-white text-gray-600"
                onClick={() => setTipIndex((i) => (i - 1 + PRACTICAL_TIPS.length) % PRACTICAL_TIPS.length)}
              >
                ‹
              </button>
              <p className="text-sm text-gray-700 text-center flex-1 min-h-[3rem] flex items-center justify-center">
                {PRACTICAL_TIPS[tipIndex]}
              </p>
              <button
                type="button"
                aria-label="Conseil suivant"
                className="shrink-0 w-8 h-8 rounded-full border border-gray-200 hover:bg-white text-gray-600"
                onClick={() => setTipIndex((i) => (i + 1) % PRACTICAL_TIPS.length)}
              >
                ›
              </button>
            </div>
          </div>
          <div className="flex justify-center py-4">
            <div className="w-10 h-10 rounded-full animate-spin border-[3px] border-orange-200 border-t-[#FE6A2E]" />
          </div>
          </div>
        </section>
      )}

      {analysisPhase === "setup" &&
        !coachResult &&
        hasParsed &&
        flowStep !== "extracted_gate" &&
        flowStep !== "verify" && (
        <div
          id="lancer-analyse-block"
          className="flex flex-col items-center gap-3 scroll-mt-24"
        >
          <button
            type="button"
            disabled={!hasParsed || !coachPoste.trim() || !coachContrat || uploading}
            onClick={onStartAnalysis}
            className="w-full max-w-md py-3.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed shadow-md hover:shadow-lg transition-shadow"
            style={{ background: CTA_GRAD }}
          >
            Lancer l’analyse de mon CV
          </button>
          {(!coachPoste.trim() || !coachContrat) && hasParsed && (
            <p className="text-xs text-amber-700">Renseigne l’intitulé du poste et le type de contrat.</p>
          )}
          {flowStep === "before_coach" && (
            <button
              type="button"
              onClick={() => onOpenCvInfos?.()}
              className="text-sm font-medium text-[#FE6A2E] hover:underline"
            >
              Voir ou modifier les données extraites du CV
            </button>
          )}
        </div>
      )}

      {coachError && (
        <div className="text-sm px-4 py-3 rounded-xl border border-red-200 bg-red-50 text-red-900">
          {coachError}
        </div>
      )}

      {coachResult && analysisPhase === "results" && (
        <>
          <ResultatsJobea
            analysis={coachResult}
            coachPoste={coachPoste}
            coachContrat={coachContrat}
            firstName={profile?.full_name?.split(/\s+/)[0]}
            profileFullName={profile?.full_name}
            cvParsed={profile?.cv_parsed ?? null}
            onOpenDetail={() => {
              setDetailOpen(true);
              setDetailStep(1);
            }}
          />
          <div className="flex justify-center pt-2 pb-4">
            <button
              type="button"
              onClick={onStartCampaigns}
              className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl text-sm font-semibold text-white shadow-md hover:shadow-lg transition-shadow"
              style={{ background: CTA_GRAD }}
            >
              Commencer à candidater
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function ResultatsJobea(props: {
  analysis: CvCoachAnalysis;
  coachPoste: string;
  coachContrat: string;
  firstName?: string;
  profileFullName?: string | null;
  cvParsed: CvParsed | null;
  onOpenDetail: () => void;
}) {
  const { analysis, coachPoste, coachContrat, firstName, profileFullName, cvParsed, onOpenDetail } =
    props;
  const sg = Math.min(100, Math.max(0, Number(analysis.score_global) || 0));
  const sp = Math.min(100, Math.max(0, Number(analysis.score_potentiel) || 0));
  const delta = Math.max(0, sp - sg);
  const hue = scoreHue(sg);
  const photo = analysis.analyse_sections?.photo as
    | { presente?: boolean; commentaire?: string }
    | undefined;
  const secteurs = Array.isArray(analysis.secteurs_compatibles)
    ? analysis.secteurs_compatibles
    : [];
  const alts = analysis.objectif_recherche?.alternatives ?? [];
  const forts = Array.isArray(analysis.points_forts) ? analysis.points_forts : [];
  const ameliorer = Array.isArray(analysis.points_ameliorer) ? analysis.points_ameliorer : [];
  const plan = Array.isArray(analysis.plan_action) ? analysis.plan_action : [];

  const fortsBullets = forts.slice(0, 6).map((f) =>
    [f.titre, f.description].filter(Boolean).join(" — ").trim()
  );
  const amelBullets = ameliorer.slice(0, 6).map((a) =>
    [a.titre, a.description].filter(Boolean).join(" — ").trim()
  );
  const conseilBullets = plan.slice(0, 6).map((p) =>
    [p.action, p.exemple_concret].filter(Boolean).join(" · ").trim()
  );

  const infoRows = cvInfoRows(cvParsed, profileFullName);
  const expRows = cvExperienceRows(cvParsed);

  return (
    <div id="cv-analysis-print" className="space-y-8 print:space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between print:flex-row">
        <div className="min-w-0 space-y-1">
          <h2
            className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight"
            style={{ fontFamily: "var(--font-syne)" }}
          >
            Analyse de ton CV
          </h2>
          <p className="text-sm text-gray-500 leading-relaxed max-w-xl">
            Synthèse de ton profil, de ton score et des leviers pour progresser.
          </p>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 shadow-sm transition-colors hover:border-orange-200 hover:bg-orange-50/50 print:hidden"
        >
          <FileDown className="h-4 w-4 opacity-80" strokeWidth={2} aria-hidden />
          Exporter en PDF
        </button>
      </div>

      <div
        className="rounded-3xl border bg-white overflow-hidden shadow-sm"
        style={{
          borderColor: BD,
          boxShadow: "0 1px 2px rgba(15,23,42,0.04), 0 16px 48px -16px rgba(254, 106, 46, 0.1)",
        }}
      >
        <div className="h-1 w-full" style={{ background: CTA_GRAD }} aria-hidden />
        <div className="flex flex-col gap-10 p-6 sm:p-8 lg:flex-row lg:items-start lg:gap-12">
          <div className="flex flex-col items-center lg:w-[11rem]">
            <CvScoreRing value={sg} hue={hue} />
            <p className="mt-4 text-center text-sm font-semibold" style={{ color: hue }}>
              {analysis.niveau}
            </p>
            <p className="mt-1 text-center text-xs text-gray-500">
              Profil : <span className="font-medium text-gray-700">{analysis.profil_detecte}</span>
            </p>
            <div
              className="mt-4 w-full max-w-[10rem] rounded-full bg-gray-100 p-0.5"
              aria-hidden
            >
              <div
                className="h-1.5 rounded-full transition-all"
                style={{ width: `${sg}%`, background: hue }}
              />
            </div>
          </div>

          <div className="min-w-0 flex-1 space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Analyse détaillée
            </h3>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-gray-100 bg-[#FAFAF9] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#FE6A2E] mb-3">
                  Points forts
                </p>
                <ul className="space-y-2.5 text-sm text-gray-700">
                  {fortsBullets.length === 0 ? (
                    <li className="text-gray-400">—</li>
                  ) : (
                    fortsBullets.map((t, i) => (
                      <li key={i} className="flex gap-2 leading-snug">
                        <span
                          className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#FE6A2E]"
                          aria-hidden
                        />
                        <span>{t}</span>
                      </li>
                    ))
                  )}
                </ul>
              </div>
              <div className="rounded-2xl border border-gray-100 bg-[#FAFAF9] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700 mb-3">
                  Points d’amélioration
                </p>
                <ul className="space-y-2.5 text-sm text-gray-700">
                  {amelBullets.length === 0 ? (
                    <li className="text-gray-400">—</li>
                  ) : (
                    amelBullets.map((t, i) => (
                      <li key={i} className="flex gap-2 leading-snug">
                        <span
                          className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500"
                          aria-hidden
                        />
                        <span>{t}</span>
                      </li>
                    ))
                  )}
                </ul>
              </div>
              <div className="rounded-2xl border border-gray-100 bg-[#FAFAF9] p-4 sm:col-span-3 lg:col-span-1">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-3">
                  Conseils
                </p>
                <ul className="space-y-2.5 text-sm text-gray-700">
                  {conseilBullets.length === 0 ? (
                    <li className="text-gray-400">—</li>
                  ) : (
                    conseilBullets.map((t, i) => (
                      <li key={i} className="flex gap-2 leading-snug">
                        <span
                          className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-400"
                          aria-hidden
                        />
                        <span>{t}</span>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            </div>

            {analysis.synthese?.texte && (
              <div
                className="rounded-2xl border p-4 text-sm text-gray-700 leading-relaxed"
                style={{ background: CALLOUT_BG, borderColor: CALLOUT_BORDER }}
              >
                {analysis.synthese.texte}
              </div>
            )}

            <div
              className="flex flex-wrap items-center gap-2 rounded-2xl border px-4 py-3 text-sm"
              style={{ borderColor: CALLOUT_BORDER, background: ORANGE_LIGHT }}
            >
              <span className="font-semibold text-[#9A3412]">Score potentiel</span>
              <span className="text-gray-700">
                jusqu’à <strong>{sp}/100</strong>
                {delta > 0 ? ` (+${delta})` : ""} après corrections ciblées.
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 print:grid-cols-2">
        <div
          className="rounded-2xl border bg-white p-5 sm:p-6 shadow-sm"
          style={{ borderColor: BD }}
        >
          <div className="mb-4 flex items-center justify-between gap-2">
            <h3 className="text-base font-bold text-gray-900" style={{ fontFamily: "var(--font-syne)" }}>
              Tes informations
            </h3>
          </div>
          <dl className="space-y-3 text-sm">
            {infoRows.map((row) => (
              <div key={row.k} className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
                <dt className="shrink-0 text-gray-500 sm:w-32">{row.k}</dt>
                <dd className="font-medium text-gray-900 break-words">{row.v}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div
          className="rounded-2xl border bg-white p-5 sm:p-6 shadow-sm"
          style={{ borderColor: BD }}
        >
          <h3 className="mb-4 text-base font-bold text-gray-900" style={{ fontFamily: "var(--font-syne)" }}>
            Tes expériences
          </h3>
          {expRows.length === 0 ? (
            <p className="text-sm text-gray-400">Aucune expérience structurée dans le CV parsé.</p>
          ) : (
            <ul className="space-y-4">
              {expRows.map((e, i) => (
                <li key={i} className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                  <p className="font-semibold text-gray-900">{e.title}</p>
                  {e.sub ? <p className="mt-0.5 text-sm text-gray-500">{e.sub}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div
        className="rounded-2xl border bg-white p-5 sm:p-6 shadow-sm"
        style={{ borderColor: BD, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
      >
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-lg" aria-hidden>
            🎯
          </span>
          <h3 className="font-bold text-gray-900">Objectif de recherche</h3>
          {coachContrat && (
            <span
              className="ml-auto text-xs font-bold px-2.5 py-1 rounded-full"
              style={{ background: ORANGE_LIGHT, color: "#C2410C" }}
            >
              {contractBadge(coachContrat)}
            </span>
          )}
        </div>
        <p className="text-sm font-medium text-gray-800">{coachPoste || "—"}</p>
        {(analysis.objectif_recherche?.evaluation || analysis.objectif_recherche?.adequation) && (
          <div className="mt-3 space-y-2 text-sm text-gray-600">
            {analysis.objectif_recherche.evaluation && <p>{analysis.objectif_recherche.evaluation}</p>}
            {analysis.objectif_recherche.adequation && <p>{analysis.objectif_recherche.adequation}</p>}
          </div>
        )}
      </div>

      {alts.length > 0 && (
        <div
          className="rounded-2xl border bg-white p-5 sm:p-6 shadow-sm"
          style={{ borderColor: BD, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
        >
          <h3 className="mb-3 font-bold text-gray-900">Pistes de postes</h3>
          <div className="flex flex-wrap gap-2">
            {alts.map((a, i) => (
              <span
                key={i}
                className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs text-gray-800"
              >
                {a}
              </span>
            ))}
          </div>
        </div>
      )}

      <div
        className="rounded-2xl border bg-white p-5 sm:p-6 shadow-sm"
        style={{ borderColor: BD, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-lg" aria-hidden>
              📷
            </span>
            <div>
              <h3 className="font-bold text-gray-900">Photo</h3>
              <p className="text-xs text-gray-500">Appréciation IA</p>
            </div>
          </div>
          <span className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600">
            {photo?.presente ? "Présente" : "Absente"}
          </span>
        </div>
        <div
          className="rounded-xl border p-4 text-sm text-gray-700"
          style={{ background: CALLOUT_BG, borderColor: CALLOUT_BORDER }}
        >
          {photo?.commentaire ||
            "Aucune photo détectée : choix valable ; une photo pro peut aider en entretien."}
        </div>
      </div>

      {secteurs.length > 0 && (
        <div
          className="rounded-2xl border bg-white p-5 sm:p-6 shadow-sm"
          style={{ borderColor: BD, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="font-bold text-gray-900">
              Secteurs compatibles{firstName ? `, ${firstName}` : ""}
            </h3>
            <span
              className="rounded-full px-2 py-1 text-xs font-semibold"
              style={{ background: ORANGE_LIGHT, color: "#C2410C" }}
            >
              {secteurs.length}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {secteurs.slice(0, 12).map((s, i) => (
              <span
                key={i}
                className="rounded-full border px-3 py-1.5 text-xs font-medium"
                style={{
                  background: ORANGE_LIGHT,
                  color: "#9A3412",
                  borderColor: CALLOUT_BORDER,
                }}
              >
                {s.nom}
              </span>
            ))}
            {secteurs.length > 12 && (
              <span className="rounded-full bg-gray-100 px-3 py-1.5 text-xs text-gray-600">
                +{secteurs.length - 12}
              </span>
            )}
          </div>
        </div>
      )}

      <div className="flex justify-center pt-1 print:hidden">
        <button
          type="button"
          onClick={onOpenDetail}
          className="rounded-xl px-8 py-3 text-sm font-semibold text-white shadow-md transition-shadow hover:shadow-lg"
          style={{ background: CTA_GRAD }}
        >
          Voir l’analyse détaillée →
        </button>
      </div>
    </div>
  );
}

function AnalyseDetaillee(props: {
  analysis: CvCoachAnalysis;
  step: number;
  onStep: (n: number) => void;
  onClose: () => void;
}) {
  const { analysis, step, onStep, onClose } = props;
  const forts = Array.isArray(analysis.points_forts) ? analysis.points_forts : [];
  const ameliorer = Array.isArray(analysis.points_ameliorer) ? analysis.points_ameliorer : [];
  const plan = Array.isArray(analysis.plan_action) ? analysis.plan_action : [];

  const title =
    step === 1 ? "Vos points forts" : step === 2 ? "Points à améliorer" : "Corrections recommandées";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900" style={{ fontFamily: "var(--font-syne)" }}>
          Analyse détaillée
        </h2>
        <p className="text-sm text-gray-500 mt-1">Étape {step} sur 3</p>
        <div className="h-2 rounded-full bg-gray-100 mt-4 overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${(step / 3) * 100}%`, background: CTA_GRAD }}
          />
        </div>
        <div className="flex justify-center gap-2 mt-3">
          {[1, 2, 3].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onStep(n)}
              className={cn(
                "w-2.5 h-2.5 rounded-full transition-all",
                n === step ? "scale-125 shadow-sm" : "bg-gray-300"
              )}
              style={n === step ? { background: ORANGE } : undefined}
              aria-label={`Étape ${n}`}
            />
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
        {step === 1 && <span className="text-green-500">★</span>}
        {step === 2 && <span className="text-red-500">⚠</span>}
        {step === 3 && <span className="text-amber-500">🚀</span>}
        <h3 className="text-lg font-bold text-gray-900">{title}</h3>
      </div>

      {step === 1 && (
        <ul className="space-y-4">
          {forts.map((pf, i) => (
            <li
              key={i}
              className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm flex gap-3"
            >
              <span className="text-green-500 text-xl shrink-0">✓</span>
              <div>
                <p className="font-bold text-gray-900">{pf.titre}</p>
                <p className="text-sm text-gray-600 mt-2">{pf.description}</p>
                {pf.impact && (
                  <p className="text-xs text-gray-500 mt-2">Impact : {pf.impact}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {step === 2 && (
        <ul className="space-y-4">
          {ameliorer.map((pa, i) => {
            const sev = prioriteToSeverity(pa.priorite);
            return (
              <li
                key={i}
                className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"
                style={{
                  borderLeftWidth: 4,
                  borderLeftColor: sev === "MAJOR" ? "#EA580C" : "#EAB308",
                }}
              >
                <div className="flex flex-wrap gap-2 mb-3">
                  <span
                    className={cn(
                      "text-[10px] font-bold uppercase px-2 py-1 rounded-full",
                      sev === "MAJOR" ? "bg-orange-500 text-white" : "bg-yellow-400 text-gray-900"
                    )}
                  >
                    {sev === "MAJOR" ? "! MAJOR" : "! MINOR"}
                  </span>
                  <span className="text-[10px] font-medium px-2 py-1 rounded-full border border-gray-200 text-gray-600">
                    {pa.section || "Section"}
                  </span>
                </div>
                <p className="font-bold text-gray-900">{pa.titre}</p>
                <p className="text-sm text-gray-600 mt-2">{pa.description}</p>
                {pa.suggestion_concrete && (
                  <div className="mt-4 rounded-xl bg-gray-50 border border-gray-100 p-3 text-sm">
                    <p className="text-xs font-semibold text-gray-500 mb-1">Exemple</p>
                    {(() => {
                      const { avant, apres, brut } = parseAvantApres(pa.suggestion_concrete);
                      if (avant || apres) {
                        return (
                          <>
                            {avant && (
                              <p className="text-gray-700">
                                <span className="font-semibold">AVANT :</span> {avant}
                              </p>
                            )}
                            {apres && (
                              <p className="text-gray-700 mt-2">
                                <span className="font-semibold">APRÈS :</span> {apres}
                              </p>
                            )}
                          </>
                        );
                      }
                      return <p className="text-gray-700">{brut}</p>;
                    })()}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {step === 3 && (
        <ul className="space-y-5">
          {plan
            .slice()
            .sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0))
            .map((row, i) => {
              const pri = difficulteToPriority(row.difficulte);
              const { avant, apres, brut } = parseAvantApres(row.exemple_concret || "");
              return (
                <li key={i} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap gap-2 mb-3">
                    <span
                      className={cn(
                        "text-[10px] font-bold uppercase px-2 py-1 rounded-full text-white",
                        pri === "HIGH"
                          ? "bg-orange-600"
                          : pri === "MEDIUM"
                            ? "bg-amber-500"
                            : "bg-slate-500"
                      )}
                    >
                      {pri}
                    </span>
                    <span className="text-[10px] font-medium px-2 py-1 rounded-full border border-gray-200 text-gray-600">
                      {row.section_concernee || "global"}
                    </span>
                    {row.impact_score != null && (
                      <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-green-100 text-green-800">
                        +{row.impact_score} pts
                      </span>
                    )}
                  </div>
                  <p className="font-bold text-gray-900">{row.action}</p>
                  <div className="mt-4 rounded-xl bg-gray-50 border border-gray-100 p-4 text-sm">
                    <p className="text-xs font-semibold text-gray-500 mb-2">Exemple :</p>
                    {avant || apres ? (
                      <div className="space-y-2 text-gray-700">
                        {avant && (
                          <p>
                            <span className="font-semibold">AVANT :</span> {avant}
                          </p>
                        )}
                        {apres && (
                          <p>
                            <span className="font-semibold">APRÈS :</span> {apres}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-gray-700">{brut}</p>
                    )}
                  </div>
                </li>
              );
            })}
        </ul>
      )}

      <div className="flex justify-between pt-6 border-t border-gray-100">
        <button
          type="button"
          onClick={() => (step > 1 ? onStep(step - 1) : onClose())}
          className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          {step > 1 ? "< Retour" : "< Retour aux résultats"}
        </button>
        {step < 3 ? (
          <button
            type="button"
            onClick={() => onStep(step + 1)}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white shadow-md hover:shadow-lg transition-shadow"
            style={{ background: CTA_GRAD }}
          >
            Suivant →
          </button>
        ) : (
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white shadow-md hover:shadow-lg transition-shadow"
            style={{ background: CTA_GRAD }}
          >
            Terminer
          </button>
        )}
      </div>
    </div>
  );
}
