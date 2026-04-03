# Postuly — Pack source « Créer son CV » (Next.js)

Tout le code utile au parcours `/cv/create`, dans l’ordre logique. Dépendances externes : `@/lib/api`, `@/lib/auth-session`, `@/lib/supabase`, `@/lib/types` (CvParsed), `@/lib/openai-env`, `@/lib/supabase/server`, `@/components/layout/DashboardLayout`, `@/components/ui/select-menu`, `lucide-react`, `jspdf`, `html2canvas`.

---

## `frontend/src/app/cv/create/page.tsx` (PAGE)

```
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { CreateCvFlow } from "@/components/cv/create-cv/CreateCvFlow";

export default function CreateCvPage() {
  return (
    <DashboardLayout>
      <div className="min-h-screen bg-white">
        <CreateCvFlow />
      </div>
    </DashboardLayout>
  );
}
```

## `frontend/src/app/api/cv/generate-from-form/route.ts` (API)

```
/**
 * POST /api/cv/generate-from-form — enrichit le formulaire « Créer mon CV » via OpenAI.
 */
import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/supabase/server";
import { resolveOpenAiApiKey } from "@/lib/openai-env";
import type { CreateCvFormData, EnrichedCvJson } from "@/types/create-cv";

export const runtime = "nodejs";

const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";

function buildUserPrompt(formData: CreateCvFormData): string {
  // La photo est en base64 : on ne l’envoie pas au modèle (poids + inutile pour le texte).
  const { photo_base64: _omit, ...sansPhoto } = formData;
  void _omit;
  const payload = JSON.stringify(sansPhoto);
  return `Tu es un expert en rédaction de CV professionnel.
Génère un CV professionnel en français pour la personne ci-dessous.
Améliore les descriptions, rends les bullet points percutants,
enrichis l'accroche.
Aucun « poste recherché » n'est fourni : pour le champ titre, propose un intitulé professionnel court cohérent avec les expériences (ex. dernière fonction ou domaine), ou une chaîne vide si impossible à déduire.
Pour chaque periode (expériences et formations), utilise des dates en français en toutes lettres, par ex. « janvier 2023 – mars 2025 » ou « 15 septembre 2024 – en cours », jamais uniquement des formats numériques type 03/2026.

Réponds par UN SEUL objet JSON (pas de markdown, pas de texte avant ou après) avec exactement cette structure :
{
  "prenom": "",
  "nom": "",
  "titre": "",
  "email": "",
  "tel": "",
  "ville": "",
  "linkedin": "",
  "accroche": "",
  "experiences": [{"titre":"","entreprise":"","periode":"","lieu":"","points":[]}],
  "formations": [{"diplome":"","ecole":"","periode":"","lieu":"","detail":""}],
  "skills": [],
  "langues": [{"langue":"","niveau":""}],
  "loisirs": ""
}

