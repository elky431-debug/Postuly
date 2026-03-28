"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Building2, Mail, ExternalLink } from "lucide-react";
import Link from "next/link";
import type { Application } from "@/lib/types";

interface KanbanCardProps {
  application: Application;
}

export function KanbanCard({ application }: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: application.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing"
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <Building2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <p className="font-medium text-sm text-gray-900 truncate">
            {application.company?.name || "Entreprise"}
          </p>
        </div>
        <Link
          href={`/applications/${application.id}`}
          onClick={(e) => e.stopPropagation()}
          className="text-gray-400 hover:text-indigo-600 flex-shrink-0"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </Link>
      </div>

      {application.company?.city && (
        <p className="text-xs text-gray-500 mb-1.5">
          {application.company.city}
        </p>
      )}

      {application.contact?.email && (
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <Mail className="w-3 h-3" />
          <span className="truncate">{application.contact.email}</span>
        </div>
      )}

      {application.sent_at && (
        <p className="text-xs text-gray-400 mt-2">
          Envoyé le{" "}
          {new Date(application.sent_at).toLocaleDateString("fr-FR")}
        </p>
      )}
    </div>
  );
}
