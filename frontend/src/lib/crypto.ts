import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const ALGO = "aes-256-gcm";

/** Dérive une clé 32 octets à partir de ENCRYPTION_KEY (peu importe la longueur du secret). */
function getKey32(): Buffer {
  const raw = process.env.ENCRYPTION_KEY?.trim() ?? "";
  if (!raw) {
    throw new Error("ENCRYPTION_KEY manquant dans .env.local");
  }
  return createHash("sha256").update(raw, "utf8").digest();
}

/** Chiffre un texte pour stockage en base (IV + tag GCM + payload hex). */
export function chiffrer(texte: string): string {
  const key = getKey32();
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGO, key, iv);
  let chiffre = cipher.update(texte, "utf8", "hex");
  chiffre += cipher.final("hex");
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${chiffre}`;
}

/** Déchiffre une valeur produite par chiffrer. */
export function dechiffrer(chiffre: string): string {
  const parts = chiffre.split(":");
  if (parts.length !== 3) {
    throw new Error("Format de données chiffrées invalide");
  }
  const [ivHex, tagHex, contenu] = parts as [string, string, string];
  const key = getKey32();
  const decipher = createDecipheriv(ALGO, key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  let texte = decipher.update(contenu, "hex", "utf8");
  texte += decipher.final("utf8");
  return texte;
}