Données source (à transformer et enrichir) : ${payload}`;
}

/** Messages utilisateur pour erreurs API OpenAI. */
function messageFromOpenAiErrorBody(status: number, errText: string): string {
  try {
    const j = JSON.parse(errText) as {
      error?: { message?: string; code?: string; type?: string };
    };
    const msg = (j.error?.message ?? "").trim();
    const code = (j.error?.code ?? "").toLowerCase();
    const low = msg.toLowerCase();
    if (
      code === "insufficient_quota" ||
      low.includes("quota") ||
      low.includes("billing") ||
      low.includes("exceeded your current quota")
    ) {
      return (
        "Quota ou crédits OpenAI insuffisants. Vérifie ton compte sur platform.openai.com " +
        "(Billing), puis réessaie. Tu peux aussi mettre une autre clé dans OPENAI_API_KEY (.env.local)."
      );
    }
    if (low.includes("invalid api key") || code === "invalid_api_key") {
      return "Clé API OpenAI invalide. Vérifie OPENAI_API_KEY dans .env.local.";
    }
    if (msg) {
      return `L’IA n’a pas pu générer le CV (${status}) : ${msg}`;
    }
  } catch {
    /* corps non JSON */
  }
  return `Erreur du service IA OpenAI (HTTP ${status}). Réessaie plus tard ou vérifie ta configuration.`;
}

function extractJsonFromAssistantText(text: string): EnrichedCvJson {
  let t = text.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/m;
  const m = t.match(fence);
  if (m) t = m[1].trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Réponse IA : JSON introuvable.");
  }
  t = t.slice(start, end + 1);
  const parsed = JSON.parse(t) as EnrichedCvJson;
  return parsed;
}

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace(/^Bearer /i, "");
  const user = await getUserFromRequest(token);
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  let body: { formData?: CreateCvFormData };
  try {
    body = (await req.json()) as { formData?: CreateCvFormData };
  } catch {
    return NextResponse.json({ error: "Body JSON invalide" }, { status: 400 });
  }

  const formData = body.formData;
  if (!formData || typeof formData !== "object") {
    return NextResponse.json({ error: "formData requis" }, { status: 400 });
  }

  const openaiKey = resolveOpenAiApiKey();
  if (!openaiKey) {
    return NextResponse.json(
      {
        error:
          "OPENAI_API_KEY introuvable. Ajoute-la dans frontend/.env.local (recommandé) ou dans backend/.env en local — " +
          "les routes Next ne lisent pas automatiquement backend/.env. Clé : platform.openai.com",
      },
      { status: 503 }
    );
  }

  const model = process.env.OPENAI_CV_MODEL?.trim() || DEFAULT_OPENAI_MODEL;
  const userPrompt = buildUserPrompt(formData);

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 8192,
        temperature: 0.45,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "Tu réponds uniquement avec un objet JSON valide en français, sans texte hors JSON. " +
              "Le JSON doit décrire un CV enrichi selon les instructions utilisateur.",
          },
          { role: "user", content: userPrompt },
        ],
      }),
      signal: AbortSignal.timeout(120_000),
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json(
        { error: messageFromOpenAiErrorBody(res.status, errText) },
        { status: 502 }
      );
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = data.choices?.[0]?.message?.content ?? "";
    if (!text) {
      return NextResponse.json(
        { error: "Réponse vide du modèle OpenAI." },
        { status: 502 }
      );
    }

    const enriched = extractJsonFromAssistantText(text);
    return NextResponse.json({ enriched });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur inconnue";
    return NextResponse.json(
      { error: "Échec génération CV", detail: msg },
      { status: 500 }
    );
  }
}
```

## `frontend/src/types/create-cv.ts` (TYPES)

