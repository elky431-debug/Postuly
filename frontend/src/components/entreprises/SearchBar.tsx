"use client";

import { Search, MapPin, Briefcase } from "lucide-react";
import * as Slider from "@radix-ui/react-slider";
import { cn } from "@/lib/utils";

type SearchBarProps = {
  secteur: string;
  ville: string;
  rayonKm: number;
  loading: boolean;
  onSecteurChange: (v: string) => void;
  onVilleChange: (v: string) => void;
  onRayonChange: (v: number) => void;
  onSearch: () => void;
};

/** Barre principale : secteur, ville, rayon (slider), bouton rechercher. */
export function SearchBar({
  secteur,
  ville,
  rayonKm,
  loading,
  onSecteurChange,
  onVilleChange,
  onRayonChange,
  onSearch,
}: SearchBarProps) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 lg:grid-cols-[1fr_1fr_minmax(200px,240px)_auto] lg:items-end">
        <label className="block">
          <span className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-[#525252]">
            <Briefcase className="h-3.5 w-3.5 text-[#F97316]" aria-hidden />
            Secteur / poste
          </span>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#525252]"
              aria-hidden
            />
            <input
              type="text"
              value={secteur}
              onChange={(e) => onSecteurChange(e.target.value)}
              placeholder="ex. développeur web"
              className="w-full rounded-xl border border-[#2A2A2A] bg-[#141414] py-2.5 pl-10 pr-3 text-sm text-[#F5F5F5] placeholder:text-[#525252] focus:border-[#F97316] focus:outline-none focus:ring-2 focus:ring-[#F97316]/25"
            />
          </div>
        </label>
        <label className="block">
          <span className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-[#525252]">
            <MapPin className="h-3.5 w-3.5 text-[#F97316]" aria-hidden />
            Adresse, ville ou CP
          </span>
          <div className="relative">
            <MapPin
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#525252]"
              aria-hidden
            />
            <input
              type="text"
              value={ville}
              onChange={(e) => onVilleChange(e.target.value)}
              placeholder="ex. 12 rue de la Paix, Paris"
              className="w-full rounded-xl border border-[#2A2A2A] bg-[#141414] py-2.5 pl-10 pr-3 text-sm text-[#F5F5F5] placeholder:text-[#525252] focus:border-[#F97316] focus:outline-none focus:ring-2 focus:ring-[#F97316]/25"
            />
          </div>
        </label>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-medium uppercase tracking-wide text-[#525252]">
            <span>Rayon</span>
            <span className="tabular-nums text-[#F97316]">+{rayonKm} km</span>
          </div>
          <Slider.Root
            className="relative flex h-5 w-full touch-none select-none items-center"
            value={[rayonKm]}
            onValueChange={(v) => onRayonChange(v[0] ?? 35)}
            min={5}
            max={100}
            step={5}
            aria-label="Rayon de recherche en kilomètres"
          >
            <Slider.Track className="relative h-1.5 grow rounded-full bg-[#2A2A2A]">
              <Slider.Range className="absolute h-full rounded-full bg-[#F97316]" />
            </Slider.Track>
            <Slider.Thumb
              className={cn(
                "block h-4 w-4 rounded-full border-2 border-[#F97316] bg-[#0F0F0F]",
                "shadow-[0_0_12px_rgba(249,115,22,0.35)] focus:outline-none focus:ring-2 focus:ring-[#F97316]/40"
              )}
            />
          </Slider.Root>
          <p className="text-[10px] text-[#525252]">
            Périmètre calculé depuis l’adresse saisie.
          </p>
        </div>
        <div className="flex lg:justify-end">
          <button
            type="button"
            disabled={loading}
            onClick={onSearch}
            className="w-full rounded-xl bg-[#F97316] px-6 py-2.5 text-sm font-semibold text-white shadow-[0_0_20px_rgba(249,115,22,0.2)] transition hover:bg-[#EA6C0A] disabled:opacity-50 lg:w-auto"
          >
            {loading ? "Recherche…" : "Rechercher"}
          </button>
        </div>
      </div>
    </div>
  );
}
