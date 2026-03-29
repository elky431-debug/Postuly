/** Entreprise renvoyée par l’API de recherche INSEE (proxy Next). */
export interface EntrepriseSearchResult {
  siret: string;
  nom: string;
  ville: string;
  codePostal: string;
  naf: string;
  libelleNaf?: string;
  taille: string;
  /** Code tranche effectifs INSEE (ex. 12, NN). */
  trancheEffectifs?: string;
  score: number;
  domaine: string;
  selected: boolean;
  dateCreation?: string | null;
}

/** Réponse JSON de GET /api/entreprises/search */
export interface EntrepriseSearchResponse {
  entreprises: EntrepriseSearchResult[];
  total: number;
  page: number;
  error?: string;
}