```
/**
 * Formulaire « Créer mon CV » (5 étapes) + JSON enrichi renvoyé par l’IA.
 */

export type CreateCvExperienceInput = {
  job_title: string;
  company: string;
  start_date: string;
  end_date: string;
  city: string;
  description: string;
};

export type CreateCvEducationInput = {
  diploma: string;
  school: string;
  start_date: string;
  graduation_date: string;
  grade: string;
  city: string;
  description: string;
};

export type CreateCvLanguageInput = {
  language: string;
  level: string;
};

/** État du formulaire multi-étapes (local uniquement). */
export type CreateCvFormData = {
  photo_base64: string | null;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  city: string;
  linkedin: string;
  website: string;
  summary: string;
  experiences: CreateCvExperienceInput[];
  educations: CreateCvEducationInput[];
  skills: string[];
  languages: CreateCvLanguageInput[];
  hobbies: string;
};

export type EnrichedCvExperience = {
  titre: string;
  entreprise: string;
  periode: string;
  lieu: string;
  points: string[];
};

export type EnrichedCvFormation = {
  diplome: string;
  ecole: string;
  periode: string;
  lieu: string;
  detail: string;
};

export type EnrichedCvLangue = {
  langue: string;
  niveau: string;
};

/** JSON strict attendu depuis l’IA (champs alignés prompt). */
export type EnrichedCvJson = {
  prenom: string;
  nom: string;
  titre: string;
  email: string;
  tel: string;
  ville: string;
  linkedin: string;
  accroche: string;
  experiences: EnrichedCvExperience[];
  formations: EnrichedCvFormation[];
  skills: string[];
  langues: EnrichedCvLangue[];
  loisirs: string;
};

export const emptyExperienceInput = (): CreateCvExperienceInput => ({
  job_title: "",
  company: "",
  start_date: "",
  end_date: "",
  city: "",
  description: "",
});

export const emptyEducationInput = (): CreateCvEducationInput => ({
  diploma: "",
  school: "",
  start_date: "",
  graduation_date: "",
  grade: "",
  city: "",
  description: "",
});

export const emptyLanguageInput = (): CreateCvLanguageInput => ({
  language: "",
  level: "Courant",
});

export function emptyCreateCvForm(): CreateCvFormData {
  return {
    photo_base64: null,
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    city: "",
    linkedin: "",
    website: "",
    summary: "",
    experiences: [emptyExperienceInput()],
    educations: [emptyEducationInput()],
    skills: [],
    languages: [emptyLanguageInput()],
    hobbies: "",
  };
}
```

## `frontend/src/lib/create-cv-dates.ts` (LIB_DATES)

```
/** Mois en toutes lettres (fr), pour affichage CV et récap. */
const MOIS_COMPLETS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
] as const;

/** « juillet 2025 » à partir d’une date ISO (YYYY-MM ou YYYY-MM-DD). */
export function formatMonthYearFr(isoDate: string): string {
  const t = isoDate?.trim();
  if (!t) return "";
  const normalized = /^\d{4}-\d{2}$/.test(t) ? `${t}-01` : t;
  const d = new Date(`${normalized}T12:00:00`);
  if (Number.isNaN(d.getTime())) return t;
  return `${MOIS_COMPLETS[d.getMonth()]} ${d.getFullYear()}`;
}

/** « 25 juillet 2025 » si jour présent, sinon comme formatMonthYearFr. */
export function formatDateEcriteFr(isoDate: string): string {
  const t = isoDate?.trim();
  if (!t) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
    const d = new Date(`${t}T12:00:00`);
    if (Number.isNaN(d.getTime())) return t;
    return `${d.getDate()} ${MOIS_COMPLETS[d.getMonth()]} ${d.getFullYear()}`;
  }
  return formatMonthYearFr(t);
}

export function formatPeriodFr(start: string, end: string): string {
  const a = formatDateEcriteFr(start);
  const b = formatDateEcriteFr(end);
  if (a && b) return `${a} – ${b}`;
  if (a) return a;
  if (b) return b;
  return "";
}

/**
 * Normalise une période libre (IA ou saisie) : segments type ISO ou JJ/MM/AAAA → toutes lettres.
 */
export function formatPeriodeEcriteFr(periode: string): string {
  const raw = periode?.trim();
  if (!raw) return "";

  const trySegment = (segment: string): string => {
    const s = segment.trim();
    if (!s) return s;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return formatDateEcriteFr(s);
    if (/^\d{4}-\d{2}$/.test(s)) return formatMonthYearFr(s);
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) {
      const [da, mo, ye] = s.split("/").map((x) => parseInt(x, 10));
      if (!Number.isFinite(da) || !Number.isFinite(mo) || !Number.isFinite(ye)) return s;
      const d = new Date(ye, mo - 1, da);
      if (Number.isNaN(d.getTime())) return s;
      return `${d.getDate()} ${MOIS_COMPLETS[d.getMonth()]} ${d.getFullYear()}`;
    }
    return s;
  };

  const parts = raw.split(/\s*[–—-]\s*/).map(trySegment);
  const filtered = parts.filter(Boolean);
  if (filtered.length >= 2) return `${filtered[0]} – ${filtered[1]}`;
  if (filtered.length === 1) return filtered[0];
  return raw;
}
```

