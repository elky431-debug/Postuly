"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  MapPin,
  Trash2,
  Trash,
  Mail,
  Loader2,
  Globe,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  ExternalLink,
  Phone,
  Search,
  PartyPopper,
  Sparkles,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useSelectionStore } from "@/store/selectionStore";
import type { EmailResult, EmailContact } from "@/app/api/entreprises/email/route";
import { SelectionContactRow } from "@/components/dashboard/selections/SelectionContactRow";
import { SelectionLaunchBar } from "@/components/dashboard/selections/SelectionLaunchBar";
import { createClient } from "@/lib/supabase";
import { api } from "@/lib/api";
import { getAccessTokenForApi } from "@/lib/auth-session";
import type { EntrepriseSelection } from "@/store/selectionStore";

// ─── État par entreprise (recherche email) ───────────────────────────────────

type EmailState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; result: EmailResult }
  | { status: "error"; message: string };

function contactKey(siret: string, email: string): string {
  return `${siret}::${email}`;
}

type SelectionDestinationPayload = {
  siret: string;
  nom: string;
  ville: string;
  code_postal: string;
  naf: string;
  libelle_naf?: string;
  domaine: string;
  taille: string;
  contact: {
    email: string;
    first_name?: string;
    last_name?: string;
    position?: string;
    department?: string;
    confidence: number;
  };
};

/** Payload attendu par POST /api/n8n/campaign-from-selection → FastAPI from-selection. */
function buildDestinations(
  selection: EntrepriseSelection[],
  emailStates: Record<string, EmailState>,
  selectedKeys: Set<string>
): SelectionDestinationPayload[] {
  const out: SelectionDestinationPayload[] = [];
  for (const e of selection) {
    const st = emailStates[e.siret];
    if (st?.status !== "done") continue;
    for (const contact of st.result.contacts) {
      if (!selectedKeys.has(contactKey(e.siret, contact.email))) continue;
      out.push({
        siret: e.siret,
        nom: e.nom,
        ville: e.ville,
        code_postal: e.codePostal,
        naf: e.naf,
        libelle_naf: e.libelleNaf ?? undefined,
        domaine: e.domaine,
        taille: e.taille,
        contact: {
          email: contact.email,
          first_name: contact.firstName ?? undefined,
          last_name: contact.lastName ?? undefined,
          position: contact.position ?? undefined,
          department: contact.department ?? undefined,
          confidence: contact.confidence ?? 0,
        },
      });
    }
  }
  return out;
}

// ─── Message aucun email ─────────────────────────────────────────────────────

