import type { SupabaseClient } from "@supabase/supabase-js";

/** Extrait le chemin objet « userId/fichier.ext » depuis une URL publique Supabase du bucket cvs. */
export function cheminStorageDepuisCvUrl(cvUrl: string): string | null {
  const marker = "/cvs/";
  const i = cvUrl.indexOf(marker);
  if (i === -1) return null;
  let path = cvUrl.slice(i + marker.length).split("?")[0].split("#")[0].trim();
  try {
    path = decodeURIComponent(path);
  } catch {
    /* garde path brut */
  }
  return path || null;
}

function nomFichierDepuisUrl(cvUrl: string): string {
  try {
    const last = new URL(cvUrl).pathname.split("/").pop();
    if (last) return decodeURIComponent(last);
  } catch {
    /* ignore */
  }
  return "cv.pdf";
}

function mimeDepuisNom(nom: string): string {
  const lower = nom.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  return "application/octet-stream";
}

export type CvPieceJointe = { filename: string; content: Buffer; mimeType: string };

/**
 * Récupère les octets du CV pour pièce jointe mail : HTTP sur cv_url puis repli Storage admin.
 */
export async function chargerCvPourPieceJointe(
  admin: SupabaseClient,
  cvUrl: string
): Promise<CvPieceJointe | null> {
  const url = cvUrl.trim();
  if (!url) return null;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(60_000), redirect: "follow" });
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length === 0) return null;
      const headerMime = res.headers.get("content-type")?.split(";")[0]?.trim();
      const filename = nomFichierDepuisUrl(url);
      const mimeType =
        headerMime && headerMime !== "application/octet-stream"
          ? headerMime
          : mimeDepuisNom(filename);
      return { filename, content: buf, mimeType };
    }
  } catch {
    /* repli storage */
  }

  const storagePath = cheminStorageDepuisCvUrl(url);
  if (!storagePath) return null;

  const { data, error } = await admin.storage.from("cvs").download(storagePath);
  if (error || !data) return null;

  const buf = Buffer.from(await data.arrayBuffer());
  if (buf.length === 0) return null;

  const filename = storagePath.split("/").pop() ?? "cv.pdf";
  return {
    filename,
    content: buf,
    mimeType: mimeDepuisNom(filename),
  };
}
