"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface CompanyLogoProps {
  name:     string;
  website?: string;
  size?:    "sm" | "md" | "lg";
  className?: string;
}

const SIZE = {
  sm: { outer: "h-8 w-8 rounded-lg",  text: "text-[11px]" },
  md: { outer: "h-11 w-11 rounded-xl", text: "text-[14px]" },
  lg: { outer: "h-14 w-14 rounded-2xl",text: "text-[18px]" },
};

function extractDomain(website: string): string {
  try {
    const url = new URL(website.startsWith("http") ? website : `https://${website}`);
    return url.hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function initials(name: string): string {
  const parts = name.trim().split(/[\s\-_]+/).filter(Boolean);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
}

// Couleur déterministe par nom (évite les flashs à chaque re-render)
const COLORS = [
  "bg-orange-100 text-orange-600",
  "bg-blue-100 text-blue-600",
  "bg-emerald-100 text-emerald-600",
  "bg-violet-100 text-violet-600",
  "bg-rose-100 text-rose-600",
  "bg-amber-100 text-amber-600",
  "bg-teal-100 text-teal-600",
];
function colorFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return COLORS[hash % COLORS.length]!;
}

export function CompanyLogo({ name, website, size = "md", className }: CompanyLogoProps) {
  const cfg     = SIZE[size];
  const domain  = website ? extractDomain(website) : "";
  const logoUrl = domain ? `https://logo.clearbit.com/${domain}` : "";
  const [failed, setFailed] = useState(false);

  const showLogo = !!logoUrl && !failed;

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden",
        cfg.outer,
        !showLogo && colorFor(name),
        className
      )}
    >
      {showLogo ? (
        <img
          src={logoUrl}
          alt={name}
          className="h-full w-full object-contain p-1"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className={cn("font-bold leading-none", cfg.text)}>
          {initials(name)}
        </span>
      )}
    </div>
  );
}
