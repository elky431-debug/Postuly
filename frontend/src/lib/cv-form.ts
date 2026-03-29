/**
 * État formulaire « Mon CV » — aligné sur l’extraction OpenAI (backend cv_parser).
 */

import type { CvParsed } from "@/lib/types";

export interface CvPersonalForm {
  full_name: string;
  address: string;
  city: string;
  postal_code: string;
}

export interface CvExperienceForm {
  job_title: string;
  company: string;
  start_date: string;
  end_date: string;
  description: string;
  is_current: boolean;
}

export interface CvEducationForm {
  diploma: string;
  institution: string;
  start_date: string;
  end_date: string;
  in_progress: boolean;
}

export interface CvLanguageForm {
  language: string;
  level: string;
}

export interface CvFormDraft {
  full_text: string;
  email: string;
  phone: string;
  personal: CvPersonalForm;
  professional_summary: string;
  experience_items: CvExperienceForm[];
  education_items: CvEducationForm[];
  skills: string[];
  language_items: CvLanguageForm[];
  interests: string[];
}

export const emptyPersonal = (): CvPersonalForm => ({
  full_name: "",
  address: "",
  city: "",
  postal_code: "",
});

export const emptyExperience = (): CvExperienceForm => ({
  job_title: "",
  company: "",
  start_date: "",
  end_date: "",
  description: "",
  is_current: false,
});

export const emptyEducation = (): CvEducationForm => ({
  diploma: "",
  institution: "",
  start_date: "",
  end_date: "",
  in_progress: false,
});

export const emptyLanguage = (): CvLanguageForm => ({
  language: "",
  level: "",
});

export function emptyCvDraft(): CvFormDraft {
  return {
    full_text: "",
    email: "",
    phone: "",
    personal: emptyPersonal(),
    professional_summary: "",
    experience_items: [emptyExperience()],
    education_items: [emptyEducation()],
    skills: [],
    language_items: [emptyLanguage()],
    interests: [],
  };
}

function asPersonal(raw: unknown): CvPersonalForm {
  if (!raw || typeof raw !== "object") return emptyPersonal();
  const o = raw as Record<string, unknown>;
  return {
    full_name: String(o.full_name ?? ""),
    address: String(o.address ?? ""),
    city: String(o.city ?? ""),
    postal_code: String(o.postal_code ?? ""),
  };
}

function asExperienceItems(raw: unknown, fallbackLines: string[]): CvExperienceForm[] {
  if (Array.isArray(raw) && raw.length > 0) {
    const rows = raw.map((x) => {
      if (!x || typeof x !== "object") return emptyExperience();
      const o = x as Record<string, unknown>;
      return {
        job_title: String(o.job_title ?? o.title ?? ""),
        company: String(o.company ?? ""),
        start_date: String(o.start_date ?? ""),
        end_date: String(o.end_date ?? ""),
        description: String(o.description ?? ""),
        is_current: Boolean(o.is_current ?? o.current),
      };
    });
    const ok = rows.filter(
      (e) => e.job_title.trim() || e.company.trim() || e.description.trim()
    );
    if (ok.length) return ok;
  }
  if (fallbackLines.length) {
    return fallbackLines.map((line) => ({ ...emptyExperience(), description: line }));
  }
  return [emptyExperience()];
}

function asEducationItems(raw: unknown, fallbackLines: string[]): CvEducationForm[] {
  if (Array.isArray(raw) && raw.length > 0) {
    const rows = raw.map((x) => {
      if (!x || typeof x !== "object") return emptyEducation();
      const o = x as Record<string, unknown>;
      return {
        diploma: String(o.diploma ?? ""),
        institution: String(o.institution ?? ""),
        start_date: String(o.start_date ?? ""),
        end_date: String(o.end_date ?? ""),
        in_progress: Boolean(o.in_progress ?? o.en_cours),
      };
    });
    const ok = rows.filter(
      (e) =>
        e.diploma.trim() ||
        e.institution.trim() ||
        e.start_date.trim() ||
        e.end_date.trim()
    );
    if (ok.length) return ok;
  }
  if (fallbackLines.length) {
    return fallbackLines.map((line) => ({ ...emptyEducation(), diploma: line }));
  }
  return [emptyEducation()];
}

