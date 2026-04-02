"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Building2, Eye } from "lucide-react";
import type { Application } from "@/lib/types";
import { StatusBadge } from "./StatusBadge";
import type { RelanceApplicationUiStatus } from "@/types/relance";

function toUiStatus(status: string): RelanceApplicationUiStatus {
  if (status === "followed_up") return "relanced";
  if (["replied", "interview", "offer"].includes(status)) return "replied";
  return "no_reply";
}

const PAGE = 20;

type ApplicationsTableProps = {
  applications: Application[];
  onOpenLetter: (applicationId: string) => void;
  onRequestBulkRelance: (ids: string[]) => void;
  onRelanceOne: (applicationId: string) => void;
  busy?: boolean;
};

export function ApplicationsTable({
  applications,
  onOpenLetter,
  onRequestBulkRelance,
  onRelanceOne,
  busy,
}: ApplicationsTableProps) {
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const sentIds = useMemo(
    () => new Set(applications.filter((a) => a.status === "sent").map((a) => a.id)),
    [applications]
  );

  const slice = useMemo(() => {
    const start = page * PAGE;
    return applications.slice(start, start + PAGE);
  }, [applications, page]);

  const totalPages = Math.max(1, Math.ceil(applications.length / PAGE));

  function toggle(id: string) {
    if (!sentIds.has(id)) return;
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function selectAllSentOnPage() {
    const onPage = slice.filter((a) => a.status === "sent").map((a) => a.id);
    setSelected(new Set(onPage));
  }

  const selectedSent = [...selected].filter((id) => sentIds.has(id));

  return (
    <div className="rounded-2xl border border-stone-200 bg-white shadow-[0_14px_30px_-28px_rgba(15,23,42,0.6)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 px-4 py-3">
        <p className="text-sm font-medium text-stone-700">
          {applications.length} candidature{applications.length > 1 ? "s" : ""}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={selectAllSentOnPage}
            className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50"
          >
            Cocher « Envoyé » (page)
          </button>
          <button
            type="button"
            disabled={selectedSent.length === 0 || busy}
            onClick={() => onRequestBulkRelance(selectedSent)}
            className="rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-600 disabled:opacity-40"
          >
            Relancer la sélection ({selectedSent.length})
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-stone-200 text-xs font-semibold uppercase tracking-wide text-stone-500">
              <th className="px-4 py-3"> </th>
              <th className="px-4 py-3">Entreprise</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Date d&apos;envoi</th>
              <th className="px-4 py-3">Statut</th>
              <th className="px-4 py-3">Lettre</th>
              <th className="px-4 py-3">Relance</th>
              <th className="px-4 py-3">Fiche</th>
            </tr>
          </thead>
          <tbody>
            {slice.map((app) => {
              const st = app.status;
              const isSent = st === "sent";
              const isPre = st === "pending_review" || st === "approved";
              const site = app.company?.website_url?.trim();
              return (
                <tr key={app.id} className="border-b border-stone-100 hover:bg-stone-50/80">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(app.id)}
                      disabled={!isSent}
                      onChange={() => toggle(app.id)}
                      className="h-4 w-4 rounded border-stone-300"
                      aria-label={`Sélectionner ${app.company?.name ?? ""}`}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-stone-100 text-stone-500">
                        <Building2 className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-stone-900">
                          {app.company?.name ?? "Entreprise"}
                        </p>
                        {site ? (
                          <a
                            href={site.startsWith("http") ? site : `https://${site}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-orange-600 hover:underline"
                          >
                            Site web
                          </a>
                        ) : (
                          <span className="text-xs text-stone-400">—</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="max-w-[200px] truncate px-4 py-3 text-stone-600">
                    {app.contact?.email ?? "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-stone-600">
                    {app.sent_at
                      ? new Date(app.sent_at).toLocaleDateString("fr-FR")
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {isPre ? (
                      <span className="inline-flex rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-600 ring-1 ring-stone-200">
                        Pré-envoi
                      </span>
                    ) : (
                      <StatusBadge scope="application" status={toUiStatus(st)} />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => onOpenLetter(app.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-stone-200 px-2 py-1 text-xs font-medium text-stone-700 hover:bg-stone-50"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Voir
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    {isSent ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => onRelanceOne(app.id)}
                        className="rounded-lg bg-orange-500 px-2.5 py-1 text-xs font-semibold text-white hover:bg-orange-600 disabled:opacity-40"
                      >
                        Relancer
                      </button>
                    ) : (
                      <span className="text-xs text-stone-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/applications/${app.id}`}
                      className="text-xs font-medium text-orange-600 hover:underline"
                    >
                      Ouvrir
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-stone-100 px-4 py-3 text-sm text-stone-600">
          <button
            type="button"
            disabled={page <= 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="rounded-lg border border-stone-200 px-3 py-1 disabled:opacity-40"
          >
            Précédent
          </button>
          <span>
            Page {page + 1} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            className="rounded-lg border border-stone-200 px-3 py-1 disabled:opacity-40"
          >
            Suivant
          </button>
        </div>
      )}
    </div>
  );
}
