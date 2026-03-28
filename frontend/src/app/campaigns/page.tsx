"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Rocket, MapPin, Calendar } from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { Campaign } from "@/lib/types";
import { CONTRACT_LABELS } from "@/lib/utils";

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  const loadCampaigns = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;

    try {
      const data = await api<Campaign[]>("/api/campaigns/", {
        token: session.access_token,
      });
      setCampaigns(data);
    } catch {
      // Sera chargé quand le backend sera prêt
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadCampaigns();
  }, [loadCampaigns]);

  const statusConfig: Record<
    string,
    { label: string; variant: "default" | "success" | "warning" | "info" }
  > = {
    draft: { label: "Brouillon", variant: "default" },
    running: { label: "En cours", variant: "success" },
    paused: { label: "En pause", variant: "warning" },
    completed: { label: "Terminée", variant: "info" },
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Campagnes</h1>
            <p className="text-gray-600 mt-1">
              Gère tes campagnes de candidatures spontanées.
            </p>
          </div>
          <Link href="/campaigns/new">
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Nouvelle campagne
            </Button>
          </Link>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
          </div>
        ) : campaigns.length === 0 ? (
          <Card>
            <CardContent className="text-center py-16">
              <Rocket className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Aucune campagne
              </h3>
              <p className="text-gray-500 mb-6 max-w-md mx-auto">
                Crée ta première campagne pour commencer à envoyer des
                candidatures automatiquement.
              </p>
              <Link href="/campaigns/new">
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Créer ma première campagne
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {campaigns.map((campaign) => {
              const status = statusConfig[campaign.status];
              return (
                <Link key={campaign.id} href={`/campaigns/${campaign.id}`}>
                  <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                    <CardContent className="p-5 space-y-4">
                      <div className="flex items-start justify-between">
                        <h3 className="font-semibold text-gray-900 text-lg leading-tight">
                          {campaign.job_title}
                        </h3>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </div>

                      <div className="space-y-2 text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-gray-400" />
                          {campaign.location} ({campaign.radius_km} km)
                        </div>
                        <div className="flex items-center gap-2">
                          <Rocket className="w-4 h-4 text-gray-400" />
                          {CONTRACT_LABELS[campaign.contract_type]}
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          {new Date(campaign.created_at).toLocaleDateString(
                            "fr-FR"
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
