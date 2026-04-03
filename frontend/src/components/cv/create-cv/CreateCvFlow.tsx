"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  Loader2,
  Plus,
  Trash2,
  User,
  Briefcase,
  GraduationCap,
  Sparkles,
  FileCheck,
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import { api } from "@/lib/api";
import { getAccessTokenForApi } from "@/lib/auth-session";
import { cn } from "@/lib/utils";
import { SelectMenu, type SelectMenuOption } from "@/components/ui/select-menu";
import { enrichedCvToCvParsed } from "@/lib/create-cv-enriched-to-parsed";
import { formatDateEcriteFr, formatPeriodFr } from "@/lib/create-cv-dates";
import type { EnrichedCvJson } from "@/types/create-cv";
import {
  emptyCreateCvForm,
  emptyEducationInput,
  emptyExperienceInput,
  emptyLanguageInput,
  type CreateCvFormData,
} from "@/types/create-cv";
import { downloadElementAsA4Pdf } from "@/lib/download-cv-pdf";
import { CvA4PreviewShell } from "./cv-a4-preview-shell";
import { CvPhotoField } from "./cv-photo-field";
import { CvPreviewModernDark } from "./cv-preview-templates";

const STEPS = [
  { id: 1, label: "Infos perso", icon: User },
  { id: 2, label: "Expériences", icon: Briefcase },
  { id: 3, label: "Formations", icon: GraduationCap },
  { id: 4, label: "Compétences", icon: Sparkles },
  { id: 5, label: "Récapitulatif", icon: FileCheck },
] as const;

const LANG_LEVELS: SelectMenuOption[] = [
  { value: "Débutant", label: "Débutant" },
  { value: "Intermédiaire", label: "Intermédiaire" },
  { value: "Courant", label: "Courant" },
  { value: "Bilingue", label: "Bilingue" },
  { value: "Natif", label: "Natif" },
];

const inputClass =
  "w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-sm text-stone-900 shadow-sm outline-none transition-shadow focus:border-orange-200 focus:ring-2 focus:ring-[#FE6A2E]/20";

const CTA_GRAD = "linear-gradient(90deg, #FE6A2E, #FFB347)";

type Phase = "wizard" | "generating" | "result" | "error";

