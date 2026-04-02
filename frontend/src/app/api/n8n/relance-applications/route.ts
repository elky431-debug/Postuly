import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest, createSupabaseFromBearer } from "@/lib/supabase/server";

type CandidatureRow = {
  id: string;
  cover_letter: string | null;
  company: { name: string } | { name: string }[] | null;
  contact: { email: string } | { email: string }[] | null;
  campaign: { user_id: string } | { user_id: string }[] | null;
};

type MappedCandidature = {
  application_id: string;
  email_destinataire: string;
  objet: string;
  lettre_html: string;
  user_id: string;
  is_relance: true;
};

function premier<T extends object>(x: T | T[] | null | undefined): T | null {
  if (x == null) return null;
  return Array.isArray(x) ? (x[0] ?? null) : x;
}

function nextjsHostnameIsLocal(urlStr: string): boolean {
  try {
    const u = new URL(urlStr);
    const h = u.hostname.toLowerCase();
    return h === "localhost" || h === "127.0.0.1" || h === "::1";
  } catch {
    return false;
  }
}

function useDirectEmailDispatch(): boolean {
  const explicit = process.env.LAUNCH_CAMPAIGN_DIRECT?.trim().toLowerCase();
  if (explicit === "true" || explicit === "1") return true;
  if (explicit === "false" || explicit === "0") return false;

  const n8nUrl = process.env.N8N_WEBHOOK_URL?.trim() ?? "";
  const nextjsUrl = process.env.NEXTJS_URL?.trim() ?? "";
  if (!n8nUrl) return true;
  if (nextjsHostnameIsLocal(nextjsUrl)) return true;
  return false;
}

const PAUSE_ENTRE_MAILS_MS = 2000;

