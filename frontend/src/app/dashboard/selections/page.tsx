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
  User,
  Globe,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  ExternalLink,
  Phone,
  Search,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useSelectionStore } from "@/store/selectionStore";
import type { EmailResult, EmailContact } from "@/app/api/entreprises/email/route";

// ─── État par entreprise ──────────────────────────────────────────────────────

type EmailState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; result: EmailResult }
  | { status: "error"; message: string };

// ─── Composant copier email ───────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button
      type="button"
      onClick={handleCopy}
      className="rounded p-0.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 transition-colors"
      title="Copier"
    >
      {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

// ─── Card d'un contact email ──────────────────────────────────────────────────

const DEPT_LABELS: Record<string, string> = {
  hr: "RH",
  management: "Direction",
  executive: "Direction",
  operations: "Opérations",
  finance: "Finance",
  sales: "Commercial",
  marketing: "Marketing",
  communication: "Communication",
  it: "IT",
  support: "Support",
};

function ContactCard({ contact }: { contact: EmailContact }) {
  const hasName = contact.firstName || contact.lastName;
  const fullName = [contact.firstName, contact.lastName].filter(Boolean).join(" ");
  const isHr = contact.isHr || contact.department === "hr";
  const deptLabel = contact.department ? (DEPT_LABELS[contact.department] ?? contact.department) : null;

  return (
    <div className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 ${isHr ? "border-green-200 bg-green-50" : "border-neutral-100 bg-neutral-50"}`}>
      <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${isHr ? "border-green-200 bg-white" : "border-neutral-200 bg-white"}`}>
        <User className={`h-3.5 w-3.5 ${isHr ? "text-green-600" : "text-neutral-400"}`} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          {hasName && (
            <p className="text-xs font-semibold text-neutral-800">{fullName}</p>
          )}
          {isHr && (
            <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-green-700">
              RH
            </span>
          )}
          {deptLabel && !isHr && (
            <span className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-[9px] font-medium text-neutral-500">
              {deptLabel}
            </span>
          )}
        </div>
        {contact.position && (
          <p className="text-[11px] text-neutral-500">{contact.position}</p>
        )}
        <div className="mt-1 flex items-center gap-1.5">
          <span className="font-mono text-xs text-neutral-700">{contact.email}</span>
          <CopyButton text={contact.email} />
        </div>
        {contact.source === "hunter" && contact.confidence && (
          <p className={`mt-0.5 text-[10px] font-medium ${contact.confidence >= 80 ? "text-green-600" : "text-amber-600"}`}>
            {contact.confidence}% confiance
          </p>
        )}
        {contact.source === "scrape" && (
          <p className="mt-0.5 text-[10px] text-neutral-400">Depuis le site web</p>
        )}
      </div>
    </div>
  );
}