export function CreateCvFlow() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("wizard");
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<CreateCvFormData>(() => emptyCreateCvForm());
  const [skillInput, setSkillInput] = useState("");
  const [enriched, setEnriched] = useState<EnrichedCvJson | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  const updateForm = useCallback((patch: Partial<CreateCvFormData>) => {
    setForm((f) => ({ ...f, ...patch }));
  }, []);

  function validateStep(s: number): boolean {
    if (s === 1) {
      if (!form.first_name.trim() || !form.last_name.trim()) {
        setErrorMsg("Prénom et nom sont obligatoires.");
        return false;
      }
      if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
        setErrorMsg("Une adresse e-mail valide est obligatoire.");
        return false;
      }
    }
    setErrorMsg(null);
    return true;
  }

  const generateCv = useCallback(async () => {
    setPhase("generating");
    setErrorMsg(null);
    try {
      const supabase = createClient();
      const token = await getAccessTokenForApi(supabase);
      if (!token) {
        throw new Error("Session expirée. Reconnecte-toi.");
      }
      const res = await api<{ enriched: EnrichedCvJson }>("/api/cv/generate-from-form", {
        method: "POST",
        token,
        body: { formData: { ...form, photo_base64: null } },
      });
      setEnriched(res.enriched);
      setPhase("result");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Erreur lors de la génération.");
      setPhase("error");
    }
  }, [form]);

  async function handleValidateCv() {
    if (!enriched) return;
    setSaving(true);
    setErrorMsg(null);
    try {
      const supabase = createClient();
      const token = await getAccessTokenForApi(supabase);
      if (!token) throw new Error("Session expirée.");
      const cvParsed = enrichedCvToCvParsed(enriched);
      const fullName = `${enriched.prenom} ${enriched.nom}`.trim();
      await api("/api/profiles/me", {
        method: "PATCH",
        token,
        body: {
          full_name: fullName || undefined,
          cv_parsed: cvParsed,
          cv_score: 72,
        },
      });
      router.push("/cv");
      router.refresh();
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDownloadCvPdf() {
    if (!enriched) return;
    const el = document.getElementById("cv-print-area");
    if (!el) {
      setErrorMsg("Impossible de trouver l’aperçu du CV.");
      return;
    }
    setPdfLoading(true);
    setErrorMsg(null);
    try {
      const safe = `${enriched.prenom}-${enriched.nom}`.replace(/\s+/g, "-").toLowerCase();
      const name = safe ? `cv-${safe}.pdf` : "cv-postuly.pdf";
      await downloadElementAsA4Pdf(el, name);
    } catch (e) {
      setErrorMsg(
        e instanceof Error ? e.message : "La génération du PDF a échoué. Réessaie dans un instant."
      );
    } finally {
      setPdfLoading(false);
    }
  }

  function addSkill() {
    const t = skillInput.trim();
    if (!t) return;
    if (form.skills.includes(t)) return;
    setForm((f) => ({ ...f, skills: [...f.skills, t] }));
    setSkillInput("");
  }

  if (phase === "generating") {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4">
        <Loader2 className="h-10 w-10 animate-spin text-orange-500" aria-hidden />
        <p className="text-center text-sm font-medium text-stone-600">
          Génération de ton CV avec l’IA…
        </p>
      </div>
    );
  }

  if (phase === "result" && enriched) {
    return (
      <div className="mx-auto max-w-6xl space-y-8 px-4 pb-20 pt-6 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
            Aperçu de ton CV
          </h1>
          <button
            type="button"
            onClick={() => void generateCv()}
            className="text-sm font-medium text-orange-600 underline-offset-2 hover:underline"
          >
            Régénérer avec l’IA
          </button>
        </div>
        <p className="text-sm text-stone-500">
          Ajoute ou change ta photo ci-dessous, puis télécharge ton CV en PDF ou valide pour enregistrer sur
          ton profil.
        </p>

        <div className="mx-auto max-w-3xl rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
          <CvPhotoField
            photoBase64={form.photo_base64}
            onPhotoChange={(dataUrl) => updateForm({ photo_base64: dataUrl })}
            onPhotoError={(m) => setErrorMsg(m)}
            onPhotoSuccess={() => setErrorMsg(null)}
            variant="compact"
          />
        </div>

        <p className="mb-3 text-center text-sm font-medium text-stone-600">Aperçu de votre CV</p>
        <div
          className="mx-auto overflow-hidden rounded-xl"
          style={{
            background: "#f0f0f0",
            padding: "clamp(16px, 4vw, 32px)",
            borderRadius: 12,
            overscrollBehavior: "contain",
          }}
        >
          <CvA4PreviewShell>
            <CvPreviewModernDark
              enriched={enriched}
              photoBase64={form.photo_base64}
              printAreaId="cv-print-area"
            />
          </CvA4PreviewShell>
        </div>

        <div className="space-y-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <button
              type="button"
              disabled={pdfLoading}
              onClick={() => void handleDownloadCvPdf()}
              className="inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:opacity-95 disabled:opacity-60"
              style={{ background: CTA_GRAD }}
            >
              {pdfLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Génération du PDF…
                </>
              ) : (
                "Télécharger mon CV"
              )}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleValidateCv()}
              className="inline-flex items-center justify-center rounded-xl border border-stone-200 bg-white px-6 py-3 text-sm font-semibold text-stone-800 shadow-sm transition hover:bg-stone-50 disabled:opacity-50"
            >
              {saving ? "Enregistrement…" : "Je valide mon CV"}
            </button>
          </div>
          <p className="text-xs text-stone-500">
            L’aperçu respecte le ratio A4 sans défilement. Le PDF (une page, marges 15 mm) est généré depuis le
            même contenu — téléchargement direct, sans dialogue d’impression.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setPhase("wizard");
            setStep(1);
            setEnriched(null);
            setErrorMsg(null);
          }}
          className="flex items-center gap-2 text-sm font-medium text-stone-600 hover:text-orange-600"
        >
          <ArrowLeft className="h-4 w-4" />
          Modifier mes informations
        </button>

        {errorMsg && (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {errorMsg}
          </p>
        )}
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="mx-auto max-w-lg space-y-6 px-4 py-12 text-center">
        <p className="text-sm text-red-700">{errorMsg}</p>
        <button
          type="button"
          onClick={() => {
            setPhase("wizard");
            setStep(5);
            setErrorMsg(null);
          }}
          className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white"
          style={{ background: CTA_GRAD }}
        >
          Réessayer
        </button>
      </div>
    );
  }

  /* ——— Wizard ——— */
  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-6 sm:px-6">
      <Link
        href="/cv"
        className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-stone-500 hover:text-orange-600"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour à Mon CV
      </Link>

      <h1 className="text-2xl font-semibold tracking-tight text-stone-900 sm:text-3xl">
        Créer mon CV
      </h1>
      <p className="mt-2 text-sm text-stone-500">
        Remplis les étapes — l’IA enrichira le contenu à la fin.
      </p>

      {/* Progress */}
      <div className="mt-8">
        <div className="flex h-2 overflow-hidden rounded-full bg-stone-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-400 transition-all duration-300"
            style={{ width: `${((step - 1) / (STEPS.length - 1)) * 100}%` }}
          />
        </div>
        <ol className="mt-4 flex flex-wrap justify-between gap-2 text-[11px] font-medium text-stone-500 sm:text-xs">
          {STEPS.map((s) => {
            const Icon = s.icon;
            const active = step === s.id;
            const done = step > s.id;
            return (
              <li
                key={s.id}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-2 py-1",
                  active && "bg-orange-50 text-orange-700",
                  done && "text-emerald-600"
                )}
              >
                {done ? (
                  <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />
                ) : (
                  <Icon className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
                )}
                <span className="hidden sm:inline">{s.label}</span>
                <span className="sm:hidden">{s.id}</span>
              </li>
            );
          })}
        </ol>
      </div>

      {errorMsg && step !== 5 && (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {errorMsg}
        </p>
      )}

      <div className="mt-8 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-8">
        {step === 1 && (
          <div className="space-y-5">
            <h2 className="text-lg font-semibold text-stone-900">Informations personnelles</h2>
            <CvPhotoField
              photoBase64={form.photo_base64}
              onPhotoChange={(dataUrl) => updateForm({ photo_base64: dataUrl })}
              onPhotoError={(m) => setErrorMsg(m)}
              onPhotoSuccess={() => setErrorMsg(null)}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block sm:col-span-1">
                <span className="text-sm font-medium text-stone-700">Prénom *</span>
                <input
                  className={cn(inputClass, "mt-1.5")}
                  value={form.first_name}
                  onChange={(e) => updateForm({ first_name: e.target.value })}
                />
              </label>
              <label className="block sm:col-span-1">
                <span className="text-sm font-medium text-stone-700">Nom *</span>
                <input
                  className={cn(inputClass, "mt-1.5")}
                  value={form.last_name}
                  onChange={(e) => updateForm({ last_name: e.target.value })}
                />
              </label>
              <label className="block sm:col-span-1">
                <span className="text-sm font-medium text-stone-700">E-mail *</span>
                <input
                  type="email"
                  className={cn(inputClass, "mt-1.5")}
                  value={form.email}
                  onChange={(e) => updateForm({ email: e.target.value })}
                />
              </label>
              <label className="block sm:col-span-1">
                <span className="text-sm font-medium text-stone-700">Téléphone</span>
                <input
                  className={cn(inputClass, "mt-1.5")}
                  value={form.phone}
                  onChange={(e) => updateForm({ phone: e.target.value })}
                />
              </label>
              <label className="block sm:col-span-1">
                <span className="text-sm font-medium text-stone-700">Ville</span>
                <input
                  className={cn(inputClass, "mt-1.5")}
                  value={form.city}
                  onChange={(e) => updateForm({ city: e.target.value })}
                />
              </label>
              <label className="block sm:col-span-1">
                <span className="text-sm font-medium text-stone-700">LinkedIn</span>
                <input
                  className={cn(inputClass, "mt-1.5")}
                  value={form.linkedin}
                  onChange={(e) => updateForm({ linkedin: e.target.value })}
                  placeholder="https://…"
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-sm font-medium text-stone-700">Site web</span>
                <input
                  className={cn(inputClass, "mt-1.5")}
                  value={form.website}
                  onChange={(e) => updateForm({ website: e.target.value })}
                  placeholder="https://…"
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-sm font-medium text-stone-700">Résumé professionnel</span>
                <textarea
                  rows={4}
                  className={cn(inputClass, "mt-1.5 resize-y")}
                  value={form.summary}
                  onChange={(e) => updateForm({ summary: e.target.value })}
                  placeholder="Quelques lignes sur ton profil et tes objectifs."
                />
              </label>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-stone-900">Expériences professionnelles</h2>
            {form.experiences.map((ex, i) => (
              <div
                key={i}
                className="relative rounded-xl border border-stone-100 bg-stone-50/50 p-4"
              >
                {form.experiences.length > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        experiences: f.experiences.filter((_, j) => j !== i),
                      }))
                    }
                    className="absolute right-3 top-3 rounded-lg p-1.5 text-stone-400 hover:bg-red-50 hover:text-red-600"
                    aria-label="Supprimer cette expérience"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="sm:col-span-2">
                    <span className="text-xs font-medium text-stone-600">Intitulé du poste</span>
                    <input
                      className={cn(inputClass, "mt-1")}
                      value={ex.job_title}
                      onChange={(e) => {
                        const next = [...form.experiences];
                        next[i] = { ...ex, job_title: e.target.value };
                        setForm((f) => ({ ...f, experiences: next }));
                      }}
                    />
                  </label>
                  <label className="sm:col-span-2">
                    <span className="text-xs font-medium text-stone-600">Entreprise</span>
                    <input
                      className={cn(inputClass, "mt-1")}
                      value={ex.company}
                      onChange={(e) => {
                        const next = [...form.experiences];
                        next[i] = { ...ex, company: e.target.value };
                        setForm((f) => ({ ...f, experiences: next }));
                      }}
                    />
                  </label>
                  <label>
                    <span className="text-xs font-medium text-stone-600">Début</span>
                    <input
                      type="date"
                      className={cn(inputClass, "mt-1")}
                      value={ex.start_date}
                      onChange={(e) => {
                        const next = [...form.experiences];
                        next[i] = { ...ex, start_date: e.target.value };
                        setForm((f) => ({ ...f, experiences: next }));
                      }}
                    />
                  </label>
                  <label>
                    <span className="text-xs font-medium text-stone-600">Fin</span>
                    <input
                      type="date"
                      className={cn(inputClass, "mt-1")}
                      value={ex.end_date}
                      onChange={(e) => {
                        const next = [...form.experiences];
                        next[i] = { ...ex, end_date: e.target.value };
                        setForm((f) => ({ ...f, experiences: next }));
                      }}
                    />
                  </label>
                  <label className="sm:col-span-2">
                    <span className="text-xs font-medium text-stone-600">Ville</span>
                    <input
                      className={cn(inputClass, "mt-1")}
                      value={ex.city}
                      onChange={(e) => {
                        const next = [...form.experiences];
                        next[i] = { ...ex, city: e.target.value };
                        setForm((f) => ({ ...f, experiences: next }));
                      }}
                    />
                  </label>
                  <label className="sm:col-span-2">
                    <span className="text-xs font-medium text-stone-600">Description</span>
                    <textarea
                      rows={3}
                      className={cn(inputClass, "mt-1 resize-y")}
                      value={ex.description}
                      onChange={(e) => {
                        const next = [...form.experiences];
                        next[i] = { ...ex, description: e.target.value };
                        setForm((f) => ({ ...f, experiences: next }));
                      }}
                    />
                  </label>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                setForm((f) => ({ ...f, experiences: [...f.experiences, emptyExperienceInput()] }))
              }
              className="inline-flex items-center gap-2 rounded-xl border border-dashed border-orange-300 px-4 py-2.5 text-sm font-medium text-orange-700 hover:bg-orange-50"
            >
              <Plus className="h-4 w-4" />
              Ajouter une expérience
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-stone-900">Formations & diplômes</h2>
            {form.educations.map((ed, i) => (
              <div
                key={i}
                className="relative rounded-xl border border-stone-100 bg-stone-50/50 p-4"
              >
                {form.educations.length > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        educations: f.educations.filter((_, j) => j !== i),
                      }))
                    }
                    className="absolute right-3 top-3 rounded-lg p-1.5 text-stone-400 hover:bg-red-50 hover:text-red-600"
                    aria-label="Supprimer cette formation"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="sm:col-span-2">
                    <span className="text-xs font-medium text-stone-600">Diplôme</span>
                    <input
                      className={cn(inputClass, "mt-1")}
                      value={ed.diploma}
                      onChange={(e) => {
                        const next = [...form.educations];
                        next[i] = { ...ed, diploma: e.target.value };
                        setForm((f) => ({ ...f, educations: next }));
                      }}
                    />
                  </label>
                  <label className="sm:col-span-2">
                    <span className="text-xs font-medium text-stone-600">Établissement</span>
                    <input
                      className={cn(inputClass, "mt-1")}
                      value={ed.school}
                      onChange={(e) => {
                        const next = [...form.educations];
                        next[i] = { ...ed, school: e.target.value };
                        setForm((f) => ({ ...f, educations: next }));
                      }}
                    />
                  </label>
                  <label>
                    <span className="text-xs font-medium text-stone-600">Début</span>
                    <input
                      type="date"
                      className={cn(inputClass, "mt-1")}
                      value={ed.start_date}
                      onChange={(e) => {
                        const next = [...form.educations];
                        next[i] = { ...ed, start_date: e.target.value };
                        setForm((f) => ({ ...f, educations: next }));
                      }}
                    />
                  </label>
                  <label>
                    <span className="text-xs font-medium text-stone-600">Fin / diplôme</span>
                    <input
                      type="date"
                      className={cn(inputClass, "mt-1")}
                      value={ed.graduation_date}
                      onChange={(e) => {
                        const next = [...form.educations];
                        next[i] = { ...ed, graduation_date: e.target.value };
                        setForm((f) => ({ ...f, educations: next }));
                      }}
                    />
                  </label>
                  <label>
                    <span className="text-xs font-medium text-stone-600">Mention / note</span>
                    <input
                      className={cn(inputClass, "mt-1")}
                      value={ed.grade}
                      onChange={(e) => {
                        const next = [...form.educations];
                        next[i] = { ...ed, grade: e.target.value };
                        setForm((f) => ({ ...f, educations: next }));
                      }}
                    />
                  </label>
                  <label>
                    <span className="text-xs font-medium text-stone-600">Ville</span>
                    <input
                      className={cn(inputClass, "mt-1")}
                      value={ed.city}
                      onChange={(e) => {
                        const next = [...form.educations];
                        next[i] = { ...ed, city: e.target.value };
                        setForm((f) => ({ ...f, educations: next }));
                      }}
                    />
                  </label>
                  <label className="sm:col-span-2">
                    <span className="text-xs font-medium text-stone-600">Description</span>
                    <textarea
                      rows={2}
                      className={cn(inputClass, "mt-1 resize-y")}
                      value={ed.description}
                      onChange={(e) => {
                        const next = [...form.educations];
                        next[i] = { ...ed, description: e.target.value };
                        setForm((f) => ({ ...f, educations: next }));
                      }}
                    />
                  </label>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                setForm((f) => ({ ...f, educations: [...f.educations, emptyEducationInput()] }))
              }
              className="inline-flex items-center gap-2 rounded-xl border border-dashed border-orange-300 px-4 py-2.5 text-sm font-medium text-orange-700 hover:bg-orange-50"
            >
              <Plus className="h-4 w-4" />
              Ajouter une formation
            </button>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-stone-900">Compétences & langues</h2>
            <div>
              <span className="text-sm font-medium text-stone-700">Compétences</span>
              <p className="mt-1 text-xs text-stone-500">
                Saisis un mot-clé puis Entrée ou « Ajouter ».
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {form.skills.map((s) => (
                  <span
                    key={s}
                    className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-3 py-1 text-sm text-orange-900"
                  >
                    {s}
                    <button
                      type="button"
                      onClick={() =>
                        setForm((f) => ({ ...f, skills: f.skills.filter((x) => x !== s) }))
                      }
                      className="text-orange-600 hover:text-red-600"
                      aria-label={`Retirer ${s}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <input
                  className={cn(inputClass, "flex-1")}
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addSkill();
                    }
                  }}
                  placeholder="Ex. Gestion de projet"
                />
                <button
                  type="button"
                  onClick={addSkill}
                  className="shrink-0 rounded-xl border border-stone-200 px-4 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-50"
                >
                  Ajouter
                </button>
              </div>
            </div>

            <div>
              <span className="text-sm font-medium text-stone-700">Langues</span>
              {form.languages.map((lang, i) => (
                <div
                  key={i}
                  className="mt-3 grid gap-3 rounded-xl border border-stone-100 bg-stone-50/40 p-3 sm:grid-cols-2"
                >
                  <label>
                    <span className="text-xs text-stone-600">Langue</span>
                    <input
                      className={cn(inputClass, "mt-1")}
                      value={lang.language}
                      onChange={(e) => {
                        const next = [...form.languages];
                        next[i] = { ...lang, language: e.target.value };
                        setForm((f) => ({ ...f, languages: next }));
                      }}
                    />
                  </label>
                  <div>
                    <span className="text-xs text-stone-600">Niveau</span>
                    <SelectMenu
                      label="Niveau"
                      options={LANG_LEVELS}
                      value={lang.level}
                      onChange={(v) => {
                        const next = [...form.languages];
                        next[i] = { ...lang, level: v };
                        setForm((f) => ({ ...f, languages: next }));
                      }}
                      dense
                      className="[&_button]:mt-1.5"
                    />
                  </div>
                  {form.languages.length > 1 && (
                    <div className="sm:col-span-2">
                      <button
                        type="button"
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            languages: f.languages.filter((_, j) => j !== i),
                          }))
                        }
                        className="text-xs font-medium text-red-600 hover:underline"
                      >
                        Retirer cette langue
                      </button>
                    </div>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    languages: [...f.languages, emptyLanguageInput()],
                  }))
                }
                className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-orange-700 hover:underline"
              >
                <Plus className="h-4 w-4" />
                Ajouter une langue
              </button>
            </div>

            <label className="block">
              <span className="text-sm font-medium text-stone-700">Loisirs & centres d’intérêt</span>
              <input
                className={cn(inputClass, "mt-1.5")}
                value={form.hobbies}
                onChange={(e) => updateForm({ hobbies: e.target.value })}
                placeholder="Sport, lecture, bénévolat…"
              />
            </label>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-stone-900">Récapitulatif</h2>
            <CvPhotoField
              photoBase64={form.photo_base64}
              onPhotoChange={(dataUrl) => updateForm({ photo_base64: dataUrl })}
              onPhotoError={(m) => setErrorMsg(m)}
              onPhotoSuccess={() => setErrorMsg(null)}
              variant="compact"
              className="rounded-xl border border-stone-100 bg-stone-50/40 p-4"
            />
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-4 border-b border-stone-100 pb-2">
                <dt className="text-stone-500">Identité</dt>
                <dd className="text-right font-medium text-stone-900">
                  {form.first_name} {form.last_name}
                </dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-stone-100 pb-2">
                <dt className="text-stone-500">Contact</dt>
                <dd className="text-right text-stone-800">{form.email}</dd>
              </div>
              <div className="border-b border-stone-100 pb-2">
                <dt className="text-stone-500">Expériences</dt>
                <dd className="mt-1 text-stone-800">
                  <ul className="list-inside list-disc space-y-1">
                    {form.experiences.map((ex, i) => (
                      <li key={i}>
                        {ex.job_title || "Sans titre"} — {ex.company}
                        {ex.start_date || ex.end_date
                          ? ` (${formatPeriodFr(ex.start_date, ex.end_date)})`
                          : ""}
                      </li>
                    ))}
                  </ul>
                </dd>
              </div>
              <div className="border-b border-stone-100 pb-2">
                <dt className="text-stone-500">Formations</dt>
                <dd className="mt-1 text-stone-800">
                  <ul className="list-inside list-disc space-y-1">
                    {form.educations.map((ed, i) => (
                      <li key={i}>
                        {ed.diploma || "—"} — {ed.school}
                        {(ed.start_date || ed.graduation_date) &&
                          ` (${[formatDateEcriteFr(ed.start_date), formatDateEcriteFr(ed.graduation_date)].filter(Boolean).join(" – ")})`}
                      </li>
                    ))}
                  </ul>
                </dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-stone-100 pb-2">
                <dt className="text-stone-500">Compétences</dt>
                <dd className="text-right text-stone-800">{form.skills.join(", ") || "—"}</dd>
              </div>
            </dl>
            <p className="text-xs text-stone-500">
              En cliquant sur « Générer mon CV », tes données sont envoyées à l’IA pour enrichissement
              (bullet points, accroche).
            </p>
          </div>
        )}
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
        <button
          type="button"
          disabled={step <= 1}
          onClick={() => {
            setStep((s) => Math.max(1, s - 1));
            setErrorMsg(null);
          }}
          className="rounded-xl border border-stone-200 px-4 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-40"
        >
          Précédent
        </button>
        {step < 5 ? (
          <button
            type="button"
            onClick={() => {
              if (!validateStep(step)) return;
              setStep((s) => s + 1);
            }}
            className="rounded-xl px-6 py-2.5 text-sm font-semibold text-white shadow-md"
            style={{ background: CTA_GRAD }}
          >
            Suivant
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              if (!validateStep(1)) {
                setStep(1);
                return;
              }
              void generateCv();
            }}
            className="rounded-xl px-6 py-2.5 text-sm font-semibold text-white shadow-md"
            style={{ background: CTA_GRAD }}
          >
            Générer mon CV
          </button>
        )}
      </div>
    </div>
  );
}
