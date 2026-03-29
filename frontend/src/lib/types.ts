export interface Profile {
  id: string;
  full_name: string | null;
  profile_type: "etudiant" | "jeune_actif" | null;
  cv_url: string | null;
  cv_parsed: CvParsed | null;
  cv_score: number | null;
  created_at: string | null;
}

/** Blocs structurés remplis par l’IA (upload CV) — éditables sur Mon CV. */
export interface CvPersonalParsed {
  full_name: string;
  address: string;
  city: string;
  postal_code: string;
}

export interface CvExperienceParsed {
  job_title: string;
  company: string;
  start_date: string;
  end_date: string;
  description: string;
  is_current: boolean;
}

export interface CvEducationParsed {
  diploma: string;
  institution: string;
  start_date: string;
  end_date: string;
  in_progress: boolean;
}

export interface CvLanguageParsed {
  language: string;
  level: string;
}

export interface CvParsed {
  full_text: string;
  email: string | null;
  phone: string | null;
  experiences: string[];
  education: string[];
  skills: string[];
  languages: string[];
  personal?: CvPersonalParsed;
  professional_summary?: string;
  experience_items?: CvExperienceParsed[];
  education_items?: CvEducationParsed[];
  language_items?: CvLanguageParsed[];
  interests?: string[];
}

/** Réponse de POST /api/cv/analyse-coach (structure produite par le modèle). */
export interface CvCoachAnalysis {
  score_global: number;
  score_potentiel: number;
  niveau: string;
  profil_detecte: string;
  synthese: {
    texte: string;
    nb_corrections_prioritaires?: number;
    temps_estime_minutes?: number;
  };
  objectif_recherche?: {
    poste?: string;
    type_contrat?: string;
    evaluation?: string;
    adequation?: string;
    alternatives?: string[];
  };
  points_forts: Array<{
    titre: string;
    description: string;
    impact: string;
  }>;
  points_ameliorer: Array<{
    priorite: string;
    section: string;
    titre: string;
    description: string;
    suggestion_concrete: string;
  }>;
  analyse_sections?: Record<string, unknown>;
  secteurs_compatibles?: Array<{
    nom: string;
    adequation: string;
    codes_naf: string[];
  }>;
  mots_cles_ats?: {
    presents?: string[];
    manquants?: string[];
    score_ats?: number;
    commentaire?: string;
  };
  plan_action: Array<{
    ordre: number;
    action: string;
    section_concernee: string;
    difficulte: string;
    impact_score: number;
    exemple_concret: string;
  }>;
}

export interface Campaign {
  id: string;
  user_id: string;
  job_title: string;
  location: string;
  radius_km: number;
  contract_type: "stage" | "alternance" | "cdi" | "cdd";
  status: "draft" | "running" | "paused" | "completed";
  created_at: string;
}

export interface Company {
  id: string;
  siret: string | null;
  name: string;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  naf_code: string | null;
  naf_label: string | null;
  size_range: string | null;
  website_url: string | null;
}

export interface EmailContact {
  id: string;
  company_id: string;
  email: string;
  source: "scraped" | "guessed" | "manual";
  verified: boolean;
}

export interface Application {
  id: string;
  campaign_id: string;
  company_id: string | null;
  contact_id: string | null;
  cover_letter: string | null;
  status: ApplicationStatus;
  sent_at: string | null;
  replied_at: string | null;
  notes: string | null;
  created_at: string;
  company?: Company | null;
  contact?: EmailContact | null;
}

export type ApplicationStatus =
  | "pending_review"
  | "approved"
  | "sent"
  | "followed_up"
  | "replied"
  | "interview"
  | "offer"
  | "rejected";
