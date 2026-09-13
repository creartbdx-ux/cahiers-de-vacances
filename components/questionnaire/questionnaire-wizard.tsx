"use client"

import Link from "next/link"
import { useEffect, useMemo, useState, useTransition } from "react"
import { ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  submitQuestionnaireAction,
  uploadQuestionnairePhotoAction,
} from "@/app/(public)/questionnaire/actions"
import {
  AGE_BRACKETS,
  DIFFICULTY_OPTIONS,
  DUO_DYNAMICS_OPTIONS,
  DUO_TYPE_OPTIONS,
  GAME_TYPE_OPTIONS,
  MAX_GROUP_SIZE,
  MAX_PHOTOS,
  MIN_GROUP_SIZE,
  PERSONAL_FACT_CATEGORIES,
  PERSONALITY_TRAIT_OPTIONS,
  applyAudienceDefaults,
  calculateProfileRichness,
  createEmptyQuestionnaire,
  newId,
  stepsForAudience,
  validateStep,
  type AudienceType,
  type QuestionnaireParticipant,
  type QuestionnaireV1,
  type StepId,
} from "@/lib/questionnaire"
import {
  clearQuestionnaireDraft,
  loadQuestionnaireDraft,
  saveQuestionnaireDraft,
} from "@/lib/questionnaire/storage"
import type { Palette, Style, Universe } from "@/lib/supabase/types"

const AUDIENCE_OPTIONS: { value: AudienceType; label: string }[] = [
  { value: "ME", label: "Moi" },
  { value: "OTHER_PERSON", label: "Une autre personne" },
  { value: "DUO", label: "Deux personnes" },
  { value: "GROUP", label: "Un groupe d'amis" },
]

const STEP_LABELS: Record<StepId, string> = {
  audience: "Qui remplit ?",
  participants: "Participants",
  personality: "Personnalité",
  interests: "Centres d'intérêt",
  personalFacts: "Petits détails",
  memories: "Souvenirs",
  insideJokes: "Private jokes",
  games: "Jeux",
  photos: "Photos",
  forbidden: "Sujets à éviter",
  visual: "Style & couleur",
  finale: "Derniers détails",
  recap: "Récapitulatif",
}