## `frontend/src/lib/cv-html-escape.ts` (LIB_ESCAPE)

```
/** Échappement HTML pour prévisualisations / export CV. */
export function escapeCvHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
```

## `frontend/src/lib/create-cv-enriched-to-parsed.ts` (LIB_PARSED)

```
/**
 * Convertit le JSON enrichi Claude → structure CvParsed (profil Postuly).
 */
import type { CvParsed, CvExperienceParsed, CvEducationParsed, CvLanguageParsed } from "@/lib/types";
import type { EnrichedCvJson } from "@/types/create-cv";

function joinPoints(points: string[]): string {
  return points.filter(Boolean).map((p) => `• ${p.trim()}`).join("\n");
}

export function enrichedCvToCvParsed(enriched: EnrichedCvJson): CvParsed {
  const fullName = `${enriched.prenom} ${enriched.nom}`.trim();

  const experience_items: CvExperienceParsed[] = (enriched.experiences ?? []).map(
    (e) => ({
      job_title: e.titre ?? "",
      company: e.entreprise ?? "",
      start_date: "",
      end_date: "",
      description: joinPoints(e.points ?? []),
      is_current: /\baujourd|présent|actuel/i.test(e.periode ?? ""),
    })
  );

  const education_items: CvEducationParsed[] = (enriched.formations ?? []).map(
    (f) => ({
      diploma: f.diplome ?? "",
      institution: f.ecole ?? "",
      start_date: "",
      end_date: "",
      in_progress: false,
    })
  );

  const language_items: CvLanguageParsed[] = (enriched.langues ?? []).map((l) => ({
    language: l.langue ?? "",
    level: l.niveau ?? "",
  }));

  const experiences = experience_items.map(
    (x) => `${x.job_title} — ${x.company}`
  );
  const education = education_items.map((x) => `${x.diploma} — ${x.institution}`);

  const full_text = [
    enriched.accroche,
    ...experiences,
    ...education,
    (enriched.skills ?? []).join(", "),
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    full_text,
    email: enriched.email || null,
    phone: enriched.tel || null,
    experiences,
    education,
    skills: enriched.skills ?? [],
    languages: (enriched.langues ?? []).map((l) => `${l.langue} (${l.niveau})`),
    professional_summary: enriched.accroche ?? "",
    personal: {
      full_name: fullName,
      address: "",
      city: enriched.ville ?? "",
      postal_code: "",
    },
    experience_items,
    education_items,
    language_items,
    interests: enriched.loisirs ? [enriched.loisirs] : [],
  };
}
```

## `frontend/src/lib/download-cv-pdf.ts` (LIB_PDF)

```
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

/**
 * Capture un nœud DOM (ex. #cv-print-area) et télécharge un PDF A4 (plusieurs pages si nécessaire).
 */
export async function downloadElementAsA4Pdf(
  element: HTMLElement,
  fileName: string
): Promise<void> {
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    allowTaint: true,
    backgroundColor: "#ffffff",
    logging: false,
    scrollX: 0,
    scrollY: -window.scrollY,
  });

  const imgData = canvas.toDataURL("image/jpeg", 0.92);
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const marginMm = 15;
  const innerW = pageWidth - 2 * marginMm;
  const innerH = pageHeight - 2 * marginMm;

  const imgWidth = innerW;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  let positionY = marginMm;
  pdf.addImage(imgData, "JPEG", marginMm, positionY, imgWidth, imgHeight);
  let heightLeft = imgHeight - innerH;

  while (heightLeft > 0) {
    positionY = marginMm - (imgHeight - heightLeft);
    pdf.addPage();
    pdf.addImage(imgData, "JPEG", marginMm, positionY, imgWidth, imgHeight);
    heightLeft -= innerH;
  }

  pdf.save(fileName);
}
```