function asLanguageItems(raw: unknown, fallbackLines: string[]): CvLanguageForm[] {
  if (Array.isArray(raw) && raw.length > 0) {
    const rows = raw
      .map((x) => {
        if (!x || typeof x !== "object") return null;
        const o = x as Record<string, unknown>;
        const lang = String(o.language ?? o.name ?? "").trim();
        const level = String(o.level ?? o.niveau ?? "").trim();
        if (!lang) return null;
        return { language: lang, level };
      })
      .filter(Boolean) as CvLanguageForm[];
    if (rows.length) return rows;
  }
  if (fallbackLines.length) {
    return fallbackLines.map((s) => {
      const parts = s.split(/[—\-:]/).map((p) => p.trim());
      if (parts.length >= 2) {
        return { language: parts[0], level: parts.slice(1).join(" — ") };
      }
      return { language: s, level: "" };
    });
  }
  return [emptyLanguage()];
}

/** Construit l’état formulaire depuis le profil (API / upload). */
export function draftFromParsed(cv: CvParsed | null): CvFormDraft {
  if (!cv) return emptyCvDraft();

  const ext = cv as CvParsed & {
    personal?: CvPersonalForm;
    professional_summary?: string;
    experience_items?: CvExperienceForm[];
    education_items?: CvEducationForm[];
    language_items?: CvLanguageForm[];
    interests?: string[];
  };

  const experience_items = asExperienceItems(ext.experience_items, cv.experiences ?? []);
  const education_items = asEducationItems(ext.education_items, cv.education ?? []);
  const language_items = asLanguageItems(ext.language_items, cv.languages ?? []);

  return {
    full_text: cv.full_text ?? "",
    email: cv.email ?? "",
    phone: cv.phone ?? "",
    personal: ext.personal ? asPersonal(ext.personal) : emptyPersonal(),
    professional_summary: ext.professional_summary ?? "",
    experience_items,
    education_items,
    skills: [...(cv.skills ?? [])],
    language_items,
    interests: [...(ext.interests ?? [])],
  };
}

function lineExperience(e: CvExperienceForm): string {
  const head = [e.job_title, e.company].filter(Boolean).join(" — ");
  const dates =
    e.start_date || e.end_date
      ? `${e.start_date} → ${e.end_date}${e.is_current ? " (en cours)" : ""}`
      : "";
  const parts = [head, dates, e.description.trim()].filter(Boolean);
  return parts.join("\n");
}

function lineEducation(e: CvEducationForm): string {
  const head = [e.diploma, e.institution].filter(Boolean).join(" — ");
  const dates =
    e.start_date || e.end_date ? `${e.start_date} → ${e.end_date}` : "";
  const suf = e.in_progress ? " (en cours)" : "";
  return [head, dates + suf].filter(Boolean).join("\n");
}

/** Sérialise pour PATCH profil + compat lettres / coach (tableaux plats). */
export function parsedFromDraft(d: CvFormDraft): CvParsed {
  const experience_items = d.experience_items.filter(
    (e) =>
      e.job_title.trim() ||
      e.company.trim() ||
      e.description.trim() ||
      e.start_date.trim() ||
      e.end_date.trim()
  );
  const education_items = d.education_items.filter(
    (e) =>
      e.diploma.trim() ||
      e.institution.trim() ||
      e.start_date.trim() ||
      e.end_date.trim()
  );
  const language_items = d.language_items.filter((l) => l.language.trim());

  const experiences = experience_items.map(lineExperience).filter(Boolean);
  const education = education_items.map(lineEducation).filter(Boolean);
  const languages = language_items.map((l) =>
    l.level.trim() ? `${l.language.trim()} — ${l.level.trim()}` : l.language.trim()
  );

  return {
    full_text: d.full_text.slice(0, 5000),
    email: d.email.trim() || null,
    phone: d.phone.trim() || null,
    personal: { ...d.personal },
    professional_summary: d.professional_summary,
    experience_items,
    education_items,
    language_items,
    interests: [...d.interests],
    experiences,
    education,
    skills: d.skills.map((s) => s.trim()).filter(Boolean),
    languages,
  } as CvParsed;
}
