import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Entreprises — Postuly",
  description: "Recherche et sélection d’entreprises pour candidatures spontanées.",
};

export default function EntreprisesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
