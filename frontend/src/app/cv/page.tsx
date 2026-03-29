"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { AppLayout } from "@/components/layout/app-layout";
import { MonCvJobeaExperience } from "@/components/cv/mon-cv-jobea";
import { api, apiUpload } from "@/lib/api";
import {
  clearCoachCache,
  loadCoachCache,
  markCoachCacheViewed,
  saveCoachCache,
} from "@/lib/cv-coach-cache";
import {
  getMonCvFlowStep,
  resetMonCvFlow,
  setMonCvFlowStep,
  type MonCvFlowStep,
} from "@/lib/mon-cv-flow";
import type { Campaign, CvCoachAnalysis, CvParsed, Profile } from "@/lib/types";

type ProfileLoadState = "idle" | "loading" | "ready" | "missing" | "error";
type AnalysisPhase = "hub" | "setup" | "analyzing" | "results";

const ACCEPT =
  ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export default function CvPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [token, setToken] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [profileLoad, setProfileLoad] = useState<ProfileLoadState>("idle");
  const [profileLoadDetail, setProfileLoadDetail] = useState<string | null>(null);

  const [uploading, setUploading] = useState(false);
  const [removingCv, setRemovingCv] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadOk, setUploadOk] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [lastFileName, setLastFileName] = useState<string | null>(null);

  const coachDefaultsLoaded = useRef(false);
  const [coachPoste, setCoachPoste] = useState("");
  const [coachContrat, setCoachContrat] = useState<Campaign["contract_type"] | "">("");
  const [coachProfilHint, setCoachProfilHint] = useState<
    "" | "etudiant" | "jeune_actif" | "reconversion"
  >("");
  const [coachError, setCoachError] = useState<string | null>(null);
  const [coachResult, setCoachResult] = useState<CvCoachAnalysis | null>(null);
  const [analysisPhase, setAnalysisPhase] = useState<AnalysisPhase>("setup");
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const hasCoachCache = useMemo(() => {
    if (!userId) return false;
    return loadCoachCache(userId) != null;
  }, [userId, coachResult, analysisPhase]);

  const analysisPhaseRef = useRef<AnalysisPhase>("setup");
  const coachResultRef = useRef<CvCoachAnalysis | null>(null);
  const userIdRef = useRef<string | null>(null);
  const coachCacheHydratedRef = useRef(false);
  const [flowStep, setFlowStepState] = useState<MonCvFlowStep>("import");
  /** Édition des données CV depuis le hub sans perdre l’étape « completed » en localStorage. */
  const [cvDataEditFromHub, setCvDataEditFromHub] = useState(false);

  analysisPhaseRef.current = analysisPhase;
  coachResultRef.current = coachResult;
  userIdRef.current = userId;

  const loadProfile = useCallback(async () => {
    setProfileLoad("loading");
    setProfileLoadDetail(null);
    try {
      const supabase = createClient();
      const {
        data: { session },
        error: sessionErr,
      } = await supabase.auth.getSession();

      if (sessionErr || !session) {
        setToken("");
        setUserId(null);
        setProfile(null);
        setProfileLoad("idle");
        return;
      }

      setToken(session.access_token);
      setUserId(session.user.id);

      try {
        const p = await api<Profile>("/api/profiles/me", { token: session.access_token });
        setProfile(p);
        setProfileLoad("ready");
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg.includes("Profil non trouvé") || msg.includes("404")) {
          setProfile(null);
          setProfileLoad("missing");
          setProfileLoadDetail(
            "Aucun profil en base — termine l’onboarding ou crée un compte. Tu peux quand même tenter l’upload si l’API accepte."
          );
        } else {
          setProfile(null);
          setProfileLoad("error");
          setProfileLoadDetail(msg || "Impossible de charger le profil.");
        }
      }
    } catch (e) {
      setProfileLoad("error");
      setProfileLoadDetail(
        e instanceof Error ? e.message : "Session ou configuration Supabase front incorrecte."
      );
    }
  }, []);

  const syncFlowStep = useCallback(() => {
    if (!userId) {
      setFlowStepState("import");
      return;
    }
    if (cvDataEditFromHub) return;
    setFlowStepState(getMonCvFlowStep(userId, Boolean(profile?.cv_parsed)));
  }, [userId, profile?.cv_parsed, cvDataEditFromHub]);

  function setFlowStep(step: MonCvFlowStep) {
    if (userId) setMonCvFlowStep(userId, step);
    setFlowStepState(step);
  }

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  /** Changement de compte : permet de recharger le cache du nouvel utilisateur. */
  useEffect(() => {
    coachCacheHydratedRef.current = false;
    setCvDataEditFromHub(false);
  }, [userId]);

  useEffect(() => {
    syncFlowStep();
  }, [syncFlowStep]);

  /**
   * Parcours terminé (campagnes) → hub Jobea au retour.
   * Sinon, si analyse coach en cache et étape « avant campagnes », on rouvre résultats ou hub local.
   */
  useEffect(() => {
    if (coachCacheHydratedRef.current) return;
    if (!userId || profileLoad !== "ready" || !profile?.cv_parsed) return;
    const step = getMonCvFlowStep(userId, true);
    const cached = loadCoachCache(userId);

    if (step === "completed" && cached?.analysis) {
      coachCacheHydratedRef.current = true;
      setCoachResult(cached.analysis);
      setCoachPoste(cached.poste);
      setCoachContrat(cached.contrat);
      setCoachProfilHint(cached.profilHint);
      setAnalysisPhase("hub");
      setFlowStepState("completed");
      return;
    }

    if (cached?.analysis && step === "before_coach") {
      coachCacheHydratedRef.current = true;
      setCoachResult(cached.analysis);
      setCoachPoste(cached.poste);
      setCoachContrat(cached.contrat);
      setCoachProfilHint(cached.profilHint);
      setAnalysisPhase(cached.viewed ? "hub" : "results");
    }
  }, [userId, profileLoad, profile?.cv_parsed]);

  /** Garde poste / contrat à jour dans le cache pendant la vue hub. */
  useEffect(() => {
    if (analysisPhase !== "hub" || !userId || !coachResult) return;
    const t = window.setTimeout(() => {
      saveCoachCache({
        userId,
        analysis: coachResult,
        poste: coachPoste,
        contrat: coachContrat,
        profilHint: coachProfilHint,
        viewed: true,
      });
    }, 400);
    return () => window.clearTimeout(t);
  }, [
    analysisPhase,
    userId,
    coachResult,
    coachPoste,
    coachContrat,
    coachProfilHint,
  ]);

  useEffect(() => {
    if (!token || coachDefaultsLoaded.current) return;
    coachDefaultsLoaded.current = true;
    void (async () => {
      try {
        const campaigns = await api<Campaign[]>("/api/campaigns/", { token });
        const first = campaigns?.[0];
        if (first) {
          setCoachPoste((p) => p || first.job_title);
          setCoachContrat((c) => c || first.contract_type);
        }
      } catch {
        /* ignore */
      }
    })();
  }, [token]);

  function stopProgressTimer() {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  }

  function clearCoachUi() {
    clearCoachCache();
    coachCacheHydratedRef.current = false;
    setCoachResult(null);
    setCoachError(null);
    setAnalysisPhase("setup");
    setAnalysisProgress(0);
    stopProgressTimer();
  }

  function applyUploadResult(
    r: { cv_url: string; score: number; parsed: CvParsed; suggestions: string[] },
    uid: string,
    fileName?: string
  ) {
    if (fileName) setLastFileName(fileName);
    setUploadOk("CV analysé et enregistré.");
    clearCoachCache();
    coachCacheHydratedRef.current = false;
    setCoachResult(null);
    setCoachError(null);
    setAnalysisPhase("setup");
    setAnalysisProgress(0);
    stopProgressTimer();
    setProfile((prev) => {
      if (prev) {
        return {
          ...prev,
          cv_url: r.cv_url || prev.cv_url,
          cv_score: r.score,
          cv_parsed: r.parsed,
        };
      }
      return {
        id: uid,
        full_name: null,
        profile_type: null,
        cv_url: r.cv_url || null,
        cv_parsed: r.parsed,
        cv_score: r.score,
        created_at: new Date().toISOString(),
      };
    });
    setCvDataEditFromHub(false);
    setMonCvFlowStep(uid, "extracted_gate");
    setFlowStepState("extracted_gate");
  }

  async function runUpload(file: File) {
    setUploadError(null);
    setUploadOk(null);

    let t = token;
    let uid = userId;
    if (!t || !uid) {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setUploadError("Tu n’es plus connecté — recharge la page.");
        return;
      }
      t = session.access_token;
      uid = session.user.id;
      setToken(t);
      setUserId(uid);
    }

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await apiUpload<{
        cv_url: string;
        score: number;
        parsed: CvParsed;
        suggestions: string[];
      }>("/api/cv/upload", fd, t);
      applyUploadResult(r, uid, file.name);
      await loadProfile();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Échec de l’envoi du fichier.");
    } finally {
      setUploading(false);
    }
  }

  function onFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) void runUpload(file);
  }

  async function removeCv() {
    if (
      !window.confirm(
        "Supprimer ce CV ? Le fichier, le score et les données extraites seront effacés de ton profil."
      )
    ) {
      return;
    }
    let t = token;
    if (!t) {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setUploadError("Connecte-toi pour supprimer le CV.");
        return;
      }
      t = session.access_token;
      setToken(t);
    }
    setUploadError(null);
    setUploadOk(null);
    setRemovingCv(true);
    try {
      await api<Profile>("/api/profiles/me", {
        method: "PATCH",
        token: t,
        body: { cv_url: null, cv_parsed: null, cv_score: null },
      });
      setLastFileName(null);
      clearCoachUi();
      const uidRm = userIdRef.current;
      if (uidRm) resetMonCvFlow(uidRm);
      setCvDataEditFromHub(false);
      setFlowStepState("import");
      setUploadOk("CV supprimé.");
      await loadProfile();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Impossible de supprimer le CV.");
    } finally {
      setRemovingCv(false);
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void runUpload(file);
  }

  async function runCoachAnalysis() {
    setCoachError(null);
    if (!coachPoste.trim()) {
      setCoachError("Indique l’intitulé du poste recherché.");
      return;
    }
    if (!coachContrat) {
      setCoachError("Choisis un type de contrat.");
      return;
    }

    let t = token;
    let uid = userId;
    const supabase = createClient();
    if (!t || !uid) {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setCoachError("Connecte-toi pour lancer l’analyse.");
        return;
      }
      t = session.access_token;
      uid = session.user.id;
      setToken(t);
      setUserId(uid);
    }

    if (!profile?.cv_parsed) {
      setCoachError("Envoie d’abord un CV pour disposer des données parsées.");
      return;
    }

    setAnalysisPhase("analyzing");
    setAnalysisProgress(0);
    stopProgressTimer();
    progressTimerRef.current = setInterval(() => {
      setAnalysisProgress((p) => {
        if (p >= 92) return p;
        return Math.min(92, p + 2 + Math.random() * 4);
      });
    }, 420);

    try {
      const res = await api<{ analyse: CvCoachAnalysis }>("/api/cv/analyse-coach", {
        method: "POST",
        token: t,
        body: {
          poste_recherche: coachPoste.trim(),
          type_contrat: coachContrat,
          profil_hint: coachProfilHint || undefined,
        },
      });
      const analyse = res.analyse;
      setCoachResult(analyse);
      setAnalysisProgress(100);
      setAnalysisPhase("results");
      if (uid) {
        saveCoachCache({
          userId: uid,
          analysis: analyse,
          poste: coachPoste.trim(),
          contrat: coachContrat,
          profilHint: coachProfilHint,
          viewed: false,
        });
      }
    } catch (e) {
      setCoachResult(null);
      setCoachError(e instanceof Error ? e.message : "Analyse indisponible.");
      setAnalysisPhase("setup");
      setAnalysisProgress(0);
    } finally {
      stopProgressTimer();
    }
  }

  function resetCoachAnalysis() {
    clearCoachUi();
    if (userId) setMonCvFlowStep(userId, "before_coach");
    setFlowStepState(userId ? "before_coach" : "import");
  }

  function viewCoachResultsFromHub() {
    setAnalysisPhase("results");
  }

  function startNewCvAnalysisFromHub() {
    clearCoachUi();
    setCvDataEditFromHub(false);
    const uid = userIdRef.current;
    if (uid) setMonCvFlowStep(uid, "before_coach");
    setFlowStepState("before_coach");
  }

  function startCampaigns() {
    const uid = userIdRef.current;
    if (!uid) return;
    setMonCvFlowStep(uid, "completed");
    setFlowStepState("completed");
    const analysis = coachResultRef.current;
    if (analysis) {
      saveCoachCache({
        userId: uid,
        analysis,
        poste: coachPoste.trim(),
        contrat: coachContrat,
        profilHint: coachProfilHint,
        viewed: true,
      });
    }
    markCoachCacheViewed(uid);
    router.push("/campaigns");
  }

  function restoreCoachFromCache() {
    if (!userId) return;
    const c = loadCoachCache(userId);
    if (!c?.analysis) return;
    setCoachResult(c.analysis);
    setCoachPoste(c.poste);
    setCoachContrat(c.contrat);
    setCoachProfilHint(c.profilHint);
    setCoachError(null);
    setAnalysisPhase("results");
  }

  useEffect(() => () => stopProgressTimer(), []);

  return (
    <AppLayout>
      <div
        className="min-h-[calc(100vh-4rem)] -mx-6 -my-8 px-6 py-8"
        style={{ background: "#F7F6F3" }}
      >
        {profileLoad === "loading" && (
          <p
            className="text-xs mb-4 px-4 py-2.5 rounded-xl bg-white text-gray-600 max-w-3xl mx-auto shadow-sm"
            style={{ border: "1px solid #EEEEED" }}
          >
            Chargement du profil…
          </p>
        )}
        {profileLoad === "missing" && profileLoadDetail && (
          <div
            className="mb-4 text-sm px-4 py-3 rounded-xl border max-w-3xl mx-auto"
            style={{ borderColor: "#FDE68A", background: "#FFFBEB", color: "#92400E" }}
          >
            {profileLoadDetail}
          </div>
        )}
        {profileLoad === "error" && profileLoadDetail && (
          <div
            className="mb-4 text-sm px-4 py-3 rounded-xl border border-red-200 bg-red-50 text-red-900 max-w-3xl mx-auto"
          >
            <p className="font-medium mb-1">Profil : erreur API</p>
            <p>{profileLoadDetail}</p>
          </div>
        )}

        <MonCvJobeaExperience
          profile={profile}
          uploading={uploading}
          uploadError={uploadError}
          uploadOk={uploadOk}
          lastFileName={lastFileName}
          dragOver={dragOver}
          onDrop={onDrop}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onFileInput={onFileInput}
          accept={ACCEPT}
          coachPoste={coachPoste}
          setCoachPoste={setCoachPoste}
          coachContrat={coachContrat}
          setCoachContrat={setCoachContrat}
          coachProfilHint={coachProfilHint}
          setCoachProfilHint={setCoachProfilHint}
          coachError={coachError}
          coachResult={coachResult}
          analysisPhase={analysisPhase}
          analysisProgress={analysisProgress}
          onStartAnalysis={() => void runCoachAnalysis()}
          onResetAnalysis={resetCoachAnalysis}
          onViewCoachResultsFromHub={viewCoachResultsFromHub}
          onNewCvAnalysisFromHub={startNewCvAnalysisFromHub}
          flowStep={flowStep}
          onOpenCvInfos={() => setFlowStep("verify")}
          cvDataEditFromHub={cvDataEditFromHub}
          onOpenCvDataFromHub={() => {
            setCvDataEditFromHub(true);
            setAnalysisPhase("setup");
            setFlowStepState("verify");
          }}
          onCancelCvDataEditFromHub={() => {
            setCvDataEditFromHub(false);
            setAnalysisPhase("hub");
            setFlowStepState("completed");
          }}
          onAfterValidateDossier={() => {
            setCoachError(null);
            if (cvDataEditFromHub) {
              setCvDataEditFromHub(false);
              setAnalysisPhase("hub");
              setFlowStepState("completed");
            } else {
              setFlowStep("before_coach");
            }
          }}
          onStartCampaigns={startCampaigns}
          hasCoachCache={hasCoachCache}
          onRestoreCoachFromCache={() => restoreCoachFromCache()}
          token={token}
          onCvFormSaved={() => void loadProfile()}
          onRemoveCv={() => void removeCv()}
          removingCv={removingCv}
        />
      </div>
    </AppLayout>
  );
}