export function QuestionnaireWizard({
  universes,
  palettes,
  styles,
  isAuthenticated,
}: {
  universes: Universe[]
  palettes: Palette[]
  styles: Style[]
  isAuthenticated: boolean
}) {
  const [q, setQ] = useState<QuestionnaireV1>(() => createEmptyQuestionnaire())
  const [hydrated, setHydrated] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const [errors, setErrors] = useState<string[]>([])
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitOk, setSubmitOk] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    const draft = loadQuestionnaireDraft()
    if (draft) setQ(draft)
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    saveQuestionnaireDraft(q)
  }, [q, hydrated])

  const steps = useMemo(() => stepsForAudience(q.audience), [q.audience])
  const step = steps[Math.min(stepIndex, steps.length - 1)] ?? "audience"
  const progress = ((stepIndex + 1) / steps.length) * 100
  const richness = calculateProfileRichness(q)

  function update(patch: Partial<QuestionnaireV1>) {
    setQ((prev) => applyAudienceDefaults({ ...prev, ...patch }))
    setErrors([])
    setSubmitError(null)
  }

  function goNext() {
    const errs = validateStep(step, q)
    if (errs.length) {
      setErrors(errs)
      return
    }
    setErrors([])
    setStepIndex((i) => Math.min(i + 1, steps.length - 1))
  }

  function goPrev() {
    setErrors([])
    setStepIndex((i) => Math.max(i - 1, 0))
  }

  function ensureParticipantsForAudience(audience: AudienceType) {
    setQ((prev) => {
      let participants = prev.participants
      if (audience === "ME" || audience === "OTHER_PERSON") {
        participants =
          participants.length === 1
            ? participants
            : [{ id: newId("p"), firstName: "", ageBracket: undefined }]
      } else if (audience === "DUO") {
        while (participants.length < 2) {
          participants = [...participants, { id: newId("p"), firstName: "" }]
        }
        participants = participants.slice(0, 2)
      } else if (audience === "GROUP") {
        while (participants.length < MIN_GROUP_SIZE) {
          participants = [...participants, { id: newId("p"), firstName: "" }]
        }
        if (participants.length > MAX_GROUP_SIZE) participants = participants.slice(0, MAX_GROUP_SIZE)
      }
      return applyAudienceDefaults({
        ...prev,
        audience,
        participants,
        creatorIsParticipant:
          audience === "ME" ? true : audience === "OTHER_PERSON" ? false : prev.creatorIsParticipant,
      })
    })
  }

  async function handleSubmit() {
    setSubmitError(null)
    setSubmitOk(null)
    if (!isAuthenticated) {
      setSubmitError("Connectez-vous pour enregistrer votre cahier.")
      return
    }
    startTransition(async () => {
      const result = await submitQuestionnaireAction(q)
      if (!result.ok) {
        setSubmitError(result.error)
        return
      }

      for (const photo of q.photos) {
        if (!photo.previewDataUrl || !photo.useAuthorized) continue
        const match = photo.previewDataUrl.match(/^data:([^;]+);base64,(.+)$/)
        if (!match) continue
        const upload = await uploadQuestionnairePhotoAction({
          projectId: result.projectId,
          photoId: photo.id,
          fileName: photo.fileName ?? `${photo.id}.jpg`,
          contentType: match[1],
          base64: match[2],
          caption: photo.caption,
          anecdote: photo.anecdote,
          useAuthorized: photo.useAuthorized,
        })
        if (!upload.ok) {
          setSubmitError(`Photo: ${upload.error}`)
          return
        }
      }

      clearQuestionnaireDraft()
      setSubmitOk(
        `Questionnaire enregistré (${result.richnessLevel}). Projet ${result.projectId.slice(0, 8)}… Aucune génération lancée.`,
      )
    })
  }

  if (!hydrated) {
    return <p className="text-muted-foreground">Chargement du questionnaire…</p>
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div>
        <div className="mb-2 flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Étape {stepIndex + 1} / {steps.length} — {STEP_LABELS[step]}
          </span>
          <span>{Math.round(progress)} %</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 sm:p-8">
        {step === "audience" && (
          <AudienceStep
            q={q}
            onAudience={(a) => {
              ensureParticipantsForAudience(a)
              setStepIndex(0)
            }}
            onCreator={(v) => update({ creatorIsParticipant: v })}
          />
        )}
        {step === "participants" && (
          <ParticipantsStep q={q} setQ={setQ} update={update} />
        )}
        {step === "personality" && <PersonalityStep q={q} setQ={setQ} />}
        {step === "interests" && (
          <InterestsStep q={q} update={update} universes={universes} />
        )}
        {step === "personalFacts" && <PersonalFactsStep q={q} setQ={setQ} />}
        {step === "memories" && <MemoriesStep q={q} setQ={setQ} />}
        {step === "insideJokes" && <InsideJokesStep q={q} setQ={setQ} />}
        {step === "games" && <GamesStep q={q} setQ={setQ} />}
        {step === "photos" && <PhotosStep q={q} setQ={setQ} />}
        {step === "forbidden" && <ForbiddenStep q={q} update={update} />}
        {step === "visual" && (
          <VisualStep q={q} update={update} palettes={palettes} styles={styles} />
        )}
        {step === "finale" && <FinaleStep q={q} update={update} />}
        {step === "recap" && (
          <RecapStep
            q={q}
            richness={richness}
            isAuthenticated={isAuthenticated}
            submitError={submitError}
            submitOk={submitOk}
            pending={pending}
            onSubmit={handleSubmit}
          />
        )}

        {errors.length > 0 && (
          <ul className="mt-4 list-disc space-y-1 rounded-lg border border-destructive/40 bg-destructive/10 p-3 pl-6 text-sm text-destructive">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button type="button" variant="outline" onClick={goPrev} disabled={stepIndex === 0}>
          <ChevronLeft className="size-4" />
          Précédent
        </Button>
        {step !== "recap" ? (
          <Button type="button" onClick={goNext}>
            Suivant
            <ChevronRight className="size-4" />
          </Button>
        ) : null}
      </div>
    </div>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 text-sm font-medium text-foreground">{children}</p>
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-sm transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background hover:bg-muted",
      )}
    >
      {children}
    </button>
  )
}

function AudienceStep({
  q,
  onAudience,
  onCreator,
}: {
  q: QuestionnaireV1
  onAudience: (a: AudienceType) => void
  onCreator: (v: boolean) => void
}) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-serif text-2xl font-semibold">Qui va remplir ce cahier ?</h2>
        <p className="mt-2 text-muted-foreground">Le parcours s&apos;adapte à votre réponse.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {AUDIENCE_OPTIONS.map((o) => (
          <Chip key={o.value} active={q.audience === o.value} onClick={() => onAudience(o.value)}>
            {o.label}
          </Chip>
        ))}
      </div>
      {(q.audience === "DUO" || q.audience === "GROUP") && (
        <div>
          <FieldLabel>Tu feras partie des personnes qui rempliront ce cahier ?</FieldLabel>
          <div className="flex gap-2">
            <Chip active={q.creatorIsParticipant === true} onClick={() => onCreator(true)}>
              Oui
            </Chip>
            <Chip active={q.creatorIsParticipant === false} onClick={() => onCreator(false)}>
              Non
            </Chip>
          </div>
        </div>
      )}
    </div>
  )
}

