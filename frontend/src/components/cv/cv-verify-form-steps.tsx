"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CvFormDraft } from "@/lib/cv-form";
import {
  emptyEducation,
  emptyExperience,
  emptyLanguage,
} from "@/lib/cv-form";
import { fetchPostcodeForFrenchCity } from "@/lib/french-city-postcode";

type SetDraft = React.Dispatch<React.SetStateAction<CvFormDraft>>;

/** Champs texte — focus charte Postuly */
const fieldClass =
  "mt-1.5 w-full rounded-xl border border-neutral-200/90 bg-white px-3 py-2.5 text-sm text-neutral-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition placeholder:text-neutral-400 focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-500/15";

/** Étape profil : remplit le code postal via la BAN (data.gouv) quand la ville est saisie. */
function PersonalInfoFields({ draft, setDraft }: { draft: CvFormDraft; setDraft: SetDraft }) {
  const [postalBusy, setPostalBusy] = useState(false);

  useEffect(() => {
    const city = draft.personal.city.trim();
    if (city.length < 2) {
      setPostalBusy(false);
      return;
    }

    const ac = new AbortController();
    const timer = window.setTimeout(() => {
      setPostalBusy(true);
      void fetchPostcodeForFrenchCity(city, ac.signal)
        .then((postcode) => {
          if (ac.signal.aborted || !postcode) return;
          setDraft((d) => {
            if (d.personal.city.trim() !== city) return d;
            if (d.personal.postal_code === postcode) return d;
            return {
              ...d,
              personal: { ...d.personal, postal_code: postcode },
            };
          });
        })
        .finally(() => {
          if (!ac.signal.aborted) setPostalBusy(false);
        });
    }, 450);

    return () => {
      window.clearTimeout(timer);
      ac.abort();
    };
  }, [draft.personal.city, setDraft]);

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h3 className="text-base font-semibold tracking-tight text-neutral-900">Informations personnelles</h3>
        <p className="text-xs leading-relaxed text-neutral-500">
          Renseignées par l’IA depuis ton CV — tu peux les corriger. Le code postal se remplit selon la
          ville (France).
        </p>
      </div>
      <div className="grid gap-4 text-sm sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="text-xs font-medium text-neutral-600">Nom complet</span>
          <input
            type="text"
            value={draft.personal.full_name}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                personal: { ...d.personal, full_name: e.target.value },
              }))
            }
            className={fieldClass}
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-xs font-medium text-neutral-600">Adresse</span>
          <input
            type="text"
            value={draft.personal.address}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                personal: { ...d.personal, address: e.target.value },
              }))
            }
            className={fieldClass}
          />
        </label>
        <label className="block">
          <span className="inline-flex items-center gap-2 text-xs font-medium text-neutral-600">
            Code postal
            {postalBusy && (
              <span className="text-[10px] font-normal tabular-nums text-orange-600">…</span>
            )}
          </span>
          <input
            type="text"
            inputMode="numeric"
            maxLength={5}
            value={draft.personal.postal_code}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                personal: { ...d.personal, postal_code: e.target.value },
              }))
            }
            className={fieldClass}
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-neutral-600">Ville</span>
          <input
            type="text"
            value={draft.personal.city}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                personal: { ...d.personal, city: e.target.value },
              }))
            }
            className={fieldClass}
            placeholder="Ex. Versailles"
            autoComplete="address-level2"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-neutral-600">Email</span>
          <input
            type="email"
            value={draft.email}
            onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
            className={fieldClass}
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-neutral-600">Téléphone</span>
          <input
            type="tel"
            value={draft.phone}
            onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))}
            className={fieldClass}
          />
        </label>
      </div>
    </div>
  );
}

