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
