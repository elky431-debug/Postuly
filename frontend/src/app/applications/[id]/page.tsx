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
  Building2,
  Mail,
  Globe,
  MapPin,
  CheckCircle2,
  X,
  Send,
  Edit3,
  Save,
} from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { Application } from "@/lib/types";
import { STATUS_LABELS, STATUS_COLORS, cn } from "@/lib/utils";

export default function ApplicationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [application, setApplication] = useState<Application | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editedLetter, setEditedLetter] = useState("");
  const [saving, setSaving] = useState(false);
  const [token, setToken] = useState("");

  const loadData = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;
    setToken(session.access_token);

    try {
      const data = await api<Application>(
        `/api/applications/${params.id}`,
        { token: session.access_token }
      );
      setApplication(data);
      setEditedLetter(data.cover_letter || "");
    } catch {
      router.push("/dashboard");
    }
    setLoading(false);
  }, [params.id, router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleSaveLetter() {
    if (!application || !token) return;
    setSaving(true);
    try {
      await api(`/api/applications/${application.id}`, {
        method: "PATCH",
        token,
        body: { cover_letter: editedLetter },
      });
      setApplication({ ...application, cover_letter: editedLetter });
      setEditing(false);
    } catch {
      // Erreur silencieuse
    }
    setSaving(false);
  }

  async function handleApprove() {
    if (!application || !token) return;
    try {
      await api(`/api/applications/${application.id}/approve`, {
        method: "POST",
        token,
      });
      setApplication({ ...application, status: "approved" });
    } catch {
      // Erreur silencieuse
    }
  }

  async function handleSend() {
    if (!application || !token) return;
    try {
      await api(`/api/applications/${application.id}/send`, {
        method: "POST",
        token,
      });
      setApplication({ ...application, status: "sent" as const });
    } catch {
      // Erreur silencieuse
    }
  }

  async function handleReject() {
    if (!application || !token) return;
    try {
      await api(`/api/applications/${application.id}`, {
        method: "PATCH",
        token,
        body: { status: "rejected" },
      });
      setApplication({ ...application, status: "rejected" });
    } catch {
      // Erreur silencieuse
    }
  }

  if (loading || !application) {
    return (
      <AppLayout>
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
        </div>
      </AppLayout>
    );
  }

  const company = application.company;
  const contact = application.contact;

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">
                {company?.name || "Candidature"}
              </h1>
              <span
                className={cn(
                  "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                  STATUS_COLORS[application.status]
                )}
              >
                {STATUS_LABELS[application.status]}
              </span>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Infos entreprise */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-gray-500" />
                  <h2 className="font-semibold text-gray-900">Entreprise</h2>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <p className="text-gray-500">Nom</p>
                  <p className="font-medium text-gray-900">
                    {company?.name || "—"}
                  </p>
                </div>
                {company?.city && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    <p className="text-gray-700">
                      {company.address
                        ? `${company.address}`
                        : company.city}
                    </p>
                  </div>
                )}
                {company?.website_url && (
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-gray-400" />
                    <a
                      href={company.website_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-600 hover:underline truncate"
                    >
                      {company.website_url}
                    </a>
                  </div>
                )}
                {company?.naf_label && (
                  <div>
                    <p className="text-gray-500">Secteur</p>
                    <p className="text-gray-700">{company.naf_label}</p>
                  </div>
                )}
                {company?.size_range && (
                  <div>
                    <p className="text-gray-500">Taille</p>
                    <p className="text-gray-700">{company.size_range}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Mail className="w-5 h-5 text-gray-500" />
                  <h2 className="font-semibold text-gray-900">Contact</h2>
                </div>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                <div>
                  <p className="text-gray-500">Email</p>
                  <p className="font-medium text-gray-900">
                    {contact?.email || "Aucun email trouvé"}
                  </p>
                </div>
                {contact && (
                  <div>
                    <p className="text-gray-500">Source</p>
                    <Badge
                      variant={
                        contact.source === "scraped" ? "success" : "warning"
                      }
                    >
                      {contact.source === "scraped"
                        ? "Trouvé sur le site"
                        : contact.source === "guessed"
                        ? "Pattern deviné"
                        : "Manuel"}
                    </Badge>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="space-y-2">
              {application.status === "pending_review" && (
                <>
                  <Button
                    className="w-full"
                    onClick={handleApprove}
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Approuver
                  </Button>
                  <Button
                    variant="danger"
                    className="w-full"
                    onClick={handleReject}
                  >
                    <X className="w-4 h-4 mr-2" />
                    Passer
                  </Button>
                </>
              )}
              {application.status === "approved" && (
                <Button className="w-full" onClick={handleSend}>
                  <Send className="w-4 h-4 mr-2" />
                  Envoyer l&apos;email
                </Button>
              )}
            </div>
          </div>

          {/* Lettre de motivation */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-gray-900">
                  Lettre de motivation
                </h2>
                {!editing && application.status === "pending_review" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditing(true)}
                  >
                    <Edit3 className="w-4 h-4 mr-1" />
                    Modifier
                  </Button>
                )}
                {editing && (
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditing(false);
                        setEditedLetter(application.cover_letter || "");
                      }}
                    >
                      Annuler
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSaveLetter}
                      loading={saving}
                    >
                      <Save className="w-4 h-4 mr-1" />
                      Sauvegarder
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {editing ? (
                <textarea
                  value={editedLetter}
                  onChange={(e) => setEditedLetter(e.target.value)}
                  className="w-full h-96 border border-gray-300 rounded-lg p-4 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  placeholder="Lettre de motivation..."
                />
              ) : (
                <div className="prose prose-sm max-w-none">
                  {application.cover_letter ? (
                    <div className="whitespace-pre-wrap text-sm text-gray-700 leading-relaxed">
                      {application.cover_letter}
                    </div>
                  ) : (
                    <p className="text-gray-400 italic">
                      Aucune lettre générée pour le moment.
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