function NoEmailMessage({
  reason,
  domain,
  websiteUrl,
  nom,
}: {
  reason?: string;
  domain?: string | null;
  websiteUrl?: string | null;
  nom: string;
}) {
  const encodedNom = encodeURIComponent(`${nom} recrutement contact`);

  if (reason === "no_website") {
    return (
      <div className="rounded-lg border border-neutral-100 bg-neutral-50 p-4">
        <p className="text-sm font-medium text-neutral-700">Aucun site web trouvé pour cette entreprise</p>
        <p className="mt-1 text-xs text-neutral-500">
          Sans site web public, il est difficile de trouver des contacts automatiquement.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a
            href={`https://annuaire-entreprises.data.gouv.fr/rechercher?terme=${encodeURIComponent(nom)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-100"
          >
            <ExternalLink className="h-3 w-3" />
            Fiche officielle
          </a>
          <a
            href={`https://www.google.com/search?q=${encodedNom}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-100"
          >
            <Search className="h-3 w-3" />
            Rechercher sur Google
          </a>
          <a
            href={`https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(nom)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-100"
          >
            <ExternalLink className="h-3 w-3" />
            LinkedIn
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-amber-100 bg-amber-50 p-4">
      <p className="text-sm font-medium text-amber-900">Aucun email public trouvé pour cette entreprise</p>
      <p className="mt-1 text-xs text-amber-700">
        {domain
          ? `Le site ${domain} n'expose pas d'adresse email publiquement — c'est souvent le cas des petites entreprises qui utilisent un formulaire de contact.`
          : "Cette entreprise ne publie pas d'email sur son site web."}
      </p>
      <p className="mt-2 text-xs font-medium text-amber-800">Alternatives :</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {websiteUrl && (
          <a
            href={websiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-xs font-medium text-amber-900 transition-colors hover:bg-amber-100"
          >
            <Globe className="h-3 w-3" />
            Formulaire de contact
          </a>
        )}
        <a
          href={`https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(`${nom} RH recrutement`)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-xs font-medium text-amber-900 transition-colors hover:bg-amber-100"
        >
          <ExternalLink className="h-3 w-3" />
          Chercher le RH sur LinkedIn
        </a>
        <a
          href={`https://annuaire-entreprises.data.gouv.fr/rechercher?terme=${encodeURIComponent(nom)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-xs font-medium text-amber-900 transition-colors hover:bg-amber-100"
        >
          <Phone className="h-3 w-3" />
          Fiche officielle (téléphone)
        </a>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SelectionsPage() {
  const { selection, retirerEntreprise, viderSelection } = useSelectionStore();
  const [confirmClear, setConfirmClear] = useState(false);
  const [emailStates, setEmailStates] = useState<Record<string, EmailState>>({});
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => new Set());
  const [launching, setLaunching] = useState(false);
  /** Indique où en est le flux pour éviter l’impression que « rien ne se passe ». */
  const [launchPhase, setLaunchPhase] = useState<"letters" | "n8n">("letters");
  const [showLaunchConfig, setShowLaunchConfig] = useState(false);
  const [contractType, setContractType] = useState<"stage" | "alternance" | "cdi" | "cdd">("cdi");
  const [contractStartDate, setContractStartDate] = useState("");
  const [contractEndDate, setContractEndDate] = useState("");
  /** Retour utilisateur après lancement (remplace window.alert). */
  const [launchFeedback, setLaunchFeedback] = useState<
    | null
    | { variant: "success" | "error" | "info"; title: string; message: string }
  >(null);

  function toggleExpand(siret: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(siret) ? next.delete(siret) : next.add(siret);
      return next;
    });
  }

  function toggleContact(siret: string, email: string) {
    const k = contactKey(siret, email);
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      next.has(k) ? next.delete(k) : next.add(k);
      return next;
    });
  }

  function selectAllForCompany(siret: string, contacts: EmailContact[]) {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      contacts.forEach((c) => next.add(contactKey(siret, c.email)));
      return next;
    });
  }

  function deselectAllForCompany(siret: string, contacts: EmailContact[]) {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      contacts.forEach((c) => next.delete(contactKey(siret, c.email)));
      return next;
    });
  }

  async function findEmails(siret: string, nom: string, siren?: string) {
    setEmailStates((s) => ({ ...s, [siret]: { status: "loading" } }));
    setExpanded((prev) => new Set([...prev, siret]));

    try {
      const params = new URLSearchParams();
      if (siren) params.set("siren", siren);
      params.set("nom", nom);

      const res = await fetch(`/api/entreprises/email?${params.toString()}`);
      if (!res.ok) throw new Error(`Erreur ${res.status}`);

      const result: EmailResult = await res.json();
      setEmailStates((s) => ({ ...s, [siret]: { status: "done", result } }));
    } catch (err) {
      setEmailStates((s) => ({
        ...s,
        [siret]: {
          status: "error",
          message: err instanceof Error ? err.message : "Erreur inconnue",
        },
      }));
    }
  }

  function handleClear() {
    if (confirmClear) {
      viderSelection();
      setConfirmClear(false);
      setEmailStates({});
      setSelectedKeys(new Set());
    } else {
      setConfirmClear(true);
    }
  }

  async function launchCampaign() {
    if (selectedKeys.size === 0) return;
    const needsDates = contractType !== "cdi";
    if (needsDates && (!contractStartDate || !contractEndDate)) {
      setLaunchFeedback({
        variant: "info",
        title: "Dates requises",
        message: "Pour ce contrat, renseigne une date de début et une date de fin.",
      });
      return;
    }
    if (needsDates && contractStartDate > contractEndDate) {
      setLaunchFeedback({
        variant: "info",
        title: "Dates invalides",
        message: "La date de début doit être antérieure ou égale à la date de fin.",
      });
      return;
    }
    const destinations = buildDestinations(selection, emailStates, selectedKeys);
    if (destinations.length === 0) {
      setLaunchFeedback({
        variant: "info",
        title: "Sélection incomplète",
        message:
          "Sélectionne des contacts pour lesquels la recherche d’emails a réussi.",
      });
      return;
    }

    setLaunchPhase("letters");
    setLaunching(true);
    try {
      const supabase = createClient();
      const token = await getAccessTokenForApi(supabase);
      if (!token) {
        setLaunchFeedback({
          variant: "info",
          title: "Session expirée",
          message: "Reconnecte-toi pour lancer une campagne.",
        });
        return;
      }

      const created = await api<{
        campaign_id: string;
        applications_created: number;
        message: string;
      }>("/api/n8n/campaign-from-selection", {
        method: "POST",
        token,
        body: {
          destinations,
          contract_type: contractType,
          // Ultra safe: champs optionnels côté API Next/FastAPI (ignorés si non supportés backend).
          contract_start_date: needsDates ? contractStartDate : undefined,
          contract_end_date: needsDates ? contractEndDate : undefined,
        },
      });

      setLaunchPhase("n8n");
      const n8n = await api<{ success?: boolean; nb_emails?: number; message?: string }>(
        "/api/n8n/launch-campaign",
        {
          method: "POST",
          token,
          body: { campaignId: created.campaign_id },
        }
      );

      setLaunchFeedback({
        variant: "success",
        title: "Campagne lancée",
        message:
          n8n.message ??
          `${created.applications_created} candidature(s) créée(s). Les e-mails ont été envoyés.`,
      });
      setSelectedKeys(new Set());
      setShowLaunchConfig(false);
    } catch (err) {
      setLaunchFeedback({
        variant: "error",
        title: "Erreur au lancement",
        message:
          err instanceof Error ? err.message : "Une erreur est survenue. Réessaie.",
      });
    } finally {
      setLaunching(false);
    }
  }

  const totalSelected = selectedKeys.size;

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-white pb-28">
        <div className="border-b border-neutral-200 bg-white px-6 py-4">
          <div className="mx-auto max-w-4xl">
            <div className="flex items-center justify-between gap-4">
              <Link
                href="/dashboard/entreprises"
                className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-800"
              >
                <ArrowLeft className="h-4 w-4" />
                Retour à la recherche
              </Link>

              {selection.length > 0 && (
                <button
                  type="button"
                  onClick={handleClear}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    confirmClear
                      ? "bg-red-50 text-red-600 hover:bg-red-100"
                      : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700"
                  }`}
                >
                  <Trash className="h-3.5 w-3.5" />
                  {confirmClear ? "Confirmer la suppression" : "Vider la sélection"}
                </button>
              )}
            </div>

            <div className="mt-3">
              <h1 className="text-xl font-bold text-neutral-900">Ma sélection</h1>
              <p className="mt-0.5 text-sm text-neutral-500">
                {selection.length === 0
                  ? "Aucune entreprise sélectionnée."
                  : `${selection.length} entreprise${selection.length > 1 ? "s" : ""} · Clique sur « Trouver emails », coche les contacts, puis lance une campagne.`}
              </p>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-4xl px-6 py-6">
          {selection.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-100">
                <Building2 className="h-7 w-7 text-neutral-400" />
              </div>
              <h2 className="mt-4 text-base font-semibold text-neutral-700">Aucune entreprise sélectionnée</h2>
              <p className="mt-1.5 max-w-xs text-sm text-neutral-400">
                Recherche des entreprises et ajoute-les à ta sélection pour les retrouver ici.
              </p>
              <Link
                href="/dashboard/entreprises"
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-600"
              >
                <Building2 className="h-4 w-4" />
                Rechercher des entreprises
              </Link>
            </div>
          ) : (
            <ul className="space-y-3">
              {selection.map((e) => {
                const emailState = emailStates[e.siret] ?? { status: "idle" };
                const isExpanded = expanded.has(e.siret);
                const siren = (e as { siren?: string }).siren;
                const contacts =
                  emailState.status === "done" ? emailState.result.contacts : [];
                const selectedCount = contacts.filter((c) =>
                  selectedKeys.has(contactKey(e.siret, c.email))
                ).length;
                const allSelected =
                  contacts.length > 0 && selectedCount === contacts.length;

                return (
                  <li
                    key={e.siret}
                    className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm"
                  >
                    <div className="flex items-start gap-4 p-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange-50">
                        <Building2 className="h-5 w-5 text-orange-500" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-neutral-900">{e.nom}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500">
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3 shrink-0" />
                            {e.codePostal} {e.ville}
                          </span>
                          {e.domaine && <span className="max-w-[200px] truncate">{e.domaine}</span>}
                          {e.taille && (
                            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-600">
                              {e.taille}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                        {emailState.status === "idle" && (
                          <button
                            type="button"
                            onClick={() => findEmails(e.siret, e.nom, siren)}
                            className="flex items-center gap-1.5 rounded-lg border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-medium text-orange-700 transition-colors hover:bg-orange-100"
                          >
                            <Mail className="h-3.5 w-3.5" />
                            Trouver emails
                          </button>
                        )}

                        {emailState.status === "loading" && (
                          <span className="flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-1.5 text-xs text-neutral-500">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            Recherche…
                          </span>
                        )}

                        {(emailState.status === "done" || emailState.status === "error") && (
                          <button
                            type="button"
                            onClick={() => toggleExpand(e.siret)}
                            className="flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 transition-colors hover:bg-neutral-50"
                          >
                            {emailState.status === "done" && (
                              <>
                                <Mail className="h-3.5 w-3.5 text-green-500" />
                                {emailState.result.contacts.length > 0
                                  ? `${emailState.result.contacts.length} contact${emailState.result.contacts.length > 1 ? "s" : ""}`
                                  : "Aucun email"}
                              </>
                            )}
                            {emailState.status === "error" && (
                              <>
                                <AlertCircle className="h-3.5 w-3.5 text-red-400" />
                                Erreur
                              </>
                            )}
                            {isExpanded ? (
                              <ChevronUp className="h-3.5 w-3.5" />
                            ) : (
                              <ChevronDown className="h-3.5 w-3.5" />
                            )}
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            retirerEntreprise(e.siret);
                            setSelectedKeys((prev) => {
                              const next = new Set(prev);
                              [...next].forEach((k) => {
                                if (k.startsWith(`${e.siret}::`)) next.delete(k);
                              });
                              return next;
                            });
                          }}
                          className="rounded-lg p-1.5 text-neutral-300 transition-colors hover:bg-red-50 hover:text-red-500"
                          aria-label="Retirer de la sélection"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {isExpanded && emailState.status === "done" && (
                      <div className="border-t border-neutral-100 px-4 pb-4 pt-3">
                        {emailState.result.websiteUrl && (
                          <div className="mb-3 flex items-center gap-1.5 text-xs text-neutral-500">
                            <Globe className="h-3.5 w-3.5 shrink-0" />
                            <a
                              href={emailState.result.websiteUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-orange-600 hover:underline"
                            >
                              {emailState.result.domain}
                            </a>
                          </div>
                        )}

                        {emailState.result.contacts.length === 0 ? (
                          <NoEmailMessage
                            reason={emailState.result.noEmailReason}
                            domain={emailState.result.domain}
                            websiteUrl={emailState.result.websiteUrl}
                            nom={e.nom}
                          />
                        ) : (
                          <>
                            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                {selectedCount > 0 && (
                                  <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-600">
                                    {selectedCount} sélectionné{selectedCount > 1 ? "s" : ""}
                                  </span>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  allSelected
                                    ? deselectAllForCompany(e.siret, emailState.result.contacts)
                                    : selectAllForCompany(e.siret, emailState.result.contacts)
                                }
                                className="rounded-md border border-stone-200 bg-white px-2.5 py-1 text-xs font-medium text-stone-700 transition-colors hover:bg-stone-50"
                              >
                                {allSelected ? "Tout désélectionner" : "Tout sélectionner"}
                              </button>
                            </div>
                            <div className="grid gap-2 sm:grid-cols-2">
                              {emailState.result.contacts.map((contact) => (
                                <SelectionContactRow
                                  key={contact.email}
                                  contact={contact}
                                  selected={selectedKeys.has(contactKey(e.siret, contact.email))}
                                  onToggle={() => toggleContact(e.siret, contact.email)}
                                />
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    {isExpanded && emailState.status === "error" && (
                      <div className="border-t border-neutral-100 px-4 pb-4 pt-3">
                        <p className="text-sm text-red-500">{emailState.message}</p>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <SelectionLaunchBar
          totalSelected={totalSelected}
          onContinue={() => setShowLaunchConfig(true)}
        />

        {showLaunchConfig && (
          <div
            className="fixed inset-0 z-[95] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]"
            role="dialog"
            aria-modal="true"
            onClick={() => {
              if (!launching) setShowLaunchConfig(false);
            }}
          >
            <div
              className="w-full max-w-lg overflow-hidden rounded-3xl border border-stone-200/80 bg-white shadow-[0_20px_60px_-20px_rgba(15,23,42,0.35)]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="h-1 w-full bg-gradient-to-r from-[#FE6A2E] via-[#FF9F4A] to-[#FFB347]" />
              <div className="bg-gradient-to-b from-[#FFFBF7] to-white px-6 pb-6 pt-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold tracking-tight text-neutral-900">
                      Configurer la campagne
                    </h3>
                    <p className="mt-1 text-sm text-neutral-500">
                      Choisis le type de contrat avant le lancement.
                    </p>
                  </div>
                  <span className="rounded-full bg-orange-50 px-2.5 py-1 text-[11px] font-semibold text-orange-700 ring-1 ring-orange-200/70">
                    {selectedKeys.size} destinataire{selectedKeys.size > 1 ? "s" : ""}
                  </span>
                </div>

                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <label className="block sm:col-span-2">
                    <span className="text-sm font-medium text-neutral-700">Type de contrat</span>
                    <div className="relative mt-1.5">
                      <select
                        value={contractType}
                        onChange={(e) =>
                          setContractType(e.target.value as "stage" | "alternance" | "cdi" | "cdd")
                        }
                        className="w-full appearance-none rounded-xl border border-neutral-200 bg-white px-3 py-2.5 pr-9 text-sm font-medium text-neutral-900 transition-shadow focus:border-orange-200 focus:outline-none focus:ring-2 focus:ring-[#FE6A2E]/20"
                      >
                        <option value="cdi">CDI</option>
                        <option value="cdd">CDD</option>
                        <option value="alternance">Alternance</option>
                        <option value="stage">Stage</option>
                      </select>
                      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-neutral-400">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs text-neutral-500">
                      {contractType === "cdi"
                        ? "CDI : aucune période obligatoire."
                        : "Période requise pour personnaliser les lettres."}
                    </p>
                  </label>

                  {contractType !== "cdi" && (
                    <>
                      <label className="block">
                        <span className="text-sm font-medium text-neutral-700">Date de début</span>
                        <input
                          type="date"
                          value={contractStartDate}
                          onChange={(e) => setContractStartDate(e.target.value)}
                          className="mt-1.5 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-900 transition-shadow focus:border-orange-200 focus:outline-none focus:ring-2 focus:ring-[#FE6A2E]/20"
                        />
                      </label>
                      <label className="block">
                        <span className="text-sm font-medium text-neutral-700">Date de fin</span>
                        <input
                          type="date"
                          value={contractEndDate}
                          onChange={(e) => setContractEndDate(e.target.value)}
                          className="mt-1.5 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-900 transition-shadow focus:border-orange-200 focus:outline-none focus:ring-2 focus:ring-[#FE6A2E]/20"
                        />
                      </label>
                    </>
                  )}
                </div>

                <div className="mt-6 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (!launching) setShowLaunchConfig(false);
                    }}
                    disabled={launching}
                    className="rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={() => void launchCampaign()}
                    disabled={launching}
                    className="rounded-xl bg-gradient-to-r from-[#FE6A2E] to-[#FFB347] px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-orange-500/20 transition hover:brightness-[1.03] disabled:opacity-40"
                  >
                    {launching
                      ? launchPhase === "n8n"
                        ? "Envoi des e-mails…"
                        : "Génération des lettres…"
                      : "Lancer la campagne"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {launchFeedback && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="launch-feedback-title"
            onClick={() => setLaunchFeedback(null)}
          >
            <div
              className={`relative w-full overflow-hidden rounded-3xl border bg-white shadow-2xl ${
                launchFeedback.variant === "success"
                  ? "max-w-lg border-orange-100/80 shadow-orange-500/15 ring-1 ring-orange-100/60"
                  : "max-w-md border-white/20 shadow-orange-500/10"
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              {launchFeedback.variant === "success" && (
                <>
                  <div className="pointer-events-none absolute -left-12 -top-16 h-48 w-48 rounded-full bg-gradient-to-br from-amber-200/50 to-orange-300/30 blur-3xl" />
                  <div className="pointer-events-none absolute -bottom-10 -right-10 h-40 w-40 rounded-full bg-gradient-to-tl from-rose-200/40 to-orange-200/25 blur-3xl" />
                </>
              )}
              <div
                className={`relative text-center ${
                  launchFeedback.variant === "success" ? "px-10 pb-9 pt-11" : "px-8 pb-8 pt-10"
                }`}
              >
                {launchFeedback.variant === "success" ? (
                  <>
                    <div className="relative mx-auto mb-6 flex h-[5rem] w-[5rem] items-center justify-center rounded-3xl bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 shadow-[0_20px_50px_-12px_rgba(249,115,22,0.55)] ring-[6px] ring-orange-100/90">
                      <PartyPopper
                        className="h-11 w-11 text-white drop-shadow-md"
                        strokeWidth={2}
                        aria-hidden
                      />
                    </div>
                    <div className="mx-auto mb-5 inline-flex max-w-full items-center justify-center gap-2 rounded-full border border-orange-200/90 bg-gradient-to-r from-amber-50 via-white to-rose-50 px-7 py-3.5 shadow-[0_12px_40px_-12px_rgba(234,88,12,0.35)] sm:px-10 sm:py-4">
                      <Sparkles
                        className="h-5 w-5 shrink-0 text-amber-500 sm:h-6 sm:w-6"
                        aria-hidden
                      />
                      <span className="bg-gradient-to-r from-orange-600 via-orange-500 to-rose-600 bg-clip-text text-lg font-extrabold uppercase tracking-[0.18em] text-transparent sm:text-xl">
                        Félicitations
                      </span>
                      <Sparkles
                        className="h-5 w-5 shrink-0 text-amber-500 sm:h-6 sm:w-6"
                        aria-hidden
                      />
                    </div>
                    <h2
                      id="launch-feedback-title"
                      className="text-2xl font-bold tracking-tight text-neutral-900 sm:text-[1.75rem] sm:leading-snug"
                    >
                      {launchFeedback.title}
                    </h2>
                    <p className="mt-4 text-[15px] leading-relaxed text-neutral-600 sm:text-base">
                      Tes e-mails ont bien été envoyés.
                    </p>
                  </>
                ) : (
                  <>
                    <div
                      className={`mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl ${
                        launchFeedback.variant === "error"
                          ? "bg-red-50 ring-2 ring-red-100"
                          : "bg-amber-50 ring-2 ring-amber-100"
                      }`}
                    >
                      {launchFeedback.variant === "error" ? (
                        <AlertCircle
                          className="h-7 w-7 text-red-500"
                          strokeWidth={2}
                          aria-hidden
                        />
                      ) : (
                        <Mail className="h-7 w-7 text-amber-600" strokeWidth={2} aria-hidden />
                      )}
                    </div>
                    <h2
                      id="launch-feedback-title"
                      className="text-lg font-bold text-neutral-900"
                    >
                      {launchFeedback.title}
                    </h2>
                    <p className="mt-3 text-sm leading-relaxed text-neutral-600">
                      {launchFeedback.message}
                    </p>
                  </>
                )}

                <button
                  type="button"
                  onClick={() => setLaunchFeedback(null)}
                  className={`w-full font-semibold text-white transition hover:opacity-95 active:scale-[0.99] ${
                    launchFeedback.variant === "success"
                      ? "mt-9 rounded-2xl bg-gradient-to-r from-orange-500 via-orange-500 to-rose-500 px-4 py-3.5 text-[15px] shadow-lg shadow-orange-500/30"
                      : `mt-8 rounded-xl px-4 py-3 text-sm shadow-md ${
                          launchFeedback.variant === "error"
                            ? "bg-neutral-800 shadow-neutral-900/20"
                            : "bg-neutral-700 shadow-neutral-900/15"
                        }`
                  }`}
                >
                  {launchFeedback.variant === "success" ? "Super, merci !" : "Fermer"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
