"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Arrivée depuis le lien « réinitialiser le mot de passe » (email Supabase).
 * Le hash d’URL est lu par le client Supabase au chargement.
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);
  const [loading, setLoading] = useState(false);
  const [canSetPassword, setCanSetPassword] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) {
        setCanSetPassword(true);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setCanSetPassword(true);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 6) {
      setError("Le mot de passe doit faire au moins 6 caractères.");
      return;
    }
    if (password !== confirm) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { error: err } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    setOk(true);
    setTimeout(() => router.push("/dashboard"), 1500);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
        <h1 className="text-xl font-bold text-gray-900">Nouveau mot de passe</h1>
        <p className="text-sm text-gray-600 mt-1 mb-6">
          Choisis un mot de passe pour ton compte Postuly (Supabase Auth).
        </p>

        {!canSetPassword && (
          <p className="text-sm text-amber-800 bg-amber-50 p-3 rounded-lg mb-4">
            Ouvre le lien reçu par email depuis cette même machine. Si tu es déjà sur cette page sans
            avoir cliqué le lien,{" "}
            <Link href="/auth/login" className="underline font-medium">
              retourne à la connexion
            </Link>{" "}
            et demande un nouvel email.
          </p>
        )}

        {ok ? (
          <p className="text-sm text-green-700 bg-green-50 p-3 rounded-lg">
            Mot de passe mis à jour — redirection…
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              id="pw"
              label="Nouveau mot de passe"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
            <Input
              id="pw2"
              label="Confirmer"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={6}
            />
            {error && (
              <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>
            )}
            <Button type="submit" className="w-full" loading={loading} disabled={!canSetPassword}>
              Enregistrer
            </Button>
          </form>
        )}

        <p className="text-center text-sm text-gray-600 mt-6">
          <Link href="/auth/login" className="text-indigo-600 font-medium hover:underline">
            Retour connexion
          </Link>
        </p>
      </div>
    </div>
  );
}