export function CvVerifyFormSteps(props: {
  step: number;
  draft: CvFormDraft;
  setDraft: SetDraft;
}) {
  const { step, draft, setDraft } = props;
  const [skillDraft, setSkillDraft] = useState("");
  const [interestDraft, setInterestDraft] = useState("");

  if (step === 0) {
    return <PersonalInfoFields draft={draft} setDraft={setDraft} />;
  }

  if (step === 1) {
    return (
      <div className="space-y-4">
        <div className="space-y-1">
          <h3 className="text-base font-semibold tracking-tight text-neutral-900">Résumé professionnel</h3>
          <p className="text-xs leading-relaxed text-neutral-500">
            Texte d’accroche ou paragraphe « Profil » extrait par l’IA.
          </p>
        </div>
        <textarea
          value={draft.professional_summary}
          onChange={(e) =>
            setDraft((d) => ({ ...d, professional_summary: e.target.value }))
          }
          rows={8}
          className={cn(fieldClass, "mt-0 min-h-[10rem] resize-y")}
          placeholder="Ex. Étudiant motivé, rigueur et sens du service client…"
        />
      </div>
    );
  }

  if (step === 2) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-base font-semibold tracking-tight text-neutral-900">Expériences professionnelles</h3>
          <button
            type="button"
            onClick={() =>
              setDraft((d) => ({
                ...d,
                experience_items: [...d.experience_items, emptyExperience()],
              }))
            }
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-orange-600 transition-colors hover:bg-orange-50"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
            Ajouter
          </button>
        </div>
        {draft.experience_items.map((exp, i) => (
          <div
            key={i}
            className="space-y-3 rounded-xl border border-neutral-200/80 bg-stone-50/50 p-4"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-neutral-500">Expérience #{i + 1}</span>
              {draft.experience_items.length > 1 && (
                <button
                  type="button"
                  className="rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-red-50 hover:text-red-600"
                  aria-label="Supprimer"
                  onClick={() =>
                    setDraft((d) => ({
                      ...d,
                      experience_items: d.experience_items.filter((_, j) => j !== i),
                    }))
                  }
                >
                  <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                </button>
              )}
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="block text-xs">
                <span className="text-neutral-600">Poste</span>
                <input
                  value={exp.job_title}
                  onChange={(e) =>
                    setDraft((d) => {
                      const next = [...d.experience_items];
                      next[i] = { ...next[i], job_title: e.target.value };
                      return { ...d, experience_items: next };
                    })
                  }
                  className={fieldClass}
                />
              </label>
              <label className="block text-xs">
                <span className="text-neutral-600">Entreprise</span>
                <input
                  value={exp.company}
                  onChange={(e) =>
                    setDraft((d) => {
                      const next = [...d.experience_items];
                      next[i] = { ...next[i], company: e.target.value };
                      return { ...d, experience_items: next };
                    })
                  }
                  className={fieldClass}
                />
              </label>
              <label className="block text-xs">
                <span className="text-neutral-600">Date début</span>
                <input
                  value={exp.start_date}
                  onChange={(e) =>
                    setDraft((d) => {
                      const next = [...d.experience_items];
                      next[i] = { ...next[i], start_date: e.target.value };
                      return { ...d, experience_items: next };
                    })
                  }
                  className={fieldClass}
                />
              </label>
              <label className="block text-xs">
                <span className="text-neutral-600">Date fin</span>
                <input
                  value={exp.end_date}
                  onChange={(e) =>
                    setDraft((d) => {
                      const next = [...d.experience_items];
                      next[i] = { ...next[i], end_date: e.target.value };
                      return { ...d, experience_items: next };
                    })
                  }
                  disabled={exp.is_current}
                  className={`${fieldClass} disabled:bg-neutral-50 disabled:text-neutral-500`}
                />
              </label>
            </div>
            <label className="flex items-center gap-2 text-xs text-gray-700">
              <input
                type="checkbox"
                checked={exp.is_current}
                onChange={(e) =>
                  setDraft((d) => {
                    const next = [...d.experience_items];
                    next[i] = { ...next[i], is_current: e.target.checked };
                    return { ...d, experience_items: next };
                  })
                }
              />
              Poste actuel
            </label>
            <label className="block text-xs">
              <span className="text-gray-600">Description / missions</span>
              <textarea
                value={exp.description}
                onChange={(e) =>
                  setDraft((d) => {
                    const next = [...d.experience_items];
                    next[i] = { ...next[i], description: e.target.value };
                    return { ...d, experience_items: next };
                  })
                }
                rows={4}
                className={fieldClass}
              />
            </label>
          </div>
        ))}
      </div>
    );
  }

  if (step === 3) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-base font-semibold tracking-tight text-neutral-900">Formations & diplômes</h3>
          <button
            type="button"
            onClick={() =>
              setDraft((d) => ({
                ...d,
                education_items: [...d.education_items, emptyEducation()],
              }))
            }
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-orange-600 transition-colors hover:bg-orange-50"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
            Ajouter
          </button>
        </div>
        {draft.education_items.map((ed, i) => (
          <div
            key={i}
            className="space-y-3 rounded-xl border border-neutral-200/80 bg-stone-50/50 p-4"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-neutral-500">Formation #{i + 1}</span>
              {draft.education_items.length > 1 && (
                <button
                  type="button"
                  className="rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-red-50 hover:text-red-600"
                  aria-label="Supprimer"
                  onClick={() =>
                    setDraft((d) => ({
                      ...d,
                      education_items: d.education_items.filter((_, j) => j !== i),
                    }))
                  }
                >
                  <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                </button>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs sm:col-span-2">
                <span className="text-neutral-600">Diplôme / cursus</span>
                <input
                  value={ed.diploma}
                  onChange={(e) =>
                    setDraft((d) => {
                      const next = [...d.education_items];
                      next[i] = { ...next[i], diploma: e.target.value };
                      return { ...d, education_items: next };
                    })
                  }
                  className={fieldClass}
                />
              </label>
              <label className="block text-xs sm:col-span-2">
                <span className="text-neutral-600">Établissement</span>
                <input
                  value={ed.institution}
                  onChange={(e) =>
                    setDraft((d) => {
                      const next = [...d.education_items];
                      next[i] = { ...next[i], institution: e.target.value };
                      return { ...d, education_items: next };
                    })
                  }
                  className={fieldClass}
                />
              </label>
              <label className="block text-xs">
                <span className="text-neutral-600">Début</span>
                <input
                  value={ed.start_date}
                  onChange={(e) =>
                    setDraft((d) => {
                      const next = [...d.education_items];
                      next[i] = { ...next[i], start_date: e.target.value };
                      return { ...d, education_items: next };
                    })
                  }
                  className={fieldClass}
                />
              </label>
              <label className="block text-xs">
                <span className="text-neutral-600">Fin</span>
                <input
                  value={ed.end_date}
                  onChange={(e) =>
                    setDraft((d) => {
                      const next = [...d.education_items];
                      next[i] = { ...next[i], end_date: e.target.value };
                      return { ...d, education_items: next };
                    })
                  }
                  disabled={ed.in_progress}
                  className={`${fieldClass} disabled:bg-neutral-50 disabled:text-neutral-500`}
                />
              </label>
            </div>
            <label className="flex items-center gap-2 text-xs text-neutral-700">
              <input
                type="checkbox"
                checked={ed.in_progress}
                onChange={(e) =>
                  setDraft((d) => {
                    const next = [...d.education_items];
                    next[i] = { ...next[i], in_progress: e.target.checked };
                    return { ...d, education_items: next };
                  })
                }
              />
              En cours
            </label>
          </div>
        ))}
      </div>
    );
  }

  if (step === 4) {
    return (
      <div className="space-y-4">
        <div className="space-y-1">
          <h3 className="text-base font-semibold tracking-tight text-neutral-900">Compétences</h3>
          <p className="text-xs leading-relaxed text-neutral-500">
            Hors langues vivantes — uniquement savoir-faire et outils.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            value={skillDraft}
            onChange={(e) => setSkillDraft(e.target.value)}
            placeholder="Ajouter une compétence"
            className={cn("min-w-[160px] flex-1", fieldClass, "mt-0")}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                const t = skillDraft.trim();
                if (!t) return;
                setDraft((d) => ({ ...d, skills: [...d.skills, t] }));
                setSkillDraft("");
              }
            }}
          />
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#FE6A2E] to-[#FFB347] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-[1.02]"
            onClick={() => {
              const t = skillDraft.trim();
              if (!t) return;
              setDraft((d) => ({ ...d, skills: [...d.skills, t] }));
              setSkillDraft("");
            }}
          >
            <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
            Ajouter
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {draft.skills.map((s, idx) => (
            <span
              key={`${idx}-${s}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-orange-100 bg-orange-50/90 px-3 py-1.5 text-xs font-medium text-orange-950"
            >
              {s}
              <button
                type="button"
                className="rounded p-0.5 text-orange-600 transition-colors hover:bg-orange-100 hover:text-red-600"
                onClick={() =>
                  setDraft((d) => ({ ...d, skills: d.skills.filter((x) => x !== s) }))
                }
                aria-label={`Retirer ${s}`}
              >
                <X className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
            </span>
          ))}
        </div>
      </div>
    );
  }

  if (step === 5) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-base font-semibold tracking-tight text-neutral-900">Langues</h3>
          <button
            type="button"
            onClick={() =>
              setDraft((d) => ({
                ...d,
                language_items: [...d.language_items, emptyLanguage()],
              }))
            }
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-orange-600 transition-colors hover:bg-orange-50"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
            Ajouter
          </button>
        </div>
        {draft.language_items.map((lang, i) => (
          <div key={i} className="flex flex-wrap gap-2 items-end">
            <label className="min-w-[120px] flex-1 text-xs">
              <span className="text-neutral-600">Langue</span>
              <input
                value={lang.language}
                onChange={(e) =>
                  setDraft((d) => {
                    const next = [...d.language_items];
                    next[i] = { ...next[i], language: e.target.value };
                    return { ...d, language_items: next };
                  })
                }
                className={fieldClass}
              />
            </label>
            <label className="min-w-[120px] flex-1 text-xs">
              <span className="text-neutral-600">Niveau</span>
              <input
                value={lang.level}
                onChange={(e) =>
                  setDraft((d) => {
                    const next = [...d.language_items];
                    next[i] = { ...next[i], level: e.target.value };
                    return { ...d, language_items: next };
                  })
                }
                placeholder="B2, courant…"
                className={fieldClass}
              />
            </label>
            {draft.language_items.length > 1 && (
              <button
                type="button"
                className="mb-0.5 rounded-lg p-2 text-neutral-400 transition-colors hover:bg-red-50 hover:text-red-600"
                aria-label="Supprimer"
                onClick={() =>
                  setDraft((d) => ({
                    ...d,
                    language_items: d.language_items.filter((_, j) => j !== i),
                  }))
                }
              >
                <Trash2 className="h-4 w-4" strokeWidth={1.75} />
              </button>
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold tracking-tight text-neutral-900">Centres d’intérêt</h3>
      <div className="flex flex-wrap gap-2">
        <input
          type="text"
          value={interestDraft}
          onChange={(e) => setInterestDraft(e.target.value)}
          placeholder="Ajouter un centre d’intérêt"
          className={cn("min-w-[160px] flex-1", fieldClass, "mt-0")}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              const t = interestDraft.trim();
              if (!t) return;
              setDraft((d) => ({ ...d, interests: [...d.interests, t] }));
              setInterestDraft("");
            }
          }}
        />
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#FE6A2E] to-[#FFB347] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-[1.02]"
          onClick={() => {
            const t = interestDraft.trim();
            if (!t) return;
            setDraft((d) => ({ ...d, interests: [...d.interests, t] }));
            setInterestDraft("");
          }}
        >
          <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
          Ajouter
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {draft.interests.map((tag, idx) => (
          <span
            key={`${idx}-${tag}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs font-medium text-neutral-800"
          >
            {tag}
            <button
              type="button"
              className="rounded p-0.5 text-neutral-500 transition-colors hover:bg-neutral-200/80 hover:text-red-600"
              onClick={() =>
                setDraft((d) => ({
                  ...d,
                  interests: d.interests.filter((x) => x !== tag),
                }))
              }
              aria-label={`Retirer ${tag}`}
            >
              <X className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}
