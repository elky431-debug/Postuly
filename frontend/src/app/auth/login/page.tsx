"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetInfo, setResetInfo] = useState("");
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      /* Messages Supabase utiles en dev (email non confirmé, etc.) */
      const msg = error.message.toLowerCase();
      if (msg.includes("invalid login") || msg.includes("invalid credentials")) {
        setError(
          "Email ou mot de passe incorrect. " +
            "Astuce : ce n’est pas le mot de passe « base de données » du projet Supabase, " +
            "mais celui défini à l’inscription (ou utilise « Continuer avec Google »)."
        );
      } else if (msg.includes("email not confirmed")) {
        setError(
          "Confirme ton email : ouvre le lien reçu depuis Supabase, " +
            "ou désactive la confirmation obligatoire dans Authentication → Providers → Email."
        );
      } else {
        setError(error.message);
      }
      setLoading(false);
      return;
    }

    router.push("/dashboard");
  }

  async function handleForgotPassword() {
    setError("");
    setResetInfo("");
    const trimmed = email.trim();
    if (!trimmed) {
      setError("Indique ton email ci-dessus, puis clique à nouveau sur « Mot de passe oublié ».");
      return;
    }
    setResetLoading(true);
    const supabase = createClient();
    const { error: err } = await supabase.auth.resetPasswordForEmail(trimmed, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    setResetLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    setResetInfo(
      "Si un compte existe pour cet email, tu vas recevoir un lien pour choisir un nouveau mot de passe (vérifie les spams)."
    );
  }

  async function handleGoogleLogin() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes:
          "email profile https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly",
      },
    });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold">P</span>
            </div>
            <span className="text-2xl font-bold text-gray-900">Postuly</span>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Bon retour !</h1>
          <p className="text-gray-600 mt-1">Connecte-toi à ton compte</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
          <button
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center gap-3 border border-gray-300 rounded-lg px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors mb-6"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Continuer avec Google
          </button>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">ou</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              id="email"
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ton@email.com"
              required
            />
            <div className="space-y-1">
              <Input
                id="password"
                label="Mot de passe"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={resetLoading}
                className="text-xs text-indigo-600 hover:underline disabled:opacity-50"
              >
                {resetLoading ? "Envoi…" : "Mot de passe oublié ?"}
              </button>
            </div>

            {resetInfo && (
              <p className="text-sm text-green-700 bg-green-50 p-3 rounded-lg">{resetInfo}</p>
            )}

            {error && (
              <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full" loading={loading}>
              Se connecter
            </Button>
          </form>

          <p className="text-center text-sm text-gray-600 mt-6">
            Pas encore de compte ?{" "}
            <Link
              href="/auth/signup"
              className="text-indigo-600 font-medium hover:underline"
            >
              Créer un compte
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
