"use client";

/**
 * Barre fixe : nombre de contacts cochés + CTA (centrée dans la zone principale).
 */
export function SelectionLaunchBar({
  totalSelected,
  onLaunch,
  launching,
}: {
  totalSelected: number;
  onLaunch: () => void;
  launching: boolean;
}) {
  if (totalSelected === 0) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center p-4 pb-6 md:pl-[244px]"
      aria-live="polite"
    >
      <div
        className="pointer-events-auto flex min-w-[min(100%,360px)] max-w-lg items-center gap-4 rounded-2xl border border-stone-200 bg-white px-5 py-3.5 shadow-lg shadow-stone-900/10"
      >
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-stone-900">
            {totalSelected} destinataire{totalSelected > 1 ? "s" : ""} sélectionné
            {totalSelected > 1 ? "s" : ""}
          </p>
          <p className="mt-0.5 text-xs text-stone-500">
            Génération des lettres puis envoi Gmail espacé via n8n (environ 2 min entre chaque
            e-mail).
          </p>
        </div>
        <button
          type="button"
          onClick={onLaunch}
          disabled={launching}
          className="shrink-0 rounded-lg bg-stone-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-400"
        >
          {launching ? "Envoi…" : "Lancer la campagne"}
        </button>
      </div>
    </div>
  );
}
