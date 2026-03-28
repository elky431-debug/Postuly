"use client";

import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { KanbanCard } from "./kanban-card";
import { cn } from "@/lib/utils";
import type { Application } from "@/lib/types";

interface KanbanColumnProps {
  id: string;
  label: string;
  color: string;
  applications: Application[];
}

export function KanbanColumn({
  id,
  label,
  color,
  applications,
}: KanbanColumnProps) {
  const { isOver, setNodeRef } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col min-w-[280px] w-[280px] bg-gray-50 rounded-xl border-t-4 transition-colors",
        color,
        isOver && "bg-indigo-50/50"
      )}
    >
      <div className="px-4 py-3 flex items-center justify-between">
        <h3 className="font-semibold text-sm text-gray-700">{label}</h3>
        <span className="bg-white text-gray-600 text-xs font-medium px-2 py-0.5 rounded-full border border-gray-200">
          {applications.length}
        </span>
      </div>

      <div className="flex-1 px-3 pb-3 space-y-2 overflow-y-auto max-h-[calc(100vh-220px)]">
        <SortableContext
          items={applications.map((a) => a.id)}
          strategy={verticalListSortingStrategy}
        >
          {applications.map((app) => (
            <KanbanCard key={app.id} application={app} />
          ))}
        </SortableContext>

        {applications.length === 0 && (
          <div className="text-center py-8">
            <p className="text-xs text-gray-400">Aucune candidature</p>
          </div>
        )}
      </div>
    </div>
  );
}