// ─── Message aucun email ──────────────────────────────────────────────────────

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
  const encodedNom = encodeURIComponent(nom + " recrutement contact");

  if (reason === "no_website") {
    return (
      <div className="rounded-lg border border-neutral-100 bg-neutral-50 p-4">
        <p className="text-sm font-medium text-neutral-700">
          Aucun site web trouvé pour cette entreprise
        </p>
        <p className="mt-1 text-xs text-neutral-500">
          Sans site web public, il est difficile de trouver des contacts automatiquement.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a
            href={`https://annuaire-entreprises.data.gouv.fr/rechercher?terme=${encodeURIComponent(nom)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100 transition-colors"
          >
            <ExternalLink className="h-3 w-3" />
            Fiche officielle
          </a>
          <a
            href={`https://www.google.com/search?q=${encodedNom}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100 transition-colors"
          >
            <Search className="h-3 w-3" />
            Rechercher sur Google
          </a>
          <a
            href={`https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(nom)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100 transition-colors"
          >
            <ExternalLink className="h-3 w-3" />
            LinkedIn
          </a>
        </div>
      </div>
    );
  }

  // no_public_email — site trouvé mais aucun email exposé
  return (
    <div className="rounded-lg border border-amber-100 bg-amber-50 p-4">
      <p className="text-sm font-medium text-amber-900">
        Aucun email public trouvé pour cette entreprise
      </p>
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
            className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100 transition-colors"
          >
            <Globe className="h-3 w-3" />
            Formulaire de contact
          </a>
        )}
        <a
          href={`https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(nom + " RH recrutement")}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100 transition-colors"
        >
          <ExternalLink className="h-3 w-3" />
          Chercher le RH sur LinkedIn
        </a>
        <a
          href={`https://annuaire-entreprises.data.gouv.fr/rechercher?terme=${encodeURIComponent(nom)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100 transition-colors"
        >
          <Phone className="h-3 w-3" />
          Fiche officielle (téléphone)
        </a>
      </div>
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────

export default function SelectionsPage() {
  const { selection, retirerEntreprise, viderSelection } = useSelectionStore();
  const [confirmClear, setConfirmClear] = useState(false);
  const [emailStates, setEmailStates] = useState<Record<string, EmailState>>({});
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  function toggleExpand(siret: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(siret) ? next.delete(siret) : next.add(siret);
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
        [siret]: { status: "error", message: err instanceof Error ? err.message : "Erreur inconnue" },
      }));
    }
  }

  function handleClear() {
    if (confirmClear) {
      viderSelection();
      setConfirmClear(false);
      setEmailStates({});
    } else {
      setConfirmClear(true);
    }
  }

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-white">
        {/* Header */}
        <div className="border-b border-neutral-200 bg-white px-6 py-4">
          <div className="mx-auto max-w-4xl">
            <div className="flex items-center justify-between gap-4">
              <Link
                href="/dashboard/entreprises"
                className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 transition-colors"
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
                  : `${selection.length} entreprise${selection.length > 1 ? "s" : ""} · Clique sur "Trouver emails" pour lancer la recherche`}
              </p>
            </div>
          </div>
        </div>

        {/* Contenu */}
        <div className="mx-auto max-w-4xl px-6 py-6">
          {selection.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-100">
                <Building2 className="h-7 w-7 text-neutral-400" />
              </div>
              <h2 className="mt-4 text-base font-semibold text-neutral-700">
                Aucune entreprise sélectionnée
              </h2>
              <p className="mt-1.5 max-w-xs text-sm text-neutral-400">
                Recherche des entreprises et ajoute-les à ta sélection pour les retrouver ici.
              </p>
              <Link
                href="/dashboard/entreprises"
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 transition-colors"
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

                return (
                  <li
                    key={e.siret}
                    className="rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden"
                  >
                    {/* Ligne principale */}
                    <div className="flex items-start gap-4 p-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange-50">
                        <Building2 className="h-5 w-5 text-orange-500" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-neutral-900 truncate">{e.nom}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500">
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3 shrink-0" />
                            {e.codePostal} {e.ville}
                          </span>
                          {e.domaine && (
                            <span className="truncate max-w-[200px]">{e.domaine}</span>
                          )}
                          {e.taille && (
                            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-600">
                              {e.taille}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex shrink-0 items-center gap-2">
                        {/* Bouton Trouver emails */}
                        {emailState.status === "idle" && (
                          <button
                            type="button"
                            onClick={() => findEmails(e.siret, e.nom, siren)}
                            className="flex items-center gap-1.5 rounded-lg border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-medium text-orange-700 hover:bg-orange-100 transition-colors"
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
                            className="flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50 transition-colors"
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

                        {/* Retirer */}
                        <button
                          type="button"
                          onClick={() => retirerEntreprise(e.siret)}
                          className="rounded-lg p-1.5 text-neutral-300 hover:bg-red-50 hover:text-red-500 transition-colors"
                          aria-label="Retirer de la sélection"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Résultats emails expandables */}
                    {isExpanded && emailState.status === "done" && (
                      <div className="border-t border-neutral-100 px-4 pb-4 pt-3">
                        {/* Site web trouvé */}
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
                          <div className="grid gap-2 sm:grid-cols-2">
                            {emailState.result.contacts.map((contact) => (
                              <ContactCard key={contact.email} contact={contact} />
                            ))}
                          </div>
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
      </div>
    </DashboardLayout>
  );
}
