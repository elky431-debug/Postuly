"use client";

import { useCallback, useState } from "react";
import { ImagePlus, User } from "lucide-react";
import { cn } from "@/lib/utils";

const MAX_DIM = 640;
const JPEG_QUALITY = 0.85;
const MAX_FILE_BYTES = 12 * 1024 * 1024;

/** Réduit et encode en JPEG data URL pour un poids raisonnable dans le state / HTML. */
function fileToResizedDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const objUrl = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      URL.revokeObjectURL(objUrl);
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const scale = Math.min(1, MAX_DIM / Math.max(w, h));
      const tw = Math.round(w * scale);
      const th = Math.round(h * scale);
      const canvas = document.createElement("canvas");
      canvas.width = tw;
      canvas.height = th;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Impossible de traiter l’image."));
        return;
      }
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, tw, th);
      ctx.drawImage(img, 0, 0, tw, th);
      resolve(canvas.toDataURL("image/jpeg", JPEG_QUALITY));
    };
    img.onerror = () => {
      URL.revokeObjectURL(objUrl);
      reject(new Error("Fichier image illisible."));
    };
    img.src = objUrl;
  });
}

type Props = {
  photoBase64: string | null;
  onPhotoChange: (dataUrl: string | null) => void;
  onPhotoError?: (message: string) => void;
  onPhotoSuccess?: () => void;
  /** Récap ou écran résultat : mise en page plus serrée */
  variant?: "default" | "compact";
  className?: string;
};

export function CvPhotoField({
  photoBase64,
  onPhotoChange,
  onPhotoError,
  onPhotoSuccess,
  variant = "default",
  className,
}: Props) {
  const [dragOver, setDragOver] = useState(false);

  const processFile = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        onPhotoError?.("Choisis un fichier image (JPG, PNG, WebP…).");
        return;
      }
      if (file.size > MAX_FILE_BYTES) {
        onPhotoError?.("Image trop lourde (max. 12 Mo).");
        return;
      }
      try {
        const dataUrl = await fileToResizedDataUrl(file);
        onPhotoChange(dataUrl);
        onPhotoSuccess?.();
      } catch (e) {
        onPhotoError?.(e instanceof Error ? e.message : "Erreur lors du traitement de l’image.");
      }
    },
    [onPhotoChange, onPhotoError, onPhotoSuccess]
  );

  const previewSize = variant === "compact" ? "h-20 w-20" : "h-24 w-24";
  const iconSize = variant === "compact" ? "h-8 w-8" : "h-10 w-10";

  return (
    <div className={cn("space-y-2", className)}>
      <span className="text-sm font-medium text-stone-700">Photo (optionnel)</span>
      <div
        className={cn(
          "flex flex-wrap items-end gap-4 rounded-xl border-2 border-dashed p-3 transition-colors",
          dragOver ? "border-orange-400 bg-orange-50/50" : "border-stone-200 bg-stone-50/30"
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files?.[0];
          void processFile(file);
        }}
      >
        {photoBase64 ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoBase64}
            alt=""
            className={cn(
              "shrink-0 rounded-xl object-cover ring-1 ring-stone-200",
              previewSize
            )}
          />
        ) : (
          <div
            className={cn(
              "flex shrink-0 items-center justify-center rounded-xl bg-stone-100 text-stone-400",
              previewSize
            )}
          >
            <User className={iconSize} aria-hidden />
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 shadow-sm hover:bg-stone-50">
            <ImagePlus className="h-4 w-4 shrink-0 text-orange-500" aria-hidden />
            Choisir une image
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                void processFile(f);
              }}
            />
          </label>
          {photoBase64 ? (
            <button
              type="button"
              onClick={() => {
                onPhotoChange(null);
                onPhotoSuccess?.();
              }}
              className="text-left text-sm text-red-600 hover:underline sm:text-center"
            >
              Retirer la photo
            </button>
          ) : (
            <p className="text-xs text-stone-500">
              Glisse-dépose une image ici ou clique pour parcourir. Elle apparaîtra sur ton CV.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
