import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Profil — Postuly",
  description: "Identité, dossier de candidature et intégrations.",
};

export default function ProfilLayout({ children }: { children: React.ReactNode }) {
  return children;
}
