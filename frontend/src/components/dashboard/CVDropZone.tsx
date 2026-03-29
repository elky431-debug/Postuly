"use client";

import Link from "next/link";
import { ExternalLink, FileText, FileUp, Loader2 } from "lucide-react";
import type { Profile } from "@/lib/types";

type CVDropZoneProps = {
  profile: Profile | null;
  uploading: boolean;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
};

/** Lignes coordonnées alignées sur la page Mon CV (cvInfoRows). */
function personalInfoRows(profile: Profile) {
  const cv = profile.cv_parsed;
  const p = cv?.personal;
  const name = p?.full_name?.trim() || profile.full_name?.trim() || "—";
  const loc = [p?.city, p?.postal_code].filter(Boolean).join(" ").trim() || "—";
  return [
    { label: "Nom complet", value: name },
    { label: "Email", value: cv?.email?.trim() || "—" },
    { label: "Téléphone", value: cv?.phone?.trim() || "—" },
    { label: "Localisation", value: loc },
  ];
}

function fileNameFromCvUrl(cvUrl: string): string {
  try {
    const seg = cvUrl.split("/").pop() || "";
    return decodeURIComponent(seg.split("?")[0] || "cv.pdf");
  } catch {
    return "cv.pdf";
  }
}

/**
 * Même logique que la page Mon CV : un CV « existe » dès qu’il est analysé (JSON)
 * ou noté, pas seulement si une URL Storage est présente (bucket indisponible → pas d’URL).
 */
function hasCvData(profile: Profile | null): boolean {
  if (!profile) return false;
  if (profile.cv_parsed) return true;
  if (profile.cv_score != null) return true;
  return Boolean(profile.cv_url?.trim());
}

/** Carte « Mon CV » — fond blanc, coordonnées extraites + pièce jointe + score. */
export function CVDropZone({ profile, uploading, onFileChange }: CVDropZoneProps) {
  const cvUrl = profile?.cv_url?.trim() || null;
  const hasCv = hasCvData(profile);
  const rows = profile ? personalInfoRows(profile) : [];
  const atsScore = profile?.cv_score ?? 0;

  return (
    <div id="cv" className="rounded-xl border border-neutral-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
        <h2 className="text-sm font-bold text-neutral-900">Mon CV</h2>
        <Link href="/cv" className="text-xs font-medium text-orange-600 transition-opacity hover:opacity-80">
          Page dédiée →
        </Link>
      </div>
      <div className="p-5">
        {hasCv ? (
          <div className="space-y-5">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Infos du CV
              </p>
              <dl className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
                {rows.map((row) => (
                  <div key={row.label} className="min-w-0">
                    <dt className="text-[11px] font-medium text-neutral-400">{row.label}</dt>
                    <dd className="truncate text-sm text-neutral-900" title={row.value}>
                      {row.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="rounded-lg border border-neutral-200 bg-neutral-50/80 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Pièce jointe
              </p>
              {cvUrl ? (
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-neutral-200 bg-white">
                    <FileText className="h-5 w-5 text-orange-600" strokeWidth={1.75} aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-neutral-900" title={fileNameFromCvUrl(cvUrl)}>
                      {fileNameFromCvUrl(cvUrl)}
                    </p>
                    <a
                      href={cvUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-orange-600 hover:underline"
                    >
                      Ouvrir / télécharger
                      <ExternalLink className="h-3 w-3" aria-hidden />
                    </a>
                  </div>
                </div>
              ) : (
                <p className="text-xs leading-relaxed text-neutral-600">
                  Aucun fichier en ligne (stockage indisponible ou URL non enregistrée). Les infos ci-dessus
                  viennent de l’analyse. Tu peux envoyer un nouveau fichier via « Remplacer le CV » ou la page
                  Mon CV.
                </p>
              )}
            </div>

            <div className="space-y-4 border-t border-neutral-100 pt-4">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-medium text-neutral-500">Score ATS</p>
                  <p
                    className="text-4xl font-bold tabular-nums tracking-tight text-neutral-900"
                    style={{
                      color:
                        atsScore >= 70 ? "#16A34A" : atsScore >= 40 ? "#D97706" : "#DC2626",
                    }}
                  >
                    {profile?.cv_score != null ? profile.cv_score : "—"}
                    <span className="text-xl font-normal text-neutral-400">/100</span>
                  </p>
                </div>
                <span className="text-xs text-neutral-500">
                  {profile?.cv_score == null
                    ? "—"
                    : atsScore >= 70
                      ? "Excellent"
                      : atsScore >= 40
                        ? "Correct"
                        : "À améliorer"}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-neutral-100">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${atsScore}%`,
                    background:
                      atsScore >= 70 ? "#16A34A" : atsScore >= 40 ? "#D97706" : "#DC2626",
                  }}
                />
              </div>
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 py-2.5 text-xs font-medium text-neutral-700 transition-colors hover:border-orange-200 hover:bg-orange-50/60">
                <FileUp className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                Remplacer le CV
                <input type="file" className="hidden" accept=".pdf,.docx" onChange={onFileChange} />
              </label>
            </div>
          </div>
        ) : (
          <label className="block cursor-pointer">
            <div className="flex flex-col items-center gap-3 rounded-[10px] border border-dashed border-neutral-200 bg-neutral-50 px-6 py-10 text-center transition-colors duration-150 hover:border-orange-300 hover:bg-orange-50/40">
              {uploading ? (
                <Loader2 className="h-8 w-8 animate-spin text-neutral-400" aria-hidden />
              ) : (
                <FileUp className="h-8 w-8 text-neutral-400" strokeWidth={1.5} aria-hidden />
              )}
              <p className="text-sm font-medium text-neutral-600">
                {uploading ? "Analyse en cours…" : "Glisse ton CV ici"}
              </p>
              <p className="text-xs text-neutral-500">ou clique pour parcourir</p>
              <div className="mt-1 flex flex-wrap justify-center gap-1.5">
                {["PDF", "DOCX", "max 5 MB"].map((t) => (
                  <span key={t} className="rounded-md bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-500">
                    {t}
                  </span>
                ))}
              </div>
            </div>
            <input
              type="file"
              className="hidden"
              accept=".pdf,.docx"
              onChange={onFileChange}
              disabled={uploading}
            />
          </label>
        )}
      </div>
    </div>
  );
}
