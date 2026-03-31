"use client";

import { useCallback, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import Link from "next/link";
import { CONTRACT_LABELS } from "@/lib/utils";
import type { Application, ApplicationStatus } from "@/lib/types";

/** Colonnes Kanban — teintes Postuly (orange / or / corail). */
const KANBAN_PIPELINE_COLUMNS: {
  id: ApplicationStatus;
  label: string;
  color: string;
  ring: string;
  columnBg: string;
  columnBgOver: string;
}[] = [
  {
    id: "sent",
    label: "Envoyé",
    color: "#FE6A2E",
    ring: "rgba(254, 106, 46, 0.35)",
    columnBg: "linear-gradient(180deg, #FFFBF7 0%, #FFF5EB 100%)",
    columnBgOver: "linear-gradient(180deg, #FFF7ED 0%, #FFEDD5 100%)",
  },
  {
    id: "followed_up",
    label: "Relancé",
    color: "#EA580C",
    ring: "rgba(234, 88, 12, 0.3)",
    columnBg: "linear-gradient(180deg, #FFFAF5 0%, #FFF1E3 100%)",
    columnBgOver: "linear-gradient(180deg, #FFF4E6 0%, #FFE4CC 100%)",
  },
  {
    id: "rejected",
    label: "Refusé",
    color: "#E11D48",
    ring: "rgba(225, 29, 72, 0.28)",
    columnBg: "linear-gradient(180deg, #FFFBFC 0%, #FFF1F2 100%)",
    columnBgOver: "linear-gradient(180deg, #FFF1F3 0%, #FFE4E9 100%)",
  },
];

function formatContract(raw: string | undefined): string {
  if (!raw) return "—";
  const key = raw.toLowerCase();
  return CONTRACT_LABELS[key] ?? raw;
}

function emailSubjectPreview(app: Application): string {
  const jt = app.campaign?.job_title?.trim();
  return jt ? `Candidature — ${jt}` : "—";
}

function displayDate(app: Application): string {
  const iso = app.sent_at ?? app.created_at;
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function cardDateShort(app: Application): string {
  const iso = app.sent_at ?? app.created_at;
  return new Date(iso).toLocaleDateString("fr-FR");
}

function cityLabel(app: Application): string {
  return (
    app.campaign?.location?.trim() ||
    app.company?.city?.trim() ||
    "—"
  );
}

// ── Drawer prévisualisation ────────────────────────────────────────────────────

function PreviewDrawer({
  app,
  onClose,
}: {
  app: Application;
  onClose: () => void;
}) {
  return (
    <>
      <button
        type="button"
        aria-label="Fermer"
        className="fixed inset-0 z-40 cursor-default border-0 bg-gradient-to-br from-stone-900/35 via-stone-900/25 to-[#431407]/20 p-0 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <aside
        className="fixed top-0 right-0 bottom-0 z-50 flex w-full max-w-[520px] flex-col overflow-y-auto bg-[#FDFBF8] shadow-[-8px_0_40px_-8px_rgba(254,106,46,0.18)]"
      >
        <header className="sticky top-0 z-[1] border-b border-orange-100/90 bg-gradient-to-br from-white via-[#FFFBF7] to-[#FFF5EB] px-6 py-5">
          <div className="h-0.5 w-16 rounded-full bg-gradient-to-r from-[#FE6A2E] to-[#FFB347] mb-4" aria-hidden />
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-lg font-semibold leading-snug text-stone-900">
                {app.company?.name ?? "Entreprise"}
              </div>
              <div className="mt-1 text-[13px] text-stone-500">
                {app.campaign?.job_title ?? "—"}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 cursor-pointer rounded-xl border border-stone-200/80 bg-white/90 px-3 py-2 text-lg leading-none text-stone-500 shadow-sm transition hover:border-orange-200 hover:bg-orange-50/80 hover:text-[#FE6A2E]"
            >
              ×
            </button>
          </div>
        </header>

        <div className="flex flex-col gap-6 px-6 py-6">
          <section>
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#FE6A2E]">
              Candidature
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { label: "Entreprise", value: app.company?.name ?? "—" },
                { label: "Poste", value: app.campaign?.job_title ?? "—" },
                {
                  label: "Contrat",
                  value: formatContract(app.campaign?.contract_type),
                },
                { label: "Ville", value: cityLabel(app) },
                { label: "Date d'envoi", value: displayDate(app) },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  className="rounded-xl border border-stone-100/90 bg-white px-3 py-2.5 shadow-sm"
                >
                  <div className="mb-0.5 text-[11px] text-stone-400">
                    {label}
                  </div>
                  <div className="text-[13px] font-medium text-stone-900">
                    {value}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#FE6A2E]">
              Destinataire RH
            </div>
            <div className="rounded-xl border border-orange-100/80 bg-gradient-to-r from-[#FFF7ED] to-white px-4 py-3 shadow-inner">
              {app.contact?.email ? (
                <a
                  href={`mailto:${app.contact.email}`}
                  className="text-[13px] font-semibold text-[#C2410C] underline decoration-orange-200 underline-offset-2 hover:text-[#FE6A2E]"
                >
                  {app.contact.email}
                </a>
              ) : (
                <span className="text-[13px] text-stone-500">—</span>
              )}
            </div>
          </section>

          <section>
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#FE6A2E]">
              Objet de l&apos;email
            </div>
            <div className="rounded-xl border border-orange-100/60 bg-gradient-to-r from-orange-50/90 to-amber-50/50 px-4 py-3 text-[13px] font-medium text-stone-800">
              {emailSubjectPreview(app)}
            </div>
          </section>

          <section>
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#FE6A2E]">
              Lettre de motivation
            </div>
            <div className="whitespace-pre-wrap rounded-2xl border border-stone-200/80 bg-white px-5 py-4 text-sm leading-relaxed text-stone-800 shadow-sm">
              {app.cover_letter?.trim() || "—"}
            </div>
          </section>

          <div className="pb-2">
            <Link
              href={`/applications/${app.id}`}
              className="inline-flex items-center gap-1 text-sm font-semibold text-[#FE6A2E] transition hover:text-[#EA580C]"
            >
              Ouvrir la fiche candidature
              <span aria-hidden>→</span>
            </Link>
          </div>
        </div>
      </aside>
    </>
  );
}

// ── Carte ─────────────────────────────────────────────────────────────────────

function ApplicationCard({
  app,
  isDragging = false,
  onPreview,
}: {
  app: Application;
  isDragging?: boolean;
  onPreview?: () => void;
}) {
  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border border-orange-100/90 bg-white px-4 py-3.5 transition-all ${
        isDragging
          ? "opacity-40 shadow-none"
          : "shadow-[0_2px_12px_-2px_rgba(254,106,46,0.12),0_1px_2px_rgba(0,0,0,0.04)] hover:border-orange-200/90 hover:shadow-[0_8px_24px_-6px_rgba(254,106,46,0.18)]"
      }`}
    >
      <div
        className="absolute left-0 top-0 h-full w-1 rounded-l-2xl bg-gradient-to-b from-[#FE6A2E] to-[#FFB347] opacity-90"
        aria-hidden
      />
      <div className="pl-2">
        <div className="mb-0.5 text-sm font-semibold leading-snug text-stone-900">
          {app.company?.name ?? "Entreprise"}
        </div>
        <div className="mb-2.5 text-[13px] text-stone-500">
          {app.campaign?.job_title ?? "—"}
        </div>
        <div className="mb-3 flex flex-wrap gap-1.5">
          <span className="rounded-full bg-gradient-to-r from-[#FFF1E3] to-orange-50/80 px-2.5 py-0.5 text-[11px] font-semibold text-[#C2410C] ring-1 ring-orange-100/80">
            {formatContract(app.campaign?.contract_type)}
          </span>
          <span className="rounded-full bg-stone-100/90 px-2.5 py-0.5 text-[11px] font-medium text-stone-600">
            {cityLabel(app)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-medium tabular-nums text-stone-400">
            {cardDateShort(app)}
          </span>
          {onPreview && (
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onPreview();
              }}
              className="cursor-pointer rounded-lg bg-gradient-to-r from-[#FE6A2E] to-[#FFB347] px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:brightness-[1.05]"
            >
              Voir →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function DraggableCard({
  app,
  onPreview,
}: {
  app: Application;
  onPreview: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: app.id,
  });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className="cursor-grab"
    >
      <ApplicationCard
        app={app}
        isDragging={isDragging}
        onPreview={onPreview}
      />
    </div>
  );
}

function Column({
  id,
  label,
  color,
  ring,
  columnBg,
  columnBgOver,
  apps,
  onPreview,
}: {
  id: ApplicationStatus;
  label: string;
  color: string;
  ring: string;
  columnBg: string;
  columnBgOver: string;
  apps: Application[];
  onPreview: (app: Application) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div className="min-w-0 flex-1">
      <div className="mb-3 flex items-center gap-2.5 rounded-2xl border border-stone-200/60 bg-white/90 px-3 py-2.5 shadow-sm backdrop-blur-sm">
        <div
          className="h-3 w-3 shrink-0 rounded-full shadow-sm ring-2"
          style={{ background: color, boxShadow: `0 0 0 3px ${ring}` }}
        />
        <span className="text-sm font-semibold text-stone-800">{label}</span>
        <span
          className="ml-auto min-w-[1.75rem] rounded-full bg-gradient-to-r from-stone-100 to-stone-50 px-2 py-0.5 text-center text-xs font-bold tabular-nums text-stone-600 ring-1 ring-stone-200/80"
        >
          {apps.length}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className="flex min-h-[420px] flex-col gap-2.5 rounded-2xl border-2 border-dashed p-3 transition-all duration-200"
        style={{
          borderColor: isOver ? color : "rgba(231, 229, 228, 0.9)",
          background: isOver ? columnBgOver : columnBg,
          boxShadow: isOver ? `0 0 0 3px ${ring}` : undefined,
        }}
      >
        {apps.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 py-12 text-center">
            <div
              className="h-10 w-10 rounded-full opacity-40"
              style={{
                background: `radial-gradient(circle at 30% 30%, ${color}, transparent 70%)`,
              }}
              aria-hidden
            />
            <p className="text-[13px] font-medium text-stone-400">
              Aucune candidature
            </p>
          </div>
        ) : (
          apps.map((app) => (
            <DraggableCard
              key={app.id}
              app={app}
              onPreview={() => onPreview(app)}
            />
          ))
        )}
      </div>
    </div>
  );
}

export interface KanbanBoardEditorialProps {
  applications: Application[];
  onStatusChange: (
    applicationId: string,
    newStatus: ApplicationStatus
  ) => void;
}

export function KanbanBoardEditorial({
  applications,
  onStatusChange,
}: KanbanBoardEditorialProps) {
  const [activeApp, setActiveApp] = useState<Application | null>(null);
  const [previewApp, setPreviewApp] = useState<Application | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const getColumnApps = useCallback(
    (columnId: ApplicationStatus) =>
      applications.filter((a) => a.status === columnId),
    [applications]
  );

  function handleDragStart(event: DragStartEvent) {
    const app = applications.find((a) => a.id === event.active.id);
    if (app) setActiveApp(app);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveApp(null);
    if (!over || active.id === over.id) return;

    const newStatus = over.id as ApplicationStatus;
    const allowed = KANBAN_PIPELINE_COLUMNS.some((c) => c.id === newStatus);
    if (!allowed) return;

    const appId = active.id as string;
    const currentApp = applications.find((a) => a.id === appId);
    if (!currentApp || currentApp.status === newStatus) return;

    onStatusChange(appId, newStatus);
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-5">
          {KANBAN_PIPELINE_COLUMNS.map((col) => (
            <Column
              key={col.id}
              id={col.id}
              label={col.label}
              color={col.color}
              ring={col.ring}
              columnBg={col.columnBg}
              columnBgOver={col.columnBgOver}
              apps={getColumnApps(col.id)}
              onPreview={setPreviewApp}
            />
          ))}
        </div>
        <DragOverlay>
          {activeApp ? (
            <div className="rotate-[2deg] cursor-grabbing opacity-[0.97] drop-shadow-[0_12px_28px_rgba(254,106,46,0.25)]">
              <ApplicationCard app={activeApp} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {previewApp ? (
        <PreviewDrawer
          app={previewApp}
          onClose={() => setPreviewApp(null)}
        />
      ) : null}
    </>
  );
}
