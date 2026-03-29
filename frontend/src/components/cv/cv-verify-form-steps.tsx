"use client";

import { useEffect, useState } from "react";
import type { CvFormDraft } from "@/lib/cv-form";
import {
  emptyEducation,
  emptyExperience,
  emptyLanguage,
} from "@/lib/cv-form";
import { fetchPostcodeForFrenchCity } from "@/lib/french-city-postcode";

type SetDraft = React.Dispatch<React.SetStateAction<CvFormDraft>>;

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
    <div className="space-y-4">
      <h3 className="font-semibold text-gray-900">Informations personnelles</h3>
      <p className="text-xs text-gray-500">
        Renseignées par l’IA depuis ton CV — tu peux les corriger. Le code postal se remplit selon la
        ville (France).
      </p>
      <div className="grid sm:grid-cols-2 gap-3 text-sm">
        <label className="block sm:col-span-2">
          <span className="text-xs font-medium text-gray-600">Nom complet</span>
          <input
            type="text"
            value={draft.personal.full_name}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                personal: { ...d.personal, full_name: e.target.value },
              }))
            }
            className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2"
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-xs font-medium text-gray-600">Adresse</span>
          <input
            type="text"
            value={draft.personal.address}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                personal: { ...d.personal, address: e.target.value },
              }))
            }
            className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-gray-600 inline-flex items-center gap-2">
            Code postal
            {postalBusy && (
              <span className="text-[10px] font-normal text-orange-600 tabular-nums">…</span>
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
            className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-gray-600">Ville</span>
          <input
            type="text"
            value={draft.personal.city}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                personal: { ...d.personal, city: e.target.value },
              }))
            }
            className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2"
            placeholder="Ex. Versailles"
            autoComplete="address-level2"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-gray-600">Email</span>
          <input
            type="email"
            value={draft.email}
            onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
            className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-gray-600">Téléphone</span>
          <input
            type="tel"
            value={draft.phone}
            onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))}
            className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2"
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
      <div className="space-y-3">
        <h3 className="font-semibold text-gray-900">Résumé professionnel</h3>
        <p className="text-xs text-gray-500">
          Texte d’accroche ou paragraphe « Profil » extrait par l’IA.
        </p>
        <textarea
          value={draft.professional_summary}
          onChange={(e) =>
            setDraft((d) => ({ ...d, professional_summary: e.target.value }))
          }
          rows={8}
          className="w-full rounded-xl border border-gray-200 p-3 text-sm text-gray-800"
          placeholder="Ex. Étudiant motivé, rigueur et sens du service client…"
        />
      </div>
    );
  }

  if (step === 2) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Expériences professionnelles</h3>
          <button
            type="button"
            onClick={() =>
              setDraft((d) => ({
                ...d,
                experience_items: [...d.experience_items, emptyExperience()],
              }))
            }
            className="text-xs font-semibold text-blue-600 hover:underline"
          >
            + Ajouter
          </button>
        </div>
        {draft.experience_items.map((exp, i) => (
          <div
            key={i}
            className="rounded-xl border border-gray-200 p-4 space-y-3 bg-gray-50/30"
          >
            <div className="flex justify-between items-center">
              <span className="text-xs font-semibold text-gray-500">Expérience #{i + 1}</span>
              {draft.experience_items.length > 1 && (
                <button
                  type="button"
                  className="text-red-500 text-lg leading-none p-1"
                  aria-label="Supprimer"
                  onClick={() =>
                    setDraft((d) => ({
                      ...d,
                      experience_items: d.experience_items.filter((_, j) => j !== i),
                    }))
                  }
                >
                  🗑
                </button>
              )}
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="block text-xs">
                <span className="text-gray-600">Poste</span>
                <input
                  value={exp.job_title}
                  onChange={(e) =>
                    setDraft((d) => {
                      const next = [...d.experience_items];
                      next[i] = { ...next[i], job_title: e.target.value };
                      return { ...d, experience_items: next };
                    })
                  }
                  className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
                />
              </label>
              <label className="block text-xs">
                <span className="text-gray-600">Entreprise</span>
                <input
                  value={exp.company}
                  onChange={(e) =>
                    setDraft((d) => {
                      const next = [...d.experience_items];
                      next[i] = { ...next[i], company: e.target.value };
                      return { ...d, experience_items: next };
                    })
                  }
                  className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
                />
              </label>
              <label className="block text-xs">
                <span className="text-gray-600">Date début</span>
                <input
                  value={exp.start_date}
                  onChange={(e) =>
                    setDraft((d) => {
                      const next = [...d.experience_items];
                      next[i] = { ...next[i], start_date: e.target.value };
                      return { ...d, experience_items: next };
                    })
                  }
                  className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
                />
              </label>
              <label className="block text-xs">
                <span className="text-gray-600">Date fin</span>
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
                  className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm disabled:bg-gray-100"
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
                className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
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
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Formations & diplômes</h3>
          <button
            type="button"
            onClick={() =>
              setDraft((d) => ({
                ...d,
                education_items: [...d.education_items, emptyEducation()],
              }))
            }
            className="text-xs font-semibold text-blue-600 hover:underline"
          >
            + Ajouter
          </button>
        </div>
        {draft.education_items.map((ed, i) => (
          <div
            key={i}
            className="rounded-xl border border-gray-200 p-4 space-y-3 bg-gray-50/30"
          >
            <div className="flex justify-between items-center">
              <span className="text-xs font-semibold text-gray-500">Formation #{i + 1}</span>
              {draft.education_items.length > 1 && (
                <button
                  type="button"
                  className="text-red-500 text-lg leading-none p-1"
                  aria-label="Supprimer"
                  onClick={() =>
                    setDraft((d) => ({
                      ...d,
                      education_items: d.education_items.filter((_, j) => j !== i),
                    }))
                  }
                >
                  🗑
                </button>
              )}
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="block text-xs sm:col-span-2">
                <span className="text-gray-600">Diplôme / cursus</span>
                <input
                  value={ed.diploma}
                  onChange={(e) =>
                    setDraft((d) => {
                      const next = [...d.education_items];
                      next[i] = { ...next[i], diploma: e.target.value };
                      return { ...d, education_items: next };
                    })
                  }
                  className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
                />
              </label>
              <label className="block text-xs sm:col-span-2">
                <span className="text-gray-600">Établissement</span>
                <input
                  value={ed.institution}
                  onChange={(e) =>
                    setDraft((d) => {
                      const next = [...d.education_items];
                      next[i] = { ...next[i], institution: e.target.value };
                      return { ...d, education_items: next };
                    })
                  }
                  className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
                />
              </label>
              <label className="block text-xs">
                <span className="text-gray-600">Début</span>
                <input
                  value={ed.start_date}
                  onChange={(e) =>
                    setDraft((d) => {
                      const next = [...d.education_items];
                      next[i] = { ...next[i], start_date: e.target.value };
                      return { ...d, education_items: next };
                    })
                  }
                  className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
                />
              </label>
              <label className="block text-xs">
                <span className="text-gray-600">Fin</span>
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
                  className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm disabled:bg-gray-100"
                />
              </label>
            </div>
            <label className="flex items-center gap-2 text-xs text-gray-700">
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
      <div className="space-y-3">
        <h3 className="font-semibold text-gray-900">Compétences</h3>
        <p className="text-xs text-gray-500">Hors langues vivantes — uniquement savoir-faire et outils.</p>
        <div className="flex gap-2 flex-wrap">
          <input
            type="text"
            value={skillDraft}
            onChange={(e) => setSkillDraft(e.target.value)}
            placeholder="Ajouter une compétence"
            className="flex-1 min-w-[160px] rounded-xl border border-gray-200 px-3 py-2 text-sm"
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
            className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium"
            onClick={() => {
              const t = skillDraft.trim();
              if (!t) return;
              setDraft((d) => ({ ...d, skills: [...d.skills, t] }));
              setSkillDraft("");
            }}
          >
            Ajouter
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {draft.skills.map((s, idx) => (
            <span
              key={`${idx}-${s}`}
              className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-full bg-blue-50 text-blue-800 border border-blue-100"
            >
              {s}
              <button
                type="button"
                className="text-blue-600 hover:text-red-600"
                onClick={() =>
                  setDraft((d) => ({ ...d, skills: d.skills.filter((x) => x !== s) }))
                }
                aria-label={`Retirer ${s}`}
              >
                ×
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
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Langues</h3>
          <button
            type="button"
            onClick={() =>
              setDraft((d) => ({
                ...d,
                language_items: [...d.language_items, emptyLanguage()],
              }))
            }
            className="text-xs font-semibold text-blue-600 hover:underline"
          >
            + Ajouter
          </button>
        </div>
        {draft.language_items.map((lang, i) => (
          <div key={i} className="flex flex-wrap gap-2 items-end">
            <label className="flex-1 min-w-[120px] text-xs">
              <span className="text-gray-600">Langue</span>
              <input
                value={lang.language}
                onChange={(e) =>
                  setDraft((d) => {
                    const next = [...d.language_items];
                    next[i] = { ...next[i], language: e.target.value };
                    return { ...d, language_items: next };
                  })
                }
                className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
              />
            </label>
            <label className="flex-1 min-w-[120px] text-xs">
              <span className="text-gray-600">Niveau</span>
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
                className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
              />
            </label>
            {draft.language_items.length > 1 && (
              <button
                type="button"
                className="text-red-500 mb-0.5 p-2"
                aria-label="Supprimer"
                onClick={() =>
                  setDraft((d) => ({
                    ...d,
                    language_items: d.language_items.filter((_, j) => j !== i),
                  }))
                }
              >
                🗑
              </button>
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-gray-900">Centres d’intérêt</h3>
      <div className="flex gap-2 flex-wrap">
        <input
          type="text"
          value={interestDraft}
          onChange={(e) => setInterestDraft(e.target.value)}
          placeholder="Ajouter un centre d’intérêt"
          className="flex-1 min-w-[160px] rounded-xl border border-gray-200 px-3 py-2 text-sm"
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
          className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium"
          onClick={() => {
            const t = interestDraft.trim();
            if (!t) return;
            setDraft((d) => ({ ...d, interests: [...d.interests, t] }));
            setInterestDraft("");
          }}
        >
          Ajouter
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {draft.interests.map((tag, idx) => (
          <span
            key={`${idx}-${tag}`}
            className="inline-flex items-center gap-1 text-xs px-3 py-1 rounded-full bg-gray-100 border border-gray-200"
          >
            {tag}
            <button
              type="button"
              className="text-gray-500 hover:text-red-600"
              onClick={() =>
                setDraft((d) => ({
                  ...d,
                  interests: d.interests.filter((x) => x !== tag),
                }))
              }
              aria-label={`Retirer ${tag}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}
