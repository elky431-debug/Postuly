/** Entreprise renvoyée par l’API de recherche (proxy Next). */
export interface EntrepriseSearchResult {
  siret: string;
  siren?: string;
  nom: string;
  ville: string;
  codePostal: string;
  naf: string;
  libelleNaf?: string;
  taille: string;
  /** Code tranche effectifs INSEE (ex. 12, NN). */
  trancheEffectifs?: string;
  /** Libellé lisible de la tranche (ex. "10-19 sal."). */
  effectifLabel?: string;
  score: number;
  domaine: string;
  selected: boolean;
  dateCreation?: string | null;
  adresse?: string | null;
  annuaireUrl?: string | null;
  rechercheWebUrl?: string | null;
}

/** Réponse JSON de GET /api/entreprises/search */
export interface EntrepriseSearchResponse {
  entreprises: EntrepriseSearchResult[];
  total: number;
  page: number;
  error?: string;
}
