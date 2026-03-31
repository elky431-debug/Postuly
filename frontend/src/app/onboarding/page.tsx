"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { GraduationCap, Briefcase, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { PostulyWordmark } from "@/components/brand/PostulyLogo";

type ProfileType = "etudiant" | "jeune_actif";

export default function OnboardingPage() {
  const [selected, setSelected] = useState<ProfileType | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleContinue() {
    if (!selected) return;
    setLoading(true);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/auth/login");
      return;
    }

    await supabase
      .from("profiles")
      .update({ profile_type: selected })
      .eq("id", user.id);

    router.push("/dashboard");
  }

  const profiles = [
    {
      type: "etudiant" as ProfileType,
      icon: GraduationCap,
      title: "Étudiant",
      description:
        "Tu cherches un stage ou une alternance. On adapte tout : les cibles, le ton des lettres, les champs du formulaire.",
      tags: ["Stage", "Alternance", "Première expérience"],
    },
    {
      type: "jeune_actif" as ProfileType,
      icon: Briefcase,
      title: "Jeune actif",
      description:
        "Tu as déjà une expérience et tu cherches un CDI ou CDD. Le pipeline met en avant tes compétences et expériences.",
      tags: ["CDI", "CDD", "Expérience professionnelle"],
    },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-10">
          <div className="mb-6 flex justify-center">
            <PostulyWordmark size="lg" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Bienvenue sur Postuly !
          </h1>
          <p className="text-gray-600 text-lg">
            Dis-nous qui tu es pour adapter ton expérience.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-4 mb-8">
          {profiles.map((profile) => (
            <button
              key={profile.type}
              onClick={() => setSelected(profile.type)}
              className={cn(
                "bg-white rounded-2xl border-2 p-6 text-left transition-all hover:shadow-md",
                selected === profile.type
                  ? "border-indigo-600 ring-2 ring-indigo-100"
                  : "border-gray-200 hover:border-gray-300"
              )}
            >
              <div
                className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center mb-4",
                  selected === profile.type ? "bg-indigo-100" : "bg-gray-100"
                )}
              >
                <profile.icon
                  className={cn(
                    "w-6 h-6",
                    selected === profile.type
                      ? "text-indigo-600"
                      : "text-gray-500"
                  )}
                />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {profile.title}
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                {profile.description}
              </p>
              <div className="flex flex-wrap gap-2">
                {profile.tags.map((tag) => (
                  <span
                    key={tag}
                    className={cn(
                      "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium",
                      selected === profile.type
                        ? "bg-indigo-50 text-indigo-700"
                        : "bg-gray-100 text-gray-600"
                    )}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </button>
          ))}
        </div>

        <div className="flex justify-center">
          <Button
            size="lg"
            onClick={handleContinue}
            disabled={!selected}
            loading={loading}
          >
            Continuer
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}
