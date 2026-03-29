"use client";

import Link from "next/link";
import { FileText, Loader2, Upload } from "lucide-react";
import type { Profile } from "@/lib/types";

type DashboardCvCardProps = {
  profile: Profile | null;
  uploading: boolean;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
};

/**
 * Carte « Mon CV » : score ATS si présent, sinon zone de dépôt dashed.
 */
export function DashboardCvCard({ profile, uploading, onFileChange }: DashboardCvCardProps) {
  return (
    <div
      id="cv"
      className="rounded-xl border border-stone-200 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)]"
    >
      <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4">
        <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-stone-800">Mon CV</h2>
        <Link href="/cv" className="text-xs font-medium text-[#F97316] transition-opacity hover:opacity-80">
          Page dédiée →
        </Link>
      </div>
      <div className="p-5">
        {profile?.cv_url ? (
          <div className="space-y-4">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-stone-500">Score ATS</p>
                <p
                  className="text-4xl font-bold tabular-nums tracking-tight text-[#1C1917]"
                  style={{
                    color:
                      (profile.cv_score ?? 0) >= 70
                        ? "#16A34A"
                        : (profile.cv_score ?? 0) >= 40
                          ? "#D97706"
                          : "#DC2626",
                  }}
                >
                  {profile.cv_score}
                  <span className="text-xl font-normal text-stone-300">/100</span>
                </p>
              </div>
              <span className="text-xs text-stone-500">
                {(profile.cv_score ?? 0) >= 70
                  ? "Excellent"
                  : (profile.cv_score ?? 0) >= 40
                    ? "Correct"
                    : "À améliorer"}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-stone-100">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${profile.cv_score ?? 0}%`,
                  background:
                    (profile.cv_score ?? 0) >= 70
                      ? "#16A34A"
                      : (profile.cv_score ?? 0) >= 40
                        ? "#D97706"
                        : "#DC2626",
                }}
              />
            </div>
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-stone-200 py-2.5 text-xs font-medium text-stone-600 transition-colors hover:border-orange-300 hover:bg-orange-50/50">
              <Upload className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
              Remplacer le CV
              <input type="file" className="hidden" accept=".pdf,.docx" onChange={onFileChange} />
            </label>
          </div>
        ) : (
          <label className="block cursor-pointer">
            <div
              className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-stone-300 bg-stone-50 px-6 py-10 text-center transition-colors duration-150 hover:border-[#F97316] hover:bg-orange-50/60"
            >
              {uploading ? (
                <Loader2 className="h-8 w-8 animate-spin text-stone-400" aria-hidden />
              ) : (
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-stone-200">
                  <FileText className="h-6 w-6 text-stone-500" strokeWidth={1.75} aria-hidden />
                </span>
              )}
              <p className="text-sm font-semibold text-stone-800">
                {uploading ? "Analyse en cours…" : "Glisse ton CV ici ou clique pour parcourir"}
              </p>
              <p className="text-xs text-stone-500">PDF, DOCX · max 5 Mo</p>
            </div>
            <input
              type="file"
              className="hidden"
              accept=".pdf,.docx"
              onChange={onFileChange}
              disabled={uploading}
            />
          </label>
        )}
      </div>
    </div>
  );
}
