/**
 * Types UI pour la feature Relance (agrégats côté Next).
 * Les candidatures réelles restent `Application` dans `@/lib/types`.
 */

export type RelanceCampaignUiStatus = "completed" | "partial" | "no_reply";

export interface RelanceCampaignSummary {
  id: string;
  title: string;
  jobTitle: string;
  location: string;
  contractType: string;
  campaignStatus: string;
  createdAt: string;
  lastSentAt: string | null;
  totalApplications: number;
  repliedCount: number;
  followedUpCount: number;
  sentCount: number;
  uiStatus: RelanceCampaignUiStatus;
  companyNamesSample: string[];
}

export type RelanceApplicationUiStatus = "no_reply" | "replied" | "relanced";

export interface RelanceLetterPayload {
  subjectRelance: string;
  subjectInitial: string;
  body: string;
  sentAt: string | null;
  createdAt: string;
  uiStatus: RelanceApplicationUiStatus;
  companyName: string;
  /** Statut brut Supabase — seul `sent` autorise l’envoi de relance. */
  rawStatus: string;
}