## `frontend/src/components/cv/create-cv/cv-photo-field.tsx` (COMP_PHOTO)

```
"use client";

import { useCallback, useState } from "react";
import { ImagePlus, User } from "lucide-react";
import { cn } from "@/lib/utils";

const MAX_DIM = 640;
const JPEG_QUALITY = 0.85;
const MAX_FILE_BYTES = 12 * 1024 * 1024;

/** Réduit et encode en JPEG data URL pour un poids raisonnable dans le state / HTML. */
function fileToResizedDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const objUrl = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      URL.revokeObjectURL(objUrl);
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const scale = Math.min(1, MAX_DIM / Math.max(w, h));
      const tw = Math.round(w * scale);
      const th = Math.round(h * scale);
      const canvas = document.createElement("canvas");
      canvas.width = tw;
      canvas.height = th;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Impossible de traiter l’image."));
        return;
      }
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, tw, th);
      ctx.drawImage(img, 0, 0, tw, th);
      resolve(canvas.toDataURL("image/jpeg", JPEG_QUALITY));
    };
    img.onerror = () => {
      URL.revokeObjectURL(objUrl);
      reject(new Error("Fichier image illisible."));
    };
    img.src = objUrl;
  });
}

type Props = {
  photoBase64: string | null;
  onPhotoChange: (dataUrl: string | null) => void;
  onPhotoError?: (message: string) => void;
  onPhotoSuccess?: () => void;
  /** Récap ou écran résultat : mise en page plus serrée */
  variant?: "default" | "compact";
  className?: string;
};

export function CvPhotoField({
  photoBase64,
  onPhotoChange,
  onPhotoError,
  onPhotoSuccess,
  variant = "default",
  className,
}: Props) {
  const [dragOver, setDragOver] = useState(false);

  const processFile = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        onPhotoError?.("Choisis un fichier image (JPG, PNG, WebP…).");
        return;
      }
      if (file.size > MAX_FILE_BYTES) {
        onPhotoError?.("Image trop lourde (max. 12 Mo).");
        return;
      }
      try {
        const dataUrl = await fileToResizedDataUrl(file);
        onPhotoChange(dataUrl);
        onPhotoSuccess?.();
      } catch (e) {
        onPhotoError?.(e instanceof Error ? e.message : "Erreur lors du traitement de l’image.");
      }
    },
    [onPhotoChange, onPhotoError, onPhotoSuccess]
  );

  const previewSize = variant === "compact" ? "h-20 w-20" : "h-24 w-24";
  const iconSize = variant === "compact" ? "h-8 w-8" : "h-10 w-10";

  return (
    <div className={cn("space-y-2", className)}>
      <span className="text-sm font-medium text-stone-700">Photo (optionnel)</span>
      <div
        className={cn(
          "flex flex-wrap items-end gap-4 rounded-xl border-2 border-dashed p-3 transition-colors",
          dragOver ? "border-orange-400 bg-orange-50/50" : "border-stone-200 bg-stone-50/30"
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files?.[0];
          void processFile(file);
        }}
      >
        {photoBase64 ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoBase64}
            alt=""
            className={cn(
              "shrink-0 rounded-xl object-cover ring-1 ring-stone-200",
              previewSize
            )}
          />
        ) : (
          <div
            className={cn(
              "flex shrink-0 items-center justify-center rounded-xl bg-stone-100 text-stone-400",
              previewSize
            )}
          >
            <User className={iconSize} aria-hidden />
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 shadow-sm hover:bg-stone-50">
            <ImagePlus className="h-4 w-4 shrink-0 text-orange-500" aria-hidden />
            Choisir une image
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                void processFile(f);
              }}
            />
          </label>
          {photoBase64 ? (
            <button
              type="button"
              onClick={() => {
                onPhotoChange(null);
                onPhotoSuccess?.();
              }}
              className="text-left text-sm text-red-600 hover:underline sm:text-center"
            >
              Retirer la photo
            </button>
          ) : (
            <p className="text-xs text-stone-500">
              Glisse-dépose une image ici ou clique pour parcourir. Elle apparaîtra sur ton CV.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
```

