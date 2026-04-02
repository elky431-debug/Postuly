"use client";

type RelanceConfirmModalProps = {
  open: boolean;
  title: string;
  message: string;
  count: number;
  onCancel: () => void;
  onConfirm: () => void;
  loading?: boolean;
};

export function RelanceConfirmModal({
  open,
  title,
  message,
  count,
  onCancel,
  onConfirm,
  loading,
}: RelanceConfirmModalProps) {
  if (!open) return null;

  return (
    <>
      <button
        type="button"
        aria-label="Fermer"
        className="fixed inset-0 z-[60] cursor-default border-0 bg-stone-900/40 p-0"
        onClick={onCancel}
      />
      <div className="fixed left-1/2 top-1/2 z-[70] w-[min(100%,420px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-stone-200 bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-stone-900">{title}</h3>
        <p className="mt-2 text-sm text-stone-600">{message}</p>
        <p className="mt-3 text-sm font-medium text-orange-600">
          {count} entreprise{count > 1 ? "s" : ""} concernée{count > 1 ? "s" : ""}.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
          >
            Annuler
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
          >
            {loading ? "Envoi…" : "Confirmer"}
          </button>
        </div>
      </div>
    </>
  );
}
