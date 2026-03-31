"use client";

import { cn } from "@/lib/utils";

/** Orange du rond document (identité logo) */
const LOGO_ORANGE = "#E67E22";
/** Texte wordmark */
const LOGO_INK = "#1D1D1B";

const sizeMap = {
  sm: { text: "text-[16px]", icon: "h-[22px] w-[22px]", gap: "gap-0.5" },
  md: { text: "text-[18px]", icon: "h-7 w-7", gap: "gap-1" },
  lg: { text: "text-3xl sm:text-4xl", icon: "h-11 w-11 sm:h-12 sm:w-12", gap: "gap-1.5" },
} as const;

export type PostulyLogoSize = keyof typeof sizeMap;

/**
 * Icône ronde : document blanc + coin plié crème (le « o » de postuly).
 */
export function PostulyMarkIcon({
  className,
  title,
}: {
  className?: string;
  /** Accessibilité si l’icône est utilisée seule */
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("shrink-0", className)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role={title ? "img" : "presentation"}
      aria-hidden={title ? undefined : true}
    >
      {title ? <title>{title}</title> : null}
      <circle cx="16" cy="16" r="15.5" fill={LOGO_ORANGE} />
      <rect x="8" y="7" width="14" height="18" rx="2" fill="white" />
      {/* Coin plié haut-droite (crème) */}
      <path d="M20 7 L22 9 L20 9 Z" fill="#EAD8C8" />
      {/* Lignes de texte sur le document */}
      <rect x="10.5" y="11" width="9" height="1.25" rx="0.4" fill="#D1D1D1" />
      <rect x="10.5" y="14" width="9" height="1.25" rx="0.4" fill="#D1D1D1" />
      <rect x="10.5" y="17" width="9" height="1.25" rx="0.4" fill="#D1D1D1" />
      <rect x="10.5" y="20" width="9" height="1.25" rx="0.4" fill="#D1D1D1" />
      <rect x="10.5" y="23" width="4.5" height="1.25" rx="0.4" fill="#D1D1D1" />
    </svg>
  );
}

type PostulyWordmarkProps = {
  size?: PostulyLogoSize;
  className?: string;
  /** Affiche le badge Bêta sous le mot (sidebar dashboard) */
  showBeta?: boolean;
};

/**
 * Wordmark officiel : p + icône document + stuly (minuscules).
 */
export function PostulyWordmark({ size = "md", className, showBeta }: PostulyWordmarkProps) {
  const s = sizeMap[size];
  return (
    <span className={cn("inline-flex flex-col", className)}>
      <span className="sr-only">Postuly</span>
      <span
        className={cn(
          "inline-flex items-center lowercase leading-none",
          s.gap
        )}
        style={{
          fontFamily: "var(--font-dm-sans), var(--font-geist-sans), system-ui, sans-serif",
          color: LOGO_INK,
        }}
      >
        <span className={cn("font-bold", s.text)}>p</span>
        <PostulyMarkIcon className={s.icon} aria-hidden />
        <span className={cn("font-bold", s.text)}>stuly</span>
      </span>
      {showBeta ? (
        <span className="mt-2 inline-flex w-fit items-center rounded-full bg-orange-50 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-orange-700 ring-1 ring-orange-200/60">
          Beta
        </span>
      ) : null}
    </span>
  );
}
