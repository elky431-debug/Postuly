"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Rocket,
  Play,
  MapPin,
  Building2,
  Mail,
  Eye,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { Campaign, Application } from "@/lib/types";
import {
  CONTRACT_LABELS,
  STATUS_LABELS,
  STATUS_COLORS,
  cn,
} from "@/lib/utils";

export default function CampaignDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [launching, setLaunching] = useState(false);
  const [launchingN8n, setLaunchingN8n] = useState(false);
  const [token, setToken] = useState("");

  const loadData = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;
    setToken(session.access_token);

    try {
      const [campaignData, appData] = await Promise.all([
        api<Campaign>(`/api/campaigns/${params.id}`, {
          token: session.access_token,
        }),
        api<Application[]>(
          `/api/applications/?campaign_id=${params.id}`,
          { token: session.access_token }
        ),
      ]);

      setCampaign(campaignData);
      setApplications(appData);
    } catch {
      router.push("/dashboard/selections");
    }
    setLoading(false);
  }, [params.id, router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleLaunch() {
    if (!campaign || !token) return;
    setLaunching(true);

    try {
      await api(`/api/campaigns/${campaign.id}/launch`, {
        method: "POST",
        token,
      });
      await loadData();
    } catch {
      // Erreur silencieuse en MVP
    }
    setLaunching(false);
  }

  /** Déclenche le workflow n8n (envoi Gmail espacé) pour les candidatures approuvées. */
  async function handleLaunchN8n() {
    if (!campaign || !token) return;
    setLaunchingN8n(true);
    try {
      const data = await api<{
        success?: boolean;
        message?: string;
        nb_emails?: number;
      }>("/api/n8n/launch-campaign", {
        method: "POST",
        token,
        body: { campaignId: campaign.id },
      });
      if (data.success) {
        alert(data.message ?? `${data.nb_emails ?? 0} e-mail(s) envoyé(s).`);
      }
      await loadData();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Échec du lancement n8n");
    }
    setLaunchingN8n(false);
  }

  async function handleApprove(applicationId: string) {
    try {
      await api(`/api/applications/${applicationId}/approve`, {
        method: "POST",
        token,
      });
      setApplications((prev) =>
        prev.map((a) =>
          a.id === applicationId ? { ...a, status: "approved" } : a
        )
      );
    } catch {
      // Erreur silencieuse
    }
  }

  async function handleSend(applicationId: string) {
    try {
      await api(`/api/applications/${applicationId}/send`, {
        method: "POST",
        token,
      });
      setApplications((prev) =>
        prev.map((a) =>
          a.id === applicationId ? { ...a, status: "sent" as const } : a
        )
      );
    } catch {
      // Erreur silencieuse
    }
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
        </div>
      </AppLayout>
    );
  }

  if (!campaign) return null;

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard/selections">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900">
                  {campaign.job_title}
                </h1>
                <Badge
                  variant={
                    campaign.status === "running" ? "success" : "default"
                  }
                >
                  {campaign.status === "draft"
                    ? "Brouillon"
                    : campaign.status === "running"
                    ? "En cours"
                    : campaign.status === "paused"
                    ? "En pause"
                    : "Terminée"}
                </Badge>
              </div>
              <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  {campaign.location} ({campaign.radius_km} km)
                </span>
                <span>{CONTRACT_LABELS[campaign.contract_type]}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {campaign.status === "draft" && (
              <Button onClick={handleLaunch} loading={launching}>
                <Play className="w-4 h-4 mr-2" />
                Lancer la campagne
              </Button>
            )}
            {applications.some((a) => a.status === "approved") && (
              <Button
                variant="outline"
                onClick={() => void handleLaunchN8n()}
                loading={launchingN8n}
              >
                <Rocket className="w-4 h-4 mr-2" />
                Envoyer via Gmail (n8n)
              </Button>
            )}
          </div>
        </div>

        {/* Stats rapides */}
        <div className="grid grid-cols-4 gap-4">
          {[
            {
              label: "Entreprises",
              value: applications.length,
              icon: Building2,
            },
            {
              label: "Emails trouvés",
              value: applications.filter((a) => a.contact).length,
              icon: Mail,
            },
            {
              label: "À revoir",
              value: applications.filter((a) => a.status === "pending_review")
                .length,
              icon: Eye,
            },
            {
              label: "Envoyées",
              value: applications.filter((a) => a.status === "sent").length,
              icon: CheckCircle2,
            },
          ].map((stat) => (
            <Card key={stat.label}>
              <CardContent className="flex items-center gap-3 py-4">
                <stat.icon className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-xl font-bold text-gray-900">
                    {stat.value}
                  </p>
                  <p className="text-xs text-gray-500">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Liste des candidatures */}
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-gray-900">
              Candidatures ({applications.length})
            </h2>
          </CardHeader>
          <CardContent>
            {applications.length === 0 ? (
              <div className="text-center py-12">
                <Building2 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">
                  {campaign.status === "draft"
                    ? "Lance la campagne pour trouver des entreprises."
                    : "Recherche en cours..."}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {applications.map((app) => (
                  <div
                    key={app.id}
                    className="py-4 flex items-center justify-between"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900 truncate">
                          {app.company?.name || "Entreprise"}
                        </p>
                        <span
                          className={cn(
                            "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
                            STATUS_COLORS[app.status]
                          )}
                        >
                          {STATUS_LABELS[app.status]}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                        {app.company?.city && (
                          <span>{app.company.city}</span>
                        )}
                        {app.contact?.email && (
                          <span>{app.contact.email}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      <Link href={`/applications/${app.id}`}>
                        <Button variant="ghost" size="sm">
                          <Eye className="w-4 h-4 mr-1" />
                          Voir
                        </Button>
                      </Link>

                      {app.status === "pending_review" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleApprove(app.id)}
                        >
                          Approuver
                        </Button>
                      )}

                      {app.status === "approved" && (
                        <Button
                          size="sm"
                          onClick={() => handleSend(app.id)}
                        >
                          <Mail className="w-4 h-4 mr-1" />
                          Envoyer
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
