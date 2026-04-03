"use client";

/**
 * Affiché quand NEXT_PUBLIC_SUPABASE_* manquent au build (ex. Netlify sans variables).
 */
export function SupabaseConfigMissing({ context }: { context?: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-stone-50 p-6 text-center">
      <div className="max-w-lg rounded-2xl border border-stone-200 bg-white p-8 shadow-sm">
        <h1 className="text-lg font-semibold text-stone-900">Configuration Supabase manquante</h1>
        <p className="mt-3 text-sm leading-relaxed text-stone-600">
          Définis sur Netlify (Site settings → Environment variables), pour <strong>Production</strong> au minimum :{" "}
          <code className="rounded bg-stone-100 px-1.5 py-0.5 text-xs">NEXT_PUBLIC_SUPABASE_URL</code> et{" "}
          <code className="rounded bg-stone-100 px-1.5 py-0.5 text-xs">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> (ou{" "}
          <code className="rounded bg-stone-100 px-1.5 py-0.5 text-xs">NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code>
          ). Les préfixes <code className="text-xs">NEXT_PUBLIC_</code> sont obligatoires : ils sont figés au{" "}
          <strong>build</strong>, puis clique sur <strong>Clear cache and deploy site</strong>.
        </p>
        {context ? <p className="mt-4 text-xs text-stone-500">{context}</p> : null}
      </div>
    </div>
  );
}