## `frontend/src/components/cv/create-cv/cv-preview-templates.tsx` (COMP_PREVIEW)

```
"use client";

import type { EnrichedCvJson } from "@/types/create-cv";
import { formatPeriodeEcriteFr } from "@/lib/create-cv-dates";
import { escapeCvHtml } from "@/lib/cv-html-escape";

type Props = {
  enriched: EnrichedCvJson;
  photoBase64: string | null;
  /** Bloc ciblé par window.print() (@media print). */
  printAreaId?: string;
  className?: string;
};

function esc(s: string): string {
  return escapeCvHtml(s);
}

const ACCENT = "#7b61ff";
const DARK_SIDEBAR = "#1e1e2f";

/**
 * CV deux colonnes (sidebar sombre + contenu blanc), taille naturelle pour l’aperçu et l’impression.
 */
export function CvPreviewModernDark({
  enriched,
  photoBase64,
  printAreaId,
  className = "",
}: Props) {
  return (
    <div
      {...(printAreaId ? { id: printAreaId } : {})}
      className={`flex w-full max-w-[900px] flex-row items-stretch overflow-visible rounded-xl border border-neutral-200/90 bg-white shadow-lg ${className}`}
      style={{ fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}
    >
      <aside
        className="flex w-[34%] min-w-[140px] flex-col gap-5 self-stretch p-5 text-white sm:min-w-[160px] sm:p-6"
        style={{ background: DARK_SIDEBAR }}
      >
        <div className="mx-auto w-full max-w-[148px] shrink-0">
          {photoBase64 ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoBase64}
              alt=""
              className="aspect-[3/4] w-full rounded-2xl object-cover ring-2 ring-white/25"
            />
          ) : (
            <div
              className="flex aspect-[3/4] w-full items-center justify-center rounded-2xl text-2xl font-light text-white/45 ring-2 ring-white/15"
              style={{ background: `${ACCENT}33` }}
            >
              {enriched.prenom?.[0]}
              {enriched.nom?.[0]}
            </div>
          )}
        </div>
        <div>
          <h2 className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: ACCENT }}>
            Contact
          </h2>
          <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-white/90 sm:text-sm">
            {enriched.email && <li>{esc(enriched.email)}</li>}
            {enriched.tel && <li>{esc(enriched.tel)}</li>}
            {enriched.ville && <li>{esc(enriched.ville)}</li>}
            {enriched.linkedin && (
              <li className="break-all" title={enriched.linkedin}>
                {esc(enriched.linkedin)}
              </li>
            )}
          </ul>
        </div>
        {(enriched.skills?.length ?? 0) > 0 && (
          <div>
            <h2 className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: ACCENT }}>
              Compétences
            </h2>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {enriched.skills!.map((s) => (
                <span
                  key={s}
                  className="rounded-full px-2.5 py-1 text-[10px] font-medium sm:text-xs"
                  style={{ background: `${ACCENT}30`, color: "#e8e6ff" }}
                >
                  {esc(s)}
                </span>
              ))}
            </div>
          </div>
        )}
        {(enriched.langues?.length ?? 0) > 0 && (
          <div>
            <h2 className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: ACCENT }}>
              Langues
            </h2>
            <ul className="mt-2 space-y-1 text-xs text-white/85 sm:text-sm">
              {enriched.langues!.map((l, i) => (
                <li key={i}>
                  {esc(l.langue)} — {esc(l.niveau)}
                </li>
              ))}
            </ul>
          </div>
        )}
      </aside>
      <main className="min-w-0 flex-1 bg-white p-5 text-neutral-800 sm:p-7">
        <header className="border-b border-neutral-100 pb-4">
          <h1 className="text-xl font-bold tracking-tight text-neutral-900 sm:text-2xl">
            {esc(enriched.prenom)} {esc(enriched.nom)}
          </h1>
          {enriched.titre?.trim() ? (
            <p className="mt-1 text-sm font-semibold uppercase tracking-wide" style={{ color: ACCENT }}>
              {esc(enriched.titre.trim())}
            </p>
          ) : null}
        </header>
        {enriched.accroche && (
          <p className="mt-4 text-sm leading-relaxed text-neutral-600 sm:text-[15px]">{esc(enriched.accroche)}</p>
        )}
        {(enriched.experiences?.length ?? 0) > 0 && (
          <section className="mt-6">
            <h2
              className="border-l-4 pl-3 text-sm font-bold uppercase tracking-wide text-neutral-900"
              style={{ borderColor: ACCENT }}
            >
              Expérience professionnelle
            </h2>
            <div className="mt-3 space-y-4">
              {enriched.experiences!.map((ex, i) => (
                <div key={i} className="text-sm">
                  <div className="flex flex-wrap items-baseline justify-between gap-1">
                    <span className="font-semibold text-neutral-900">{esc(ex.titre)}</span>
                    <span className="text-xs text-neutral-500">{esc(formatPeriodeEcriteFr(ex.periode))}</span>
                  </div>
                  <p className="text-xs font-medium text-neutral-600">
                    {esc(ex.entreprise)}
                    {ex.lieu ? ` · ${esc(ex.lieu)}` : ""}
                  </p>
                  <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-sm leading-relaxed text-neutral-600">
                    {(ex.points ?? []).map((p, j) => (
                      <li key={j}>{esc(p)}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        )}
        {(enriched.formations?.length ?? 0) > 0 && (
          <section className="mt-6">
            <h2
              className="border-l-4 pl-3 text-sm font-bold uppercase tracking-wide text-neutral-900"
              style={{ borderColor: ACCENT }}
            >
              Formation
            </h2>
            <div className="mt-3 space-y-3 text-sm">
              {enriched.formations!.map((f, i) => (
                <div key={i}>
                  <div className="flex flex-wrap items-baseline justify-between gap-1">
                    <span className="font-semibold text-neutral-900">{esc(f.diplome)}</span>
                    <span className="text-xs text-neutral-500">{esc(formatPeriodeEcriteFr(f.periode))}</span>
                  </div>
                  <div className="text-xs text-neutral-600">
                    {esc(f.ecole)}
                    {f.lieu ? ` · ${esc(f.lieu)}` : ""}
                  </div>
                  {f.detail && <p className="mt-1 text-sm leading-relaxed text-neutral-500">{esc(f.detail)}</p>}
                </div>
              ))}
            </div>
          </section>
        )}
        {enriched.loisirs && (
          <section className="mt-6 text-sm text-neutral-500">
            <span className="font-semibold text-neutral-700">Centres d&apos;intérêt · </span>
            {esc(enriched.loisirs)}
          </section>
        )}
      </main>
    </div>
  );
}
```

## `frontend/src/components/cv/create-cv/CreateCvFlow.tsx` (COMP_FLOW)

```
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
          className="mx-auto rounded-xl"
          style={{
            background: "#f0f0f0",
            padding: 32,
            borderRadius: 12,
            maxHeight: "80vh",
            overflowY: "auto",
          }}
        >
          <div className="flex justify-center">
            <CvPreviewModernDark
              enriched={enriched}
              photoBase64={form.photo_base64}
              printAreaId="cv-print-area"
            />
          </div>
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
            Le fichier PDF est généré depuis l’aperçu ci-dessus (format A4, marges 15 mm). Le téléchargement
            démarre automatiquement.
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
```