function ParticipantsStep({
  q,
  setQ,
  update,
}: {
  q: QuestionnaireV1
  setQ: React.Dispatch<React.SetStateAction<QuestionnaireV1>>
  update: (p: Partial<QuestionnaireV1>) => void
}) {
  function patchParticipant(i: number, patch: Partial<QuestionnaireParticipant>) {
    setQ((prev) => ({
      ...prev,
      participants: prev.participants.map((p, idx) => (idx === i ? { ...p, ...patch } : p)),
    }))
  }

  return (
    <div className="flex flex-col gap-5">
      <h2 className="font-serif text-2xl font-semibold">Les participants</h2>
      {q.audience === "DUO" && (
        <div>
          <FieldLabel>Quel type de duo êtes-vous ?</FieldLabel>
          <div className="flex flex-wrap gap-2">
            {DUO_TYPE_OPTIONS.map((o) => (
              <Chip key={o.value} active={q.duoType === o.value} onClick={() => update({ duoType: o.value })}>
                {o.label}
              </Chip>
            ))}
          </div>
        </div>
      )}
      {q.audience === "GROUP" && (
        <div>
          <FieldLabel>Nom de la bande (facultatif)</FieldLabel>
          <input
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
            value={q.groupName ?? ""}
            onChange={(e) => update({ groupName: e.target.value })}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={q.participants.length >= MAX_GROUP_SIZE}
              onClick={() =>
                setQ((prev) => ({
                  ...prev,
                  participants: [...prev.participants, { id: newId("p"), firstName: "" }],
                }))
              }
            >
              <Plus className="size-4" /> Ajouter
            </Button>
            <span className="text-sm text-muted-foreground">
              {q.participants.length} / {MAX_GROUP_SIZE} (min {MIN_GROUP_SIZE})
            </span>
          </div>
        </div>
      )}
      {q.participants.map((p, i) => (
        <div key={p.id} className="grid gap-3 rounded-xl border border-border p-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            Prénom *
            <input
              className="h-10 rounded-lg border border-input bg-background px-3"
              value={p.firstName}
              onChange={(e) => patchParticipant(i, { firstName: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Âge / tranche {q.audience === "GROUP" ? "(facultatif)" : "*"}
            <select
              className="h-10 rounded-lg border border-input bg-background px-3"
              value={p.ageBracket ?? ""}
              onChange={(e) =>
                patchParticipant(i, {
                  ageBracket: (e.target.value || undefined) as QuestionnaireParticipant["ageBracket"],
                })
              }
            >
              <option value="">—</option>
              {AGE_BRACKETS.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Surnom (facultatif)
            <input
              className="h-10 rounded-lg border border-input bg-background px-3"
              value={p.nickname ?? ""}
              onChange={(e) => patchParticipant(i, { nickname: e.target.value })}
            />
          </label>
          {q.audience === "OTHER_PERSON" && (
            <label className="flex flex-col gap-1 text-sm">
              Lien avec cette personne *
              <input
                className="h-10 rounded-lg border border-input bg-background px-3"
                value={p.relationship ?? ""}
                onChange={(e) => patchParticipant(i, { relationship: e.target.value })}
              />
            </label>
          )}
          {q.audience === "GROUP" && q.participants.length > MIN_GROUP_SIZE && (
            <button
              type="button"
              className="text-sm text-destructive"
              onClick={() =>
                setQ((prev) => ({
                  ...prev,
                  participants: prev.participants.filter((_, idx) => idx !== i),
                }))
              }
            >
              Retirer
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

function PersonalityStep({
  q,
  setQ,
}: {
  q: QuestionnaireV1
  setQ: React.Dispatch<React.SetStateAction<QuestionnaireV1>>
}) {
  const soloId = q.participants[0]?.id

  function toggleTrait(participantId: string, trait: string) {
    setQ((prev) => {
      const current = prev.personality.traitsByParticipantId[participantId] ?? []
      const next = current.includes(trait)
        ? current.filter((t) => t !== trait)
        : [...current, trait]
      return {
        ...prev,
        personality: {
          ...prev.personality,
          traitsByParticipantId: {
            ...prev.personality.traitsByParticipantId,
            [participantId]: next,
          },
        },
      }
    })
  }

  return (
    <div className="flex flex-col gap-5">
      <h2 className="font-serif text-2xl font-semibold">Personnalité</h2>
      {(q.audience === "ME" || q.audience === "OTHER_PERSON") && soloId && (
        <div>
          <FieldLabel>Traits (3 à 6) *</FieldLabel>
          <div className="flex flex-wrap gap-2">
            {PERSONALITY_TRAIT_OPTIONS.map((t) => (
              <Chip
                key={t}
                active={(q.personality.traitsByParticipantId[soloId] ?? []).includes(t)}
                onClick={() => toggleTrait(soloId, t)}
              >
                {t}
              </Chip>
            ))}
          </div>
          <label className="mt-4 flex flex-col gap-1 text-sm">
            Complément libre (facultatif)
            <textarea
              className="min-h-20 rounded-lg border border-input bg-background p-3"
              value={q.personality.freeText ?? ""}
              onChange={(e) =>
                setQ((prev) => ({
                  ...prev,
                  personality: { ...prev.personality, freeText: e.target.value },
                }))
              }
            />
          </label>
        </div>
      )}
      {q.audience === "DUO" && (
        <>
          <label className="flex flex-col gap-1 text-sm">
            Description commune du duo *
            <textarea
              className="min-h-20 rounded-lg border border-input bg-background p-3"
              value={q.personality.duoDescription ?? ""}
              onChange={(e) =>
                setQ((prev) => ({
                  ...prev,
                  personality: { ...prev.personality, duoDescription: e.target.value },
                }))
              }
            />
          </label>
          <div>
            <FieldLabel>Dynamique (au moins 2) *</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {DUO_DYNAMICS_OPTIONS.map((t) => {
                const active = q.personality.duoDynamics?.includes(t) ?? false
                return (
                  <Chip
                    key={t}
                    active={active}
                    onClick={() =>
                      setQ((prev) => {
                        const cur = prev.personality.duoDynamics ?? []
                        return {
                          ...prev,
                          personality: {
                            ...prev.personality,
                            duoDynamics: active ? cur.filter((x) => x !== t) : [...cur, t],
                          },
                        }
                      })
                    }
                  >
                    {t}
                  </Chip>
                )
              })}
            </div>
          </div>
          {q.participants.map((p) => (
            <div key={p.id}>
              <FieldLabel>Traits pour {p.firstName || "participant"} (2–3 recommandés)</FieldLabel>
              <div className="flex flex-wrap gap-2">
                {PERSONALITY_TRAIT_OPTIONS.slice(0, 10).map((t) => (
                  <Chip
                    key={t}
                    active={(q.personality.traitsByParticipantId[p.id] ?? []).includes(t)}
                    onClick={() => toggleTrait(p.id, t)}
                  >
                    {t}
                  </Chip>
                ))}
              </div>
            </div>
          ))}
        </>
      )}
      {q.audience === "GROUP" && (
        <>
          <div>
            <FieldLabel>Caractéristiques du groupe (3 à 5) *</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {PERSONALITY_TRAIT_OPTIONS.map((t) => {
                const active = q.personality.groupTraits?.includes(t) ?? false
                return (
                  <Chip
                    key={t}
                    active={active}
                    onClick={() =>
                      setQ((prev) => {
                        const cur = prev.personality.groupTraits ?? []
                        return {
                          ...prev,
                          personality: {
                            ...prev.personality,
                            groupTraits: active ? cur.filter((x) => x !== t) : [...cur, t],
                          },
                        }
                      })
                    }
                  >
                    {t}
                  </Chip>
                )
              })}
            </div>
          </div>
          {q.participants.map((p, i) => (
            <label key={p.id} className="flex flex-col gap-1 text-sm">
              Trait court pour {p.firstName || `participant ${i + 1}`} (facultatif)
              <input
                className="h-10 rounded-lg border border-input bg-background px-3"
                placeholder="ex. toujours en retard"
                value={p.personalTrait ?? ""}
                onChange={(e) =>
                  setQ((prev) => ({
                    ...prev,
                    participants: prev.participants.map((x, idx) =>
                      idx === i ? { ...x, personalTrait: e.target.value } : x,
                    ),
                  }))
                }
              />
            </label>
          ))}
        </>
      )}
    </div>
  )
}

function InterestsStep({
  q,
  update,
  universes,
}: {
  q: QuestionnaireV1
  update: (p: Partial<QuestionnaireV1>) => void
  universes: Universe[]
}) {
  return (
    <div className="flex flex-col gap-5">
      <h2 className="font-serif text-2xl font-semibold">
        {q.audience === "DUO" || q.audience === "GROUP"
          ? "Centres d'intérêt communs"
          : "Ce qu'ils aiment"}
      </h2>
      <p className="text-sm text-muted-foreground">Choisissez au moins 3 univers.</p>
      <div className="flex flex-wrap gap-2">
        {universes.map((u) => {
          const active = q.interestUniverseIds.includes(u.id)
          return (
            <Chip
              key={u.id}
              active={active}
              onClick={() =>
                update({
                  interestUniverseIds: active
                    ? q.interestUniverseIds.filter((id) => id !== u.id)
                    : [...q.interestUniverseIds, u.id],
                })
              }
            >
              {u.name}
            </Chip>
          )
        })}
      </div>
      <label className="flex flex-col gap-1 text-sm">
        Autres passions (facultatif)
        <input
          className="h-10 rounded-lg border border-input bg-background px-3"
          value={q.interestFreeText ?? ""}
          onChange={(e) => update({ interestFreeText: e.target.value })}
        />
      </label>
    </div>
  )
}

function PersonalFactsStep({
  q,
  setQ,
}: {
  q: QuestionnaireV1
  setQ: React.Dispatch<React.SetStateAction<QuestionnaireV1>>
}) {
  return (
    <div className="flex flex-col gap-5">
      <h2 className="font-serif text-2xl font-semibold">Petites informations personnelles</h2>
      <p className="text-sm text-muted-foreground">Minimum 3, idéal 5–8, maximum 15.</p>
      {q.personalFacts.map((f, i) => (
        <div key={f.id} className="flex flex-col gap-2 rounded-xl border border-border p-3">
          <div className="flex gap-2">
            <select
              className="h-10 rounded-lg border border-input bg-background px-2 text-sm"
              value={f.category}
              onChange={(e) =>
                setQ((prev) => ({
                  ...prev,
                  personalFacts: prev.personalFacts.map((x, idx) =>
                    idx === i
                      ? { ...x, category: e.target.value as typeof f.category }
                      : x,
                  ),
                }))
              }
            >
              {PERSONAL_FACT_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
            <input
              className="h-10 flex-1 rounded-lg border border-input bg-background px-3 text-sm"
              value={f.value}
              onChange={(e) =>
                setQ((prev) => ({
                  ...prev,
                  personalFacts: prev.personalFacts.map((x, idx) =>
                    idx === i ? { ...x, value: e.target.value } : x,
                  ),
                }))
              }
              placeholder="Valeur"
            />
            <button
              type="button"
              onClick={() =>
                setQ((prev) => ({
                  ...prev,
                  personalFacts: prev.personalFacts.filter((_, idx) => idx !== i),
                }))
              }
            >
              <Trash2 className="size-4 text-muted-foreground" />
            </button>
          </div>
          {(q.audience === "DUO" || q.audience === "GROUP") && (
            <div className="flex flex-wrap gap-2">
              {q.participants.map((p) => {
                const active = f.participantIds?.includes(p.id) ?? false
                return (
                  <Chip
                    key={p.id}
                    active={active}
                    onClick={() =>
                      setQ((prev) => ({
                        ...prev,
                        personalFacts: prev.personalFacts.map((x, idx) => {
                          if (idx !== i) return x
                          const ids = x.participantIds ?? []
                          return {
                            ...x,
                            participantIds: active
                              ? ids.filter((id) => id !== p.id)
                              : [...ids, p.id],
                          }
                        }),
                      }))
                    }
                  >
                    {p.firstName || "?"}
                  </Chip>
                )
              })}
              <span className="text-xs text-muted-foreground self-center">
                (vide = tout le monde)
              </span>
            </div>
          )}
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() =>
          setQ((prev) => ({
            ...prev,
            personalFacts: [
              ...prev.personalFacts,
              { id: newId("f"), category: "OTHER", value: "" },
            ],
          }))
        }
      >
        <Plus className="size-4" /> Ajouter une information
      </Button>
    </div>
  )
}

function MemoriesStep({
  q,
  setQ,
}: {
  q: QuestionnaireV1
  setQ: React.Dispatch<React.SetStateAction<QuestionnaireV1>>
}) {
  const prompts =
    q.audience === "DUO"
      ? ["Rencontre", "Souvenir marquant", "Voyage", "Anecdote drôle", "Habitude commune"]
      : q.audience === "GROUP"
        ? ["Souvenir culte", "Voyage", "Soirée", "Anecdote drôle", "Tradition", "Private joke"]
        : ["Souvenir marquant", "Anecdote drôle", "Voyage"]

  return (
    <div className="flex flex-col gap-5">
      <h2 className="font-serif text-2xl font-semibold">Souvenirs & anecdotes</h2>
      <p className="text-sm text-muted-foreground">
        Facultatif mais recommandé. Suggestions : {prompts.join(", ")}.
      </p>
      {q.memories.map((m, i) => (
        <div key={m.id} className="flex flex-col gap-2 rounded-xl border border-border p-3">
          <input
            className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
            placeholder="Titre (facultatif)"
            value={m.title ?? ""}
            onChange={(e) =>
              setQ((prev) => ({
                ...prev,
                memories: prev.memories.map((x, idx) =>
                  idx === i ? { ...x, title: e.target.value } : x,
                ),
              }))
            }
          />
          <textarea
            className="min-h-20 rounded-lg border border-input bg-background p-3 text-sm"
            placeholder="Récit *"
            value={m.text}
            onChange={(e) =>
              setQ((prev) => ({
                ...prev,
                memories: prev.memories.map((x, idx) =>
                  idx === i ? { ...x, text: e.target.value } : x,
                ),
              }))
            }
          />
          <input
            className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
            placeholder="Lieu (facultatif)"
            value={m.place ?? ""}
            onChange={(e) =>
              setQ((prev) => ({
                ...prev,
                memories: prev.memories.map((x, idx) =>
                  idx === i ? { ...x, place: e.target.value } : x,
                ),
              }))
            }
          />
          <button
            type="button"
            className="self-start text-sm text-destructive"
            onClick={() =>
              setQ((prev) => ({
                ...prev,
                memories: prev.memories.filter((_, idx) => idx !== i),
              }))
            }
          >
            Supprimer
          </button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() =>
          setQ((prev) => ({
            ...prev,
            memories: [...prev.memories, { id: newId("m"), text: "" }],
          }))
        }
      >
        <Plus className="size-4" /> Ajouter un souvenir
      </Button>
    </div>
  )
}

function InsideJokesStep({
  q,
  setQ,
}: {
  q: QuestionnaireV1
  setQ: React.Dispatch<React.SetStateAction<QuestionnaireV1>>
}) {
  return (
    <div className="flex flex-col gap-5">
      <h2 className="font-serif text-2xl font-semibold">Private jokes & habitudes</h2>
      <p className="text-sm text-muted-foreground">Facultatif — expressions, blagues internes…</p>
      {q.insideJokes.map((j, i) => (
        <div key={j.id} className="flex gap-2">
          <input
            className="h-10 flex-1 rounded-lg border border-input bg-background px-3 text-sm"
            value={j.text}
            onChange={(e) =>
              setQ((prev) => ({
                ...prev,
                insideJokes: prev.insideJokes.map((x, idx) =>
                  idx === i ? { ...x, text: e.target.value } : x,
                ),
              }))
            }
          />
          <button
            type="button"
            onClick={() =>
              setQ((prev) => ({
                ...prev,
                insideJokes: prev.insideJokes.filter((_, idx) => idx !== i),
              }))
            }
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() =>
          setQ((prev) => ({
            ...prev,
            insideJokes: [...prev.insideJokes, { id: newId("j"), text: "" }],
          }))
        }
      >
        <Plus className="size-4" /> Ajouter
      </Button>
    </div>
  )
}

function GamesStep({
  q,
  setQ,
}: {
  q: QuestionnaireV1
  setQ: React.Dispatch<React.SetStateAction<QuestionnaireV1>>
}) {
  const liked = q.gamePreferences.likedTypes ?? []
  const disliked = q.gamePreferences.dislikedTypes ?? []

  return (
    <div className="flex flex-col gap-5">
      <h2 className="font-serif text-2xl font-semibold">Jeux</h2>
      <div>
        <FieldLabel>Quels types de jeux aimez-vous ? *</FieldLabel>
        <div className="flex flex-wrap gap-2">
          {GAME_TYPE_OPTIONS.map((o) => (
            <Chip
              key={o.value}
              active={liked.includes(o.value)}
              onClick={() =>
                setQ((prev) => {
                  const cur = prev.gamePreferences.likedTypes ?? []
                  return {
                    ...prev,
                    gamePreferences: {
                      ...prev.gamePreferences,
                      likedTypes: cur.includes(o.value)
                        ? cur.filter((x) => x !== o.value)
                        : [...cur, o.value],
                    },
                  }
                })
              }
            >
              {o.label}
            </Chip>
          ))}
        </div>
      </div>
      <div>
        <FieldLabel>Niveau *</FieldLabel>
        <div className="flex flex-wrap gap-2">
          {DIFFICULTY_OPTIONS.map((o) => (
            <Chip
              key={o.value}
              active={q.gamePreferences.difficulty === o.value}
              onClick={() =>
                setQ((prev) => ({
                  ...prev,
                  gamePreferences: { ...prev.gamePreferences, difficulty: o.value },
                }))
              }
            >
              {o.label}
            </Chip>
          ))}
        </div>
      </div>
      <div>
        <FieldLabel>À éviter (facultatif)</FieldLabel>
        <div className="flex flex-wrap gap-2">
          {GAME_TYPE_OPTIONS.map((o) => (
            <Chip
              key={o.value}
              active={disliked.includes(o.value)}
              onClick={() =>
                setQ((prev) => {
                  const cur = prev.gamePreferences.dislikedTypes ?? []
                  return {
                    ...prev,
                    gamePreferences: {
                      ...prev.gamePreferences,
                      dislikedTypes: cur.includes(o.value)
                        ? cur.filter((x) => x !== o.value)
                        : [...cur, o.value],
                    },
                  }
                })
              }
            >
              {o.label}
            </Chip>
          ))}
        </div>
      </div>
    </div>
  )
}

function PhotosStep({
  q,
  setQ,
}: {
  q: QuestionnaireV1
  setQ: React.Dispatch<React.SetStateAction<QuestionnaireV1>>
}) {
  return (
    <div className="flex flex-col gap-5">
      <h2 className="font-serif text-2xl font-semibold">Photos</h2>
      <p className="rounded-lg bg-muted/60 p-3 text-sm text-muted-foreground">
        Les photos sont totalement facultatives. Votre cahier sera entièrement conçu même si vous
        n&apos;en ajoutez aucune. Maximum {MAX_PHOTOS}.
      </p>
      {q.photos.map((photo, i) => (
        <div key={photo.id} className="flex flex-col gap-2 rounded-xl border border-border p-3">
          {photo.previewDataUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo.previewDataUrl} alt="" className="h-28 w-auto rounded-lg object-cover" />
          )}
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (!file) return
              const reader = new FileReader()
              reader.onload = () => {
                setQ((prev) => ({
                  ...prev,
                  photos: prev.photos.map((x, idx) =>
                    idx === i
                      ? {
                          ...x,
                          previewDataUrl: String(reader.result),
                          fileName: file.name,
                        }
                      : x,
                  ),
                }))
              }
              reader.readAsDataURL(file)
            }}
          />
          <input
            className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
            placeholder="Légende"
            value={photo.caption ?? ""}
            onChange={(e) =>
              setQ((prev) => ({
                ...prev,
                photos: prev.photos.map((x, idx) =>
                  idx === i ? { ...x, caption: e.target.value } : x,
                ),
              }))
            }
          />
          <input
            className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
            placeholder="Anecdote"
            value={photo.anecdote ?? ""}
            onChange={(e) =>
              setQ((prev) => ({
                ...prev,
                photos: prev.photos.map((x, idx) =>
                  idx === i ? { ...x, anecdote: e.target.value } : x,
                ),
              }))
            }
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={photo.useAuthorized}
              onChange={(e) =>
                setQ((prev) => ({
                  ...prev,
                  photos: prev.photos.map((x, idx) =>
                    idx === i ? { ...x, useAuthorized: e.target.checked } : x,
                  ),
                }))
              }
            />
            J&apos;autorise l&apos;usage de cette photo dans le cahier *
          </label>
          <button
            type="button"
            className="self-start text-sm text-destructive"
            onClick={() =>
              setQ((prev) => ({
                ...prev,
                photos: prev.photos.filter((_, idx) => idx !== i),
              }))
            }
          >
            Supprimer
          </button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={q.photos.length >= MAX_PHOTOS}
        onClick={() =>
          setQ((prev) => ({
            ...prev,
            photos: [...prev.photos, { id: newId("ph"), useAuthorized: false }],
          }))
        }
      >
        <Plus className="size-4" /> Ajouter une photo
      </Button>
    </div>
  )
}

function ForbiddenStep({
  q,
  update,
}: {
  q: QuestionnaireV1
  update: (p: Partial<QuestionnaireV1>) => void
}) {
  const ft = q.forbiddenTopics
  return (
    <div className="flex flex-col gap-5">
      <h2 className="font-serif text-2xl font-semibold">Sujets à éviter</h2>
      <p className="text-muted-foreground">
        Y a-t-il des sujets, personnes ou événements que le cahier ne doit jamais évoquer ?
      </p>
      <div className="flex gap-2">
        <Chip
          active={ft?.answered === true && ft.hasRestrictions === false}
          onClick={() =>
            update({ forbiddenTopics: { answered: true, hasRestrictions: false } })
          }
        >
          Rien à signaler
        </Chip>
        <Chip
          active={ft?.answered === true && ft.hasRestrictions === true}
          onClick={() =>
            update({
              forbiddenTopics: {
                answered: true,
                hasRestrictions: true,
                text: ft?.text ?? "",
                peopleToAvoid: ft?.peopleToAvoid,
              },
            })
          }
        >
          Oui
        </Chip>
      </div>
      {ft?.hasRestrictions && (
        <>
          <textarea
            className="min-h-24 rounded-lg border border-input bg-background p-3 text-sm"
            placeholder="Précisez les sujets à éviter *"
            value={ft.text ?? ""}
            onChange={(e) =>
              update({
                forbiddenTopics: { ...ft, answered: true, text: e.target.value },
              })
            }
          />
          <input
            className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
            placeholder="Personnes à éviter (facultatif)"
            value={ft.peopleToAvoid ?? ""}
            onChange={(e) =>
              update({
                forbiddenTopics: { ...ft, answered: true, peopleToAvoid: e.target.value },
              })
            }
          />
        </>
      )}
    </div>
  )
}

function VisualStep({
  q,
  update,
  palettes,
  styles,
}: {
  q: QuestionnaireV1
  update: (p: Partial<QuestionnaireV1>) => void
  palettes: Palette[]
  styles: Style[]
}) {
  return (
    <div className="flex flex-col gap-6">
      <h2 className="font-serif text-2xl font-semibold">Style & couleur</h2>
      <div>
        <FieldLabel>Palette *</FieldLabel>
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() =>
              update({
                visualPreferences: { ...q.visualPreferences, paletteId: "AUTO" },
              })
            }
            className={cn(
              "rounded-xl border p-3 text-left text-sm",
              q.visualPreferences.paletteId === "AUTO"
                ? "border-primary ring-2 ring-primary/30"
                : "border-border",
            )}
          >
            AUTO — on choisit pour vous
          </button>
          {palettes.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() =>
                update({
                  visualPreferences: { ...q.visualPreferences, paletteId: p.id },
                })
              }
              className={cn(
                "rounded-xl border p-3 text-left",
                q.visualPreferences.paletteId === p.id
                  ? "border-primary ring-2 ring-primary/30"
                  : "border-border",
              )}
            >
              <div className="mb-2 flex h-6 overflow-hidden rounded-md">
                <span className="flex-1" style={{ backgroundColor: p.primary_color }} />
                <span className="flex-1" style={{ backgroundColor: p.secondary_color }} />
                <span className="flex-1" style={{ backgroundColor: p.accent_color }} />
                <span className="flex-1" style={{ backgroundColor: p.background_color }} />
              </div>
              <p className="text-sm font-medium">{p.name}</p>
            </button>
          ))}
        </div>
      </div>
      <div>
        <FieldLabel>Style *</FieldLabel>
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() =>
              update({ visualPreferences: { ...q.visualPreferences, styleId: "AUTO" } })
            }
            className={cn(
              "rounded-xl border p-3 text-left text-sm",
              q.visualPreferences.styleId === "AUTO"
                ? "border-primary ring-2 ring-primary/30"
                : "border-border",
            )}
          >
            AUTO — on choisit pour vous
          </button>
          {styles.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() =>
                update({ visualPreferences: { ...q.visualPreferences, styleId: s.id } })
              }
              className={cn(
                "rounded-xl border p-3 text-left",
                q.visualPreferences.styleId === s.id
                  ? "border-primary ring-2 ring-primary/30"
                  : "border-border",
              )}
            >
              <p className="text-sm font-medium">{s.name}</p>
              {s.description && (
                <p className="mt-1 text-xs text-muted-foreground line-clamp-3">{s.description}</p>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function FinaleStep({
  q,
  update,
}: {
  q: QuestionnaireV1
  update: (p: Partial<QuestionnaireV1>) => void
}) {
  return (
    <div className="flex flex-col gap-5">
      <h2 className="font-serif text-2xl font-semibold">Derniers détails</h2>
      <label className="flex flex-col gap-1 text-sm">
        Souhaites-tu ajouter un petit message dans le cahier ? (facultatif)
        <textarea
          className="min-h-24 rounded-lg border border-input bg-background p-3"
          value={q.finalMessage ?? ""}
          onChange={(e) => update({ finalMessage: e.target.value })}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Une dernière chose que nous devrions savoir ? (facultatif)
        <textarea
          className="min-h-20 rounded-lg border border-input bg-background p-3"
          value={q.lastNote ?? ""}
          onChange={(e) => update({ lastNote: e.target.value })}
        />
      </label>
    </div>
  )
}

function RecapStep({
  q,
  richness,
  isAuthenticated,
  submitError,
  submitOk,
  pending,
  onSubmit,
}: {
  q: QuestionnaireV1
  richness: ReturnType<typeof calculateProfileRichness>
  isAuthenticated: boolean
  submitError: string | null
  submitOk: string | null
  pending: boolean
  onSubmit: () => void
}) {
  return (
    <div className="flex flex-col gap-5">
      <h2 className="font-serif text-2xl font-semibold">Récapitulatif</h2>
      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Audience</dt>
          <dd className="font-medium">{q.audience}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Participants</dt>
          <dd className="font-medium">
            {q.participants.map((p) => p.firstName).filter(Boolean).join(", ") || "—"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Intérêts</dt>
          <dd className="font-medium">{q.interestUniverseIds.length}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Infos personnelles</dt>
          <dd className="font-medium">{q.personalFacts.filter((f) => f.value.trim()).length}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Difficulté</dt>
          <dd className="font-medium">{q.gamePreferences.difficulty ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Style / palette</dt>
          <dd className="font-medium">
            {q.visualPreferences.styleId ?? "—"} / {q.visualPreferences.paletteId ?? "—"}
          </dd>
        </div>
      </dl>

      <div
        className={cn(
          "rounded-xl border p-4 text-sm",
          richness.level === "INSUFFICIENT"
            ? "border-destructive/40 bg-destructive/10 text-destructive"
            : "border-border bg-muted/40 text-foreground",
        )}
      >
        <p className="font-medium">Niveau : {richness.level}</p>
        <p className="mt-1 opacity-90">{richness.message}</p>
      </div>

      {!isAuthenticated && (
        <p className="text-sm text-muted-foreground">
          Pour enregistrer,{" "}
          <Link href="/auth/login?next=/questionnaire" className="underline">
            connectez-vous
          </Link>{" "}
          (votre brouillon local est conservé).
        </p>
      )}

      {submitError && <p className="text-sm text-destructive">{submitError}</p>}
      {submitOk && <p className="text-sm text-chart-4">{submitOk}</p>}

      <Button type="button" onClick={onSubmit} disabled={pending || richness.level === "INSUFFICIENT"}>
        {pending ? "Enregistrement…" : "Valider le questionnaire"}
      </Button>
      <p className="text-xs text-muted-foreground">
        Aucune page, moteur de jeu ou IA ne sera lancé à cette étape.
      </p>
    </div>
  )
}
