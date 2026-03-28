"use client";

import { useState, useCallback } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { KanbanColumn } from "./kanban-column";
import { KanbanCard } from "./kanban-card";
import { KANBAN_COLUMNS } from "@/lib/utils";
import type { Application, ApplicationStatus } from "@/lib/types";

interface KanbanBoardProps {
  applications: Application[];
  onStatusChange: (applicationId: string, newStatus: ApplicationStatus) => void;
}

export function KanbanBoard({ applications, onStatusChange }: KanbanBoardProps) {
  const [activeApp, setActiveApp] = useState<Application | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const getColumnApps = useCallback(
    (columnId: string) =>
      applications.filter((app) => app.status === columnId),
    [applications]
  );

  function handleDragStart(event: DragStartEvent) {
    const app = applications.find((a) => a.id === event.active.id);
    setActiveApp(app || null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveApp(null);
    const { active, over } = event;

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Vérifier si on a déposé sur une colonne
    const targetColumn = KANBAN_COLUMNS.find((col) => col.id === overId);
    if (targetColumn) {
      const app = applications.find((a) => a.id === activeId);
      if (app && app.status !== targetColumn.id) {
        onStatusChange(activeId, targetColumn.id as ApplicationStatus);
      }
      return;
    }

    // Sinon, trouver la colonne de l'élément cible
    const targetApp = applications.find((a) => a.id === overId);
    if (targetApp) {
      const app = applications.find((a) => a.id === activeId);
      if (app && app.status !== targetApp.status) {
        onStatusChange(activeId, targetApp.status);
      }
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        {KANBAN_COLUMNS.map((column) => (
          <KanbanColumn
            key={column.id}
            id={column.id}
            label={column.label}
            color={column.color}
            applications={getColumnApps(column.id)}
          />
        ))}
      </div>

      <DragOverlay>
        {activeApp ? <KanbanCard application={activeApp} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
