/**
 * Base URL de l’API FastAPI.
 * Vide = requêtes relatives `/api/...` (routes Next puis fallback proxy vers FastAPI ; voir next.config).
 */
function getApiBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_BACKEND_URL?.trim();
  if (!raw) return "";
  return raw.replace(/\/$/, "");
}

const API_BASE = getApiBaseUrl();

/** Routes implémentées par Next uniquement — toujours en URL relative (même si NEXT_PUBLIC_BACKEND_URL est défini). */
function isNextOnlyApiPath(path: string): boolean {
  return (
    path.startsWith("/api/n8n/") ||
    path.startsWith("/api/oauth/") ||
    path.startsWith("/api/emails/") ||
    path.startsWith("/api/entreprises/") ||
    path.startsWith("/api/applications/update-status") ||
    path.startsWith("/api/cv/upload") ||
    path.startsWith("/api/cv/generate-from-form") ||
    path.startsWith("/api/relance/") ||
    path.startsWith("/api/alternance/") ||
    path.startsWith("/api/profiles/") ||
    path.startsWith("/api/stripe/")
  );
}

function resolveApiUrl(path: string): string {
  if (isNextOnlyApiPath(path)) {
    return path;
  }
  /* Navigateur : toujours URL relative → même origine (Next). Évite le court-circuit
   * vers FastAPI via NEXT_PUBLIC_BACKEND_URL qui, avec le rewrite / redirections,
   * peut provoquer l’absence d’`Authorization` côté uvicorn (ex. Kanban). */
  if (typeof window !== "undefined") {
    return path;
  }
  return `${API_BASE}${path}`;
}

/** Erreurs réseau (Safari : « Load failed », Chrome : « Failed to fetch »). */
function toNetworkError(cause: unknown): Error {
  const msg = cause instanceof Error ? cause.message : String(cause);
  if (
    msg.includes("Failed to fetch") ||
    msg === "Load failed" ||
    msg.includes("NetworkError") ||
    msg.includes("Network request failed")
  ) {
    return new Error(
      "Impossible de joindre l’API. Lance le backend (ex. uvicorn sur le port 8000) " +
        "et laisse NEXT_PUBLIC_BACKEND_URL vide pour utiliser le proxy /api."
    );
  }
  return cause instanceof Error ? cause : new Error(msg);
}

async function parseErrorResponse(response: Response): Promise<string> {
  const status = response.status;
  const ct = response.headers.get("content-type") || "";
  /* Une seule lecture du corps (json() puis text() cassait l’affichage du détail). */
  const raw = await response.text().catch(() => "");

  /* Proxy Next ou FastAPI : parfois `detail` en JSON sans Content-Type fiable. */
  if (raw.trim().startsWith("{")) {
    try {
      const body = JSON.parse(raw) as Record<string, unknown>;
      const errStr = typeof body.error === "string" ? body.error : "";
      const detStr = typeof body.detail === "string" ? body.detail : "";
      if (errStr && detStr) {
        const d = detStr.trim();
        /* Évite d’afficher un gros JSON technique si `error` est déjà un message lisible. */
        if (d.startsWith("{") || d.length > 280) {
          return errStr;
        }
        return `${errStr} — ${detStr}`;
      }
      if (typeof body.detail === "string") {
        return body.detail;
      }
      if (typeof body.error === "string") {
        return body.error;
      }
    } catch {
      /* continuer */
    }
  }

  if (ct.includes("application/json") && raw.trim()) {
    try {
      const body = JSON.parse(raw) as Record<string, unknown>;
      const errStr = typeof body.error === "string" ? body.error : "";
      const detStr = typeof body.detail === "string" ? body.detail : "";
      if (errStr && detStr) {
        const d = detStr.trim();
        if (d.startsWith("{") || d.length > 280) {
          return errStr;
        }
        return `${errStr} — ${detStr}`;
      }
      if (typeof body.detail === "string") {
        const d = body.detail;
        if (status === 500 && /^internal server error$/i.test(d.trim())) {
          return (
            "Erreur serveur (500). Vérifie backend/.env (SUPABASE_*) et le terminal uvicorn " +
            "(trace Python au moment du clic)."
          );
        }
        return d;
      }
      if (Array.isArray(body.detail)) {
        return body.detail.map((x: { msg?: string }) => x.msg || JSON.stringify(x)).join(" ; ");
      }
      if (typeof body.error === "string") {
        return body.error;
      }
    } catch {
      /* JSON invalide → utiliser raw plus bas */
    }
  }

  if (status === 500) {
    if (/internal server error/i.test(raw)) {
      return (
        "Erreur serveur (500). Vérifie SUPABASE_* dans backend/.env ; regarde le terminal uvicorn " +
        "(trace au moment du clic)."
      );
    }
    if (raw.length > 0 && raw.length < 800 && !raw.trim().startsWith("<")) {
      return raw;
    }
    return (
      "Erreur serveur (500). L’API répond : regarde le terminal uvicorn pour la trace Python " +
      "(souvent Supabase ou schéma BDD)."
    );
  }
  if (status === 502 || status === 503 || status === 504) {
    return (
      "L’API FastAPI ne répond pas (port 8000). Lance : cd backend && bash run-dev.sh " +
      "puis recharge la page."
    );
  }
  if (raw.length > 0 && raw.length < 400 && !raw.trim().startsWith("<")) {
    return raw;
  }
  return `Erreur HTTP ${status}. Si besoin, consulte les logs uvicorn (backend).`;
}

async function apiFetch(
  path: string,
  init?: RequestInit
): Promise<Response> {
  const url = resolveApiUrl(path);
  try {
    return await fetch(url, init);
  } catch (e) {
    throw toNetworkError(e);
  }
}

interface ApiOptions {
  method?: string;
  body?: unknown;
  token?: string;
  headers?: Record<string, string>;
}

export async function api<T = unknown>(
  path: string,
  options: ApiOptions = {}
): Promise<T> {
  const { method = "GET", body, token, headers: extraHeaders } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...extraHeaders,
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await apiFetch(path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const detail = await parseErrorResponse(response);
    throw new Error(detail);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

export async function apiUpload<T = unknown>(
  path: string,
  formData: FormData,
  token: string
): Promise<T> {
  const response = await apiFetch(path, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const detail = await parseErrorResponse(response);
    throw new Error(detail);
  }

  return response.json();
}
