"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Rocket } from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Campaign } from "@/lib/types";

const CONTRACT_OPTIONS = [
  {
    value: "stage",
    label: "Stage",
    desc: "Stage de fin d'études ou de découverte",
  },
  {
    value: "alternance",
    label: "Alternance",
    desc: "Contrat d'apprentissage ou de professionnalisation",
  },
  { value: "cdi", label: "CDI", desc: "Contrat à durée indéterminée" },
  { value: "cdd", label: "CDD", desc: "Contrat à durée déterminée" },
];

export default function NewCampaignPage() {
  const [jobTitle, setJobTitle] = useState("");
  const [location, setLocation] = useState("");
  const [radiusKm, setRadiusKm] = useState(30);
  const [contractType, setContractType] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!jobTitle || !location || !contractType) {
      setError("Tous les champs sont requis");
      return;
    }

    setLoading(true);

    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.push("/auth/login");
      return;
    }

    try {
      const campaign = await api<Campaign>("/api/campaigns/", {
        method: "POST",
        token: session.access_token,
        body: {
          job_title: jobTitle,
          location,
          radius_km: radiusKm,
          contract_type: contractType,
        },
      });

      router.push(`/campaigns/${campaign.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de la création");
      setLoading(false);
    }
  }

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/campaigns">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Nouvelle campagne
            </h1>
            <p className="text-gray-600 mt-1">
              Configure ta campagne de candidatures spontanées.
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Rocket className="w-5 h-5 text-indigo-600" />
              <h2 className="text-lg font-semibold text-gray-900">
                Paramètres de la campagne
              </h2>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <Input
                id="jobTitle"
                label="Poste recherché"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="Ex: Développeur web, Assistant marketing, Chef de projet..."
                required
              />

              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <Input
                    id="location"
                    label="Ville"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Ex: Paris, Lyon, Bordeaux..."
                    required
                  />
                </div>
                <div>
                  <Input
                    id="radius"
                    label="Rayon (km)"
                    type="number"
                    value={radiusKm}
                    onChange={(e) => setRadiusKm(Number(e.target.value))}
                    min={5}
                    max={200}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Type de contrat
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {CONTRACT_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setContractType(option.value)}
                      className={cn(
                        "border-2 rounded-xl p-4 text-left transition-all",
                        contractType === option.value
                          ? "border-indigo-600 bg-indigo-50 ring-1 ring-indigo-200"
                          : "border-gray-200 hover:border-gray-300"
                      )}
                    >
                      <p className="font-medium text-gray-900">
                        {option.label}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {option.desc}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
                  {error}
                </p>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <Link href="/campaigns">
                  <Button variant="secondary" type="button">
                    Annuler
                  </Button>
                </Link>
                <Button type="submit" loading={loading}>
                  Créer la campagne
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
