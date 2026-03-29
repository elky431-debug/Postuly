import type { Metadata } from "next";

/** Évite une page dashboard trop « figée » en cache ; titre d’onglet distinct pour vérifier que tu es sur la bonne build. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tableau de bord — Postuly",
  description: "Vue d’ensemble de tes candidatures et campagnes.",
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
