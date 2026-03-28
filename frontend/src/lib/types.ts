export interface Profile {
  id: string;
  full_name: string | null;
  profile_type: "etudiant" | "jeune_actif" | null;
  cv_url: string | null;
  cv_parsed: CvParsed | null;
  cv_score: number | null;
  created_at: string;
}

export interface CvParsed {
  full_text: string;
  email: string | null;
  phone: string | null;
  experiences: string[];
  education: string[];
  skills: string[];
  languages: string[];
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
