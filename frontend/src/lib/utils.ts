import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const CONTRACT_LABELS: Record<string, string> = {
  stage: "Stage",
  alternance: "Alternance",
  cdi: "CDI",
  cdd: "CDD",
};

export const STATUS_LABELS: Record<string, string> = {
  pending_review: "À revoir",
  approved: "Approuvé",
  sent: "Envoyé",
  followed_up: "Relancé",
  replied: "Répondu",
  interview: "Entretien",
  offer: "Offre",
  rejected: "Refus",
};

export const STATUS_COLORS: Record<string, string> = {
  pending_review: "bg-yellow-100 text-yellow-800",
  approved: "bg-blue-100 text-blue-800",
  sent: "bg-indigo-100 text-indigo-800",
  followed_up: "bg-purple-100 text-purple-800",
  replied: "bg-green-100 text-green-800",
  interview: "bg-emerald-100 text-emerald-800",
  offer: "bg-teal-100 text-teal-800",
  rejected: "bg-red-100 text-red-800",
};

export const KANBAN_COLUMNS = [
  { id: "sent", label: "Envoyé", color: "border-indigo-400" },
  { id: "followed_up", label: "Relancé", color: "border-purple-400" },
  { id: "replied", label: "Répondu", color: "border-green-400" },
  { id: "interview", label: "Entretien", color: "border-emerald-400" },
  { id: "offer", label: "Offre", color: "border-teal-400" },
  { id: "rejected", label: "Refus", color: "border-red-400" },
];