async function envoyerDepuisNextDirect(
  baseUrl: string,
  internalKey: string,
  candidatures: MappedCandidature[]
): Promise<{ ok: true } | { ok: false; message: string }> {
  const origin = baseUrl.replace(/\/$/, "");
  const erreurs: string[] = [];

  for (let i = 0; i < candidatures.length; i++) {
    const c = candidatures[i];
    try {
      const res = await fetch(`${origin}/api/emails/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-key": internalKey,
        },
        body: JSON.stringify({
          to: c.email_destinataire,
          subject: c.objet,
          body: c.lettre_html,
          userId: c.user_id,
          applicationId: c.application_id,
          isRelance: true,
        }),
        signal: AbortSignal.timeout(120_000),
      });
      if (!res.ok) {
        const t = await res.text();
        erreurs.push(`${c.email_destinataire}: ${t.slice(0, 240)}`);
      }
    } catch (e) {
      erreurs.push(
        `${c.email_destinataire}: ${e instanceof Error ? e.message : String(e)}`
      );
    }
    if (i < candidatures.length - 1) {
      await new Promise((r) => setTimeout(r, PAUSE_ENTRE_MAILS_MS));
    }
  }

  if (erreurs.length > 0) {
    return {
      ok: false,
      message: erreurs.join(" | "),
    };
  }
  return { ok: true };
}

/**
 * Envoie des relances (statut « sent » uniquement) via n8n ou envoi direct Next.
 */
export async function POST(req: NextRequest) {
  try {
    return await postRelance(req);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ detail: `relance-applications : ${msg}` }, { status: 500 });
  }
}

async function postRelance(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;
  const user = await getUserFromRequest(token);
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const client = createSupabaseFromBearer(token);
  if (!client) {
    return NextResponse.json({ error: "Configuration Supabase invalide" }, { status: 503 });
  }

  let applicationIds: string[] = [];
  try {
    const b = await req.json();
    if (Array.isArray(b.applicationIds)) {
      applicationIds = b.applicationIds.filter((x: unknown) => typeof x === "string");
    }
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  if (applicationIds.length === 0) {
    return NextResponse.json({ error: "applicationIds requis (tableau non vide)" }, { status: 400 });
  }

  const { data: candidatures, error: appErr } = await client
    .from("applications")
    .select(
      `
      id,
      status,
      cover_letter,
      company:companies ( name ),
      contact:email_contacts ( email ),
      campaign:campaigns ( user_id )
    `
    )
    .in("id", applicationIds)
    .eq("status", "sent");

  if (appErr) {
    return NextResponse.json(
      { detail: `Candidatures (Supabase) : ${appErr.message}` },
      { status: 400 }
    );
  }

  const rows = (candidatures ?? []) as unknown as CandidatureRow[];
  const eligible = rows.filter((c) => {
    const camp = premier(c.campaign);
    return camp?.user_id === user.id;
  });

  if (eligible.length === 0) {
    return NextResponse.json(
      {
        error:
          "Aucune candidature éligible (statut « Envoyé », avec e-mail, appartenant à ton compte).",
      },
      { status: 400 }
    );
  }

  const mapped = eligible
    .map((c) => {
      const contact = premier(c.contact);
      const company = premier(c.company);
      const email = contact?.email?.trim();
      const letter = (c.cover_letter ?? "").trim();
      if (!email || !letter) return null;
      return {
        application_id: c.id,
        email_destinataire: email,
        objet: `Relance — ${company?.name ?? "Entreprise"}`,
        lettre_html: c.cover_letter ?? "",
        user_id: user.id,
        is_relance: true as const,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x != null);

  if (mapped.length === 0) {
    return NextResponse.json(
      { error: "Lettre ou e-mail manquant sur les candidatures sélectionnées." },
      { status: 400 }
    );
  }

  const nextjsUrl = process.env.NEXTJS_URL?.trim() ?? "";
  const internalKey = process.env.INTERNAL_API_KEY?.trim() ?? "";
  const n8nUrl = process.env.N8N_WEBHOOK_URL?.trim() ?? "";

  if (!nextjsUrl || !internalKey) {
    return NextResponse.json(
      {
        error:
          "NEXTJS_URL ou INTERNAL_API_KEY manquant dans .env.local (requis pour l’envoi).",
      },
      { status: 503 }
    );
  }

  const direct = useDirectEmailDispatch();

  if (!direct && !n8nUrl) {
    return NextResponse.json(
      {
        error:
          "N8N_WEBHOOK_URL manquant alors que LAUNCH_CAMPAIGN_DIRECT=false. Ajoute l’URL du webhook ou enlève LAUNCH_CAMPAIGN_DIRECT.",
      },
      { status: 503 }
    );
  }

  if (direct) {
    const envoi = await envoyerDepuisNextDirect(nextjsUrl, internalKey, mapped);
    if (!envoi.ok) {
      return NextResponse.json(
        { error: "Échec envoi Gmail (relance)", detail: envoi.message },
        { status: 502 }
      );
    }
  } else {
    const payload = {
      nextjs_url: nextjsUrl.replace(/\/$/, ""),
      internal_key: internalKey,
      user_id: user.id,
      is_relance: true,
      candidatures: mapped,
    };

    const n8nTimeoutMs = 120_000;
    let n8nRes: Response;
    try {
      n8nRes = await fetch(n8nUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(n8nTimeoutMs),
      });
    } catch (e) {
      const name = e instanceof Error ? e.name : "";
      if (name === "TimeoutError" || name === "AbortError") {
        return NextResponse.json(
          {
            error: "Timeout n8n",
            detail: `Le webhook n8n n'a pas répondu sous ${n8nTimeoutMs / 1000}s.`,
          },
          { status: 504 }
        );
      }
      throw e;
    }

    if (!n8nRes.ok) {
      const t = await n8nRes.text();
      return NextResponse.json(
        { error: "Erreur n8n", detail: t.slice(0, 300) },
        { status: 502 }
      );
    }
  }

  const ids = mapped.map((m) => m.application_id);
  const { error: updErr } = await client
    .from("applications")
    .update({ status: "followed_up" })
    .in("id", ids);

  if (updErr) {
    return NextResponse.json(
      { detail: `Mise à jour candidatures (statut relancé) : ${updErr.message}` },
      { status: 500 }
    );
  }

  const nb = mapped.length;
  return NextResponse.json({
    success: true,
    nb_emails: nb,
    message: `${nb} relance(s) envoyée(s).`,
  });
}
