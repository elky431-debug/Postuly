/**
 * Base URL de l’API FastAPI.
 * Vide = requêtes relatives `/api/...` (proxy Next → backend, recommandé en local pour Safari / CORS).
 */
function getApiBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_BACKEND_URL?.trim();
  if (!raw) return "";
  return raw.replace(/\/$/, "");
}

const API_BASE = getApiBaseUrl();

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

  if (ct.includes("application/json")) {
    const body = await response.json().catch(() => null);
    if (body && typeof body.detail === "string") {
      const d = body.detail as string;
      if (/^internal server error$/i.test(d.trim())) {
        return (
          "Erreur serveur (500). Lance l’API (backend/run-dev.sh), vérifie backend/.env, " +
          "consulte le terminal uvicorn."
        );
      }
      return d;
    }
    if (body && Array.isArray(body.detail)) {
      return body.detail.map((x: { msg?: string }) => x.msg || JSON.stringify(x)).join(" ; ");
    }
  }

  const text = await response.text().catch(() => "");
  /* Réponses génériques (Next/FastAPI) → message actionnable */
  if (status === 500) {
    if (/internal server error/i.test(text)) {
      return (
        "Erreur serveur (500). Lance l’API : cd backend && bash run-dev.sh ; " +
        "vérifie SUPABASE_* dans backend/.env ; regarde les logs uvicorn."
      );
    }
  }
  /* Next proxy quand FastAPI est arrêté renvoie souvent du HTML ou 502 sans JSON. */
  if (status === 502 || status === 503 || status === 504) {
    return (
      "L’API FastAPI ne répond pas (port 8000). Lance : cd backend && bash run-dev.sh " +
      "puis recharge la page."
    );
  }
  if (text.length > 0 && text.length < 400 && !text.trim().startsWith("<")) {
    return text;
  }
  return `Erreur HTTP ${status} — vérifie que uvicorn tourne sur le port 8000.`;
}

async function apiFetch(
  path: string,
  init?: RequestInit
): Promise<Response> {
  const url = `${API_BASE}${path}`;
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
