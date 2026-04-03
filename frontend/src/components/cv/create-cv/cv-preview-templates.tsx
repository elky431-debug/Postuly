"use client";

import type { EnrichedCvJson } from "@/types/create-cv";
import { formatPeriodeEcriteFr } from "@/lib/create-cv-dates";
import { escapeCvHtml } from "@/lib/cv-html-escape";

type Props = {
  enriched: EnrichedCvJson;
  photoBase64: string | null;
  printAreaId?: string;
  className?: string;
};

function esc(s: string): string {
  return escapeCvHtml(s);
}

const ACCENT = "#7b61ff";
const DARK = "#1e1e2f";
const TEXT_MAIN = "#262626";
const TEXT_TITLE = "#171717";
const TEXT_MUTED = "#525252";
const TEXT_SOFT = "#737373";
const TEXT_DIM = "#404040";
const BORDER_LIGHT = "#f5f5f5";
const RING_PHOTO = "rgba(255,255,255,0.28)";
const RING_PLACEHOLDER = "rgba(255,255,255,0.18)";

/**
 * CV deux colonnes — uniquement couleurs hex/rgba (pas de classes Tailwind « couleur »)
 * pour éviter oklab() avec html2canvas / Safari.
 */
export function CvPreviewModernDark({
  enriched,
  photoBase64,
  printAreaId,
  className = "",
}: Props) {
  return (
    <div
      {...(printAreaId ? { id: printAreaId } : {})}
      className={`flex h-fit w-[794px] shrink-0 flex-row items-stretch overflow-hidden rounded-sm border border-solid shadow-lg ${className}`}
      style={{
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        borderColor: "#e5e5e5",
        backgroundColor: "#ffffff",
        boxShadow: "0 10px 15px -3px rgba(0,0,0,0.08), 0 4px 6px -4px rgba(0,0,0,0.06)",
      }}
    >
      <aside
        className="flex w-[34%] min-w-[140px] shrink-0 flex-col gap-5 self-stretch p-5 sm:min-w-[160px] sm:p-6"
        style={{ backgroundColor: DARK, color: "#ffffff" }}
      >
        <div className="mx-auto w-full max-w-[148px] shrink-0">
          {photoBase64 ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoBase64}
              alt=""
              className="aspect-[3/4] w-full rounded-2xl object-cover"
              style={{ border: `2px solid ${RING_PHOTO}` }}
            />
          ) : (
            <div
              className="flex aspect-[3/4] w-full items-center justify-center rounded-2xl text-2xl font-light"
              style={{
                backgroundColor: "rgba(123, 97, 255, 0.22)",
                color: "rgba(255,255,255,0.5)",
                border: `2px solid ${RING_PLACEHOLDER}`,
              }}
            >
              {enriched.prenom?.[0]}
              {enriched.nom?.[0]}
            </div>
          )}
        </div>
        <div>
          <h2 className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: ACCENT }}>
            Contact
          </h2>
          <ul
            className="mt-2 space-y-1.5 text-xs leading-relaxed sm:text-sm"
            style={{ color: "rgba(255,255,255,0.92)" }}
          >
            {enriched.email && <li>{esc(enriched.email)}</li>}
            {enriched.tel && <li>{esc(enriched.tel)}</li>}
            {enriched.ville && <li>{esc(enriched.ville)}</li>}
            {enriched.linkedin && (
              <li className="break-all" title={enriched.linkedin}>
                {esc(enriched.linkedin)}
              </li>
            )}
          </ul>
        </div>
        {(enriched.skills?.length ?? 0) > 0 && (
          <div>
            <h2 className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: ACCENT }}>
              Compétences
            </h2>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {enriched.skills!.map((s) => (
                <span
                  key={s}
                  className="rounded-full px-2.5 py-1 text-[10px] font-medium sm:text-xs"
                  style={{ backgroundColor: "rgba(123, 97, 255, 0.28)", color: "#e8e6ff" }}
                >
                  {esc(s)}
                </span>
              ))}
            </div>
          </div>
        )}
        {(enriched.langues?.length ?? 0) > 0 && (
          <div>
            <h2 className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: ACCENT }}>
              Langues
            </h2>
            <ul
              className="mt-2 space-y-1 text-xs sm:text-sm"
              style={{ color: "rgba(255,255,255,0.88)" }}
            >
              {enriched.langues!.map((l, i) => (
                <li key={i}>
                  {esc(l.langue)} — {esc(l.niveau)}
                </li>
              ))}
            </ul>
          </div>
        )}
      </aside>
      <main
        className="min-w-0 flex-1 p-5 sm:p-7"
        style={{ backgroundColor: "#ffffff", color: TEXT_MAIN }}
      >
        <header className="border-b border-solid pb-4" style={{ borderColor: BORDER_LIGHT }}>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl" style={{ color: TEXT_TITLE }}>
            {esc(enriched.prenom)} {esc(enriched.nom)}
          </h1>
          {enriched.titre?.trim() ? (
            <p className="mt-1 text-sm font-semibold uppercase tracking-wide" style={{ color: ACCENT }}>
              {esc(enriched.titre.trim())}
            </p>
          ) : null}
        </header>
        {enriched.accroche && (
          <p className="mt-4 text-sm leading-relaxed sm:text-[15px]" style={{ color: TEXT_MUTED }}>
            {esc(enriched.accroche)}
          </p>
        )}
        {(enriched.experiences?.length ?? 0) > 0 && (
          <section className="mt-6">
            <h2
              className="border-l-4 border-solid pl-3 text-sm font-bold uppercase tracking-wide"
              style={{ borderColor: ACCENT, color: TEXT_TITLE }}
            >
              Expérience professionnelle
            </h2>
            <div className="mt-3 space-y-4">
              {enriched.experiences!.map((ex, i) => (
                <div key={i} className="text-sm">
                  <div className="flex flex-wrap items-baseline justify-between gap-1">
                    <span className="font-semibold" style={{ color: TEXT_TITLE }}>
                      {esc(ex.titre)}
                    </span>
                    <span className="text-xs" style={{ color: TEXT_SOFT }}>
                      {esc(formatPeriodeEcriteFr(ex.periode))}
                    </span>
                  </div>
                  <p className="text-xs font-medium" style={{ color: TEXT_MUTED }}>
                    {esc(ex.entreprise)}
                    {ex.lieu ? ` · ${esc(ex.lieu)}` : ""}
                  </p>
                  <ul
                    className="mt-1.5 list-disc space-y-0.5 pl-4 text-sm leading-relaxed"
                    style={{ color: TEXT_MUTED }}
                  >
                    {(ex.points ?? []).map((p, j) => (
                      <li key={j}>{esc(p)}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        )}
        {(enriched.formations?.length ?? 0) > 0 && (
          <section className="mt-6">
            <h2
              className="border-l-4 border-solid pl-3 text-sm font-bold uppercase tracking-wide"
              style={{ borderColor: ACCENT, color: TEXT_TITLE }}
            >
              Formation
            </h2>
            <div className="mt-3 space-y-3 text-sm">
              {enriched.formations!.map((f, i) => (
                <div key={i}>
                  <div className="flex flex-wrap items-baseline justify-between gap-1">
                    <span className="font-semibold" style={{ color: TEXT_TITLE }}>
                      {esc(f.diplome)}
                    </span>
                    <span className="text-xs" style={{ color: TEXT_SOFT }}>
                      {esc(formatPeriodeEcriteFr(f.periode))}
                    </span>
                  </div>
                  <div className="text-xs" style={{ color: TEXT_MUTED }}>
                    {esc(f.ecole)}
                    {f.lieu ? ` · ${esc(f.lieu)}` : ""}
                  </div>
                  {f.detail && (
                    <p className="mt-1 text-sm leading-relaxed" style={{ color: TEXT_SOFT }}>
                      {esc(f.detail)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
        {enriched.loisirs && (
          <section className="mt-6 text-sm" style={{ color: TEXT_SOFT }}>
            <span className="font-semibold" style={{ color: TEXT_DIM }}>
              Centres d&apos;intérêt ·{" "}
            </span>
            {esc(enriched.loisirs)}
          </section>
        )}
      </main>
    </div>
  );
}
