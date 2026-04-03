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
