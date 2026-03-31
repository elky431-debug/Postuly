"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import type { EmailContact } from "@/app/api/entreprises/email/route";
import { cn } from "@/lib/utils";

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

function initials(contact: EmailContact): string {
  const n = [contact.firstName, contact.lastName].filter(Boolean).join(" ").trim();
  if (!n) return contact.email.slice(0, 2).toUpperCase();
  const parts = n.split(/\s+/);
  const a = parts[0]?.[0] ?? "";
  const b = parts[1]?.[0] ?? "";
  return (a + b).toUpperCase() || a.toUpperCase();
}

function displayName(contact: EmailContact): string {
  const n = [contact.firstName, contact.lastName].filter(Boolean).join(" ").trim();
  return n || contact.email.split("@")[0];
}

function deptLabel(contact: EmailContact): string {
  if (!contact.department) return "—";
  return DEPT_LABELS[contact.department] ?? contact.department;
}

function CopyEmailButton({ email }: { email: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <span
      role="button"
      tabIndex={0}
      onClick={(ev) => {
        ev.stopPropagation();
        void navigator.clipboard.writeText(email).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
      }}
      onKeyDown={(ev) => {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          ev.stopPropagation();
          void navigator.clipboard.writeText(email).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          });
        }
      }}
      className="inline-flex shrink-0 cursor-pointer rounded p-0.5 text-stone-400 hover:bg-stone-200/80 hover:text-stone-600"
      title="Copier l’email"
    >
      {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
    </span>
  );
}

/**
 * Ligne contact avec case à cocher (page Ma sélection).
 */
export function SelectionContactRow({
  contact,
  selected,
  onToggle,
}: {
  contact: EmailContact;
  selected: boolean;
  onToggle: () => void;
}) {
  const conf = contact.confidence ?? 0;
  const confidenceColor =
    conf >= 95 ? "text-green-600" : conf >= 85 ? "text-amber-600" : "text-red-600";

  return (
    <div
      role="checkbox"
      aria-checked={selected}
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggle();
        }
      }}
      className={cn(
        "flex w-full min-w-0 cursor-pointer items-center gap-3 rounded-lg border px-3.5 py-2.5 text-left transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2",
        selected
          ? "border-blue-500 bg-blue-50"
          : "border-stone-200 bg-stone-50 hover:border-stone-300"
      )}
    >
      <span
        className={cn(
          "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded border-[1.5px]",
          selected ? "border-blue-500 bg-blue-500" : "border-stone-300 bg-white"
        )}
        aria-hidden
      >
        {selected && (
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none" aria-hidden>
            <path
              d="M1 4L3.5 6.5L9 1"
              stroke="white"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>

      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-medium text-blue-600"
        aria-hidden
      >
        {initials(contact)}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[13px] font-medium text-stone-900">{displayName(contact)}</span>
          <span className="rounded-full bg-stone-100 px-1.5 py-px text-[11px] text-stone-500">
            {deptLabel(contact)}
          </span>
        </div>
        {contact.position && (
          <p className="mt-0.5 text-xs text-stone-500">{contact.position}</p>
        )}
        <div className="mt-0.5 flex items-center gap-1">
          <p className="min-w-0 truncate text-xs text-blue-600">{contact.email}</p>
          <CopyEmailButton email={contact.email} />
        </div>
      </div>

      <span className={cn("shrink-0 text-xs font-medium tabular-nums", confidenceColor)}>
        {conf}% confiance
      </span>
    </div>
  );
}
