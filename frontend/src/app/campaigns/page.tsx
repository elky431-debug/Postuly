import { redirect } from "next/navigation";

/**
 * Liste des campagnes : le parcours principal passe par « Ma sélection »
 * (recherche entreprises → emails → lancement n8n).
 */
export default function CampaignsPage() {
  redirect("/dashboard/selections");
}
