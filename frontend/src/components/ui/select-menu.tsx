"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

const ORANGE = "#FE6A2E";
const ORANGE_GOLD = "#FFB347";

export type SelectMenuOption = {
  value: string;
  label: string;
};

type SelectMenuProps = {
  id?: string;
  /** Libellé affiché au-dessus du champ */
  label: string;
  options: SelectMenuOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** Aligné sur les champs du bloc « Poste recherché » principal (mt-1.5). */
  dense?: boolean;
};

/**
 * Liste déroulante stylée Postuly (remplace le &lt;select&gt; natif).
 * La liste est rendue en portail (`position: fixed`) pour ne pas être coupée par
 * `overflow-auto` du layout dashboard.
 */
export function SelectMenu({
  id: idProp,
  label,
  options,
  value,
  onChange,
  placeholder = "Choisir…",
  disabled = false,
  className,
  dense = false,
}: SelectMenuProps) {
  const autoId = useId();
  const listId = `${autoId}-list`;
  const btnId = idProp ?? `${autoId}-btn`;
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });

  const selected = options.find((o) => o.value === value);
  const display = selected?.label ?? placeholder;

  const close = useCallback(() => setOpen(false), []);

  const updatePosition = useCallback(() => {
    if (!rootRef.current) return;
    const r = rootRef.current.getBoundingClientRect();
    setCoords({ top: r.bottom + 6, left: r.left, width: r.width });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || listRef.current?.contains(t)) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  const listContent =
    open &&
    typeof document !== "undefined" &&
    createPortal(
      <ul
        ref={listRef}
        id={listId}
        role="listbox"
        aria-label={label}
        className="max-h-60 overflow-auto rounded-xl border border-orange-100/70 bg-white py-1.5 shadow-xl ring-1 ring-orange-500/[0.06]"
        style={{
          position: "fixed",
          top: coords.top,
          left: coords.left,
          width: Math.max(coords.width, 160),
          zIndex: 9999,
          boxShadow:
            "0 18px 50px -16px rgba(15, 23, 42, 0.12), 0 8px 24px -12px rgba(254, 106, 46, 0.15)",
        }}
      >
        {options.map((opt) => {
          const isSelected = opt.value === value;
          return (
            <li key={opt.value === "" ? "__empty" : opt.value} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={isSelected}
                className={cn(
                  "flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-sm transition-colors",
                  isSelected
                    ? "bg-gradient-to-r from-[#FFF1E3] to-white font-medium text-gray-900"
                    : "text-gray-700 hover:bg-orange-50/60 hover:text-gray-900"
                )}
                onClick={() => {
                  onChange(opt.value);
                  close();
                }}
              >
                {isSelected ? (
                  <span
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                    style={{
                      background: `linear-gradient(135deg, ${ORANGE}, ${ORANGE_GOLD})`,
                    }}
                    aria-hidden
                  >
                    ✓
                  </span>
                ) : (
                  <span className="w-5 shrink-0" aria-hidden />
                )}
                <span className="truncate">{opt.label}</span>
              </button>
            </li>
          );
        })}
      </ul>,
      document.body
    );

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        id={btnId}
        type="button"
        disabled={disabled}
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-left text-sm text-gray-900 shadow-sm transition-shadow",
          dense ? "mt-1.5" : "mt-2",
          "focus:outline-none focus:ring-2 focus:ring-[#FE6A2E]/20 focus:border-orange-200/80",
          "disabled:cursor-not-allowed disabled:opacity-50",
          open && "ring-2 ring-[#FE6A2E]/20 border-orange-200/80"
        )}
      >
        <span className={cn("truncate", !selected && "text-gray-400")}>{display}</span>
        <span
          className={cn(
            "shrink-0 text-gray-400 transition-transform duration-200",
            open && "rotate-180"
          )}
          aria-hidden
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>

      {listContent}
    </div>
  );
}
