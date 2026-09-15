"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import { ChevronLeft, ChevronRight, Plus, Trash2, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { StylePreview } from "@/components/questionnaire/style-preview"
import { cn } from "@/lib/utils"
import {
  claimLocalDraftAction,
  deleteBookPhotoAction,
  registerBookPhotoAction,
  saveQuestionnaireDraftAction,
  submitQuestionnaireAction,
} from "@/app/(public)/questionnaire/actions"
import {
  AGE_BRACKETS,
  AUDIENCE_OPTIONS,
  DIFFICULTY_OPTIONS,
  DUO_DYNAMICS_OPTIONS,
  DUO_TYPE_OPTIONS,
  GAME_TYPE_OPTIONS,
  GROUP_TRAIT_OPTIONS,
  MAX_GROUP_SIZE,
  MAX_PHOTOS,
  MIN_GROUP_SIZE,
  PERSONAL_FACT_CATEGORIES,
  PERSONALITY_TRAIT_OPTIONS,
  PHOTO_UPLOAD_USER_ERROR,
  applyAudienceDefaults,
  audienceHumanLabel,
  buildJourneySteps,
  calculateProfileRichness,
  clearGroupParticularity,
  countRecapPhotos,
  createEmptyQuestionnaire,
  difficultyLabel,
  getStepCopy,
  hasPhotosUploading,
  allPhotosSaved,
  photoUploadBannerCopy,
  photoUploadBannerMessage,
  isPhotoPersisted,
  listGroupParticularities,
  memorySuggestions,
  newId,
  richnessClientMessage,
  truncateTagList,
  validatePhotoFile,
  validateStep,
  type AudienceType,
  type QuestionnaireParticipant,
  type QuestionnairePhoto,
  type QuestionnaireV1,
  type StepId,
} from "@/lib/questionnaire"
import {
  clearAllPhotoFiles,
  clearPhotoFile,
  ensurePhotoObjectUrl,
  getPhotoFile,
  getPhotoObjectUrl,
  hasPhotoFile,
  setPhotoFile,
  snapshotPhotoFile,
} from "@/lib/questionnaire/photo-files"
import {
  clearQuestionnaireDraft,
  loadQuestionnaireDraft,
  saveQuestionnaireDraft,
} from "@/lib/questionnaire/storage"
import { uploadBookPhotoFile } from "@/lib/questionnaire/upload-book-photo"
import { decidePhotoUploadAction } from "@/lib/questionnaire/photo-pipeline"
import { createClient } from "@/lib/supabase/client"
import type { Palette, Style, Universe } from "@/lib/supabase/types"

export function QuestionnaireWizard({
  universes,
  palettes,
  styles,
  isAuthenticated,
  initialQuestionnaire = null,
  projectStatus = null,
  claimLocalDraft = false,
  readOnly = false,
}: {
  universes: Universe[]
  palettes: Palette[]
  styles: Style[]
  isAuthenticated: boolean
  /** Prefill from Supabase project (continues draft). */
  initialQuestionnaire?: QuestionnaireV1 | null
  projectStatus?: string | null
  /** After login: push localStorage draft into Supabase. */
  claimLocalDraft?: boolean
  readOnly?: boolean
}) {
  const [q, setQ] = useState<QuestionnaireV1>(() => initialQuestionnaire ?? createEmptyQuestionnaire())
  const [hydrated, setHydrated] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const [errors, setErrors] = useState<string[]>([])
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitOk, setSubmitOk] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [manualSaveFlash, setManualSaveFlash] = useState(false)
  const [manualSaving, setManualSaving] = useState(false)
  const [photoSavedFlash, setPhotoSavedFlash] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedJson = useRef<string>("")
  const projectEnsurePromise = useRef<Promise<string | null> | null>(null)
  const draftProjectIdRef = useRef<string | null>(initialQuestionnaire?.draftProjectId ?? null)
  /** True while manual draft save is running or showing its success flash. */
  const manualSaveActiveRef = useRef(false)
  const wasPhotosUploadingRef = useRef(false)
  const manualSaveFlashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const photoSavedFlashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const completed = projectStatus === "QUESTIONNAIRE_COMPLETED" || readOnly

  useEffect(() => {
    let cancelled = false
    async function hydrate() {
      if (initialQuestionnaire) {
        if (!cancelled) {
          setQ(initialQuestionnaire)
          saveQuestionnaireDraft(initialQuestionnaire)
          setHydrated(true)
        }
        return
      }

      const local = loadQuestionnaireDraft()

      if (claimLocalDraft && isAuthenticated && local) {
        const claimed = await claimLocalDraftAction(local)
        if (!cancelled && claimed.ok) {
          setQ(claimed.questionnaire)
          saveQuestionnaireDraft(claimed.questionnaire)
          setSaveState("saved")
          setSaveMessage("Brouillon rattaché à votre compte.")
          setHydrated(true)
          return
        }
      }

      if (!cancelled) {
        if (local) setQ(local)
        setHydrated(true)
      }
    }
    void hydrate()
    return () => {
      cancelled = true
    }
  }, [initialQuestionnaire, claimLocalDraft, isAuthenticated])

  useEffect(() => {
    if (!hydrated || completed) return
    saveQuestionnaireDraft(q)
  }, [q, hydrated, completed])

  useEffect(() => {
    draftProjectIdRef.current = q.draftProjectId ?? null
  }, [q.draftProjectId])

  // Debounced Supabase autosave when authenticated
  useEffect(() => {
    if (!hydrated || !isAuthenticated || completed) return
    const json = JSON.stringify({
      ...q,
      photos: q.photos.map(({ previewDataUrl: _, ...rest }) => rest),
    })
    if (json === lastSavedJson.current) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      void (async () => {
        // Don't start autosave UI while a manual save is in progress / flashing.
        if (manualSaveActiveRef.current) return
        setSaveState("saving")
        setSaveMessage(null)
        const result = await saveQuestionnaireDraftAction(q)
        // Re-read after await (avoid TS narrowing on ref.current across the gap).
        const manualTookOver = manualSaveActiveRef.current
        if (manualTookOver) {
          if (result.ok) {
            lastSavedJson.current = json
            if (!q.draftProjectId || q.draftProjectId !== result.projectId) {
              setQ((prev) => ({ ...prev, draftProjectId: result.projectId }))
            }
          }
          return
        }
        if (!result.ok) {
          if (result.code === "AUTH_REQUIRED") {
            setSaveState("idle")
            return
          }
          setSaveState("error")
          setSaveMessage(result.error)
          return
        }
        lastSavedJson.current = json
        if (!q.draftProjectId || q.draftProjectId !== result.projectId) {
          setQ((prev) => ({ ...prev, draftProjectId: result.projectId }))
        }
        setSaveState("saved")
        setSaveMessage(null)
      })()
    }, 1600)
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [q, hydrated, isAuthenticated, completed])

  const photosUploading = hasPhotosUploading(q.photos)
  const photosAllSaved = allPhotosSaved(q.photos)
  const photoBannerKind = photoUploadBannerMessage({
    uploading: photosUploading,
    allSaved: photosAllSaved,
    showSavedFlash: photoSavedFlash,
  })

  useEffect(() => {
    if (photosUploading) {
      wasPhotosUploadingRef.current = true
      setPhotoSavedFlash(false)
      if (photoSavedFlashTimer.current) clearTimeout(photoSavedFlashTimer.current)
      // Clear any stale red validation leftovers from older builds.
      setErrors((prev) => prev.filter((e) => !/patientez|enregistrement des photos/i.test(e)))
      return
    }
    if (wasPhotosUploadingRef.current && photosAllSaved) {
      wasPhotosUploadingRef.current = false
      setPhotoSavedFlash(true)
      if (photoSavedFlashTimer.current) clearTimeout(photoSavedFlashTimer.current)
      photoSavedFlashTimer.current = setTimeout(() => setPhotoSavedFlash(false), 3000)
    }
  }, [photosUploading, photosAllSaved])

  useEffect(() => {
    return () => {
      if (manualSaveFlashTimer.current) clearTimeout(manualSaveFlashTimer.current)
      if (photoSavedFlashTimer.current) clearTimeout(photoSavedFlashTimer.current)
    }
  }, [])

  const steps = useMemo(
    () => buildJourneySteps(q.audience, q.creatorIsParticipant),
    [q.audience, q.creatorIsParticipant],
  )
  const safeIndex = Math.min(stepIndex, steps.length - 1)
  const step = steps[safeIndex] ?? "audience"
  const copy = getStepCopy(step, q)
  const progress = ((safeIndex + 1) / steps.length) * 100
  const richness = calculateProfileRichness(q)

  useEffect(() => {
    if (stepIndex > steps.length - 1) setStepIndex(steps.length - 1)
  }, [steps.length, stepIndex])

  function update(patch: Partial<QuestionnaireV1>) {
    if (completed) return
    setQ((prev) => applyAudienceDefaults({ ...prev, ...patch }))
    setErrors([])
    setSubmitError(null)
  }

  function saveDraftNow() {
    if (!isAuthenticated) {
      const next = encodeURIComponent("/questionnaire?claim=1")
      window.location.href = `/auth/login?next=${next}`
      return
    }
    startTransition(async () => {
      manualSaveActiveRef.current = true
      setManualSaving(true)
      setSaveState("saving")
      setSaveMessage(null)
      setManualSaveFlash(false)
      const result = await saveQuestionnaireDraftAction(q)
      if (!result.ok) {
        manualSaveActiveRef.current = false
        setManualSaving(false)
        setSaveState("error")
        setSaveMessage(result.error)
        return
      }
      setQ((prev) => ({ ...prev, draftProjectId: result.projectId }))
      lastSavedJson.current = JSON.stringify({
        ...q,
        draftProjectId: result.projectId,
        photos: q.photos.map(({ previewDataUrl: _, ...rest }) => rest),
      })
      setManualSaving(false)
      setSaveState("saved")
      setSaveMessage("Brouillon enregistré")
      setManualSaveFlash(true)
      if (manualSaveFlashTimer.current) clearTimeout(manualSaveFlashTimer.current)
      manualSaveFlashTimer.current = setTimeout(() => {
        setManualSaveFlash(false)
        manualSaveActiveRef.current = false
      }, 3500)
    })
  }

  function goToStep(id: StepId) {
    const idx = steps.indexOf(id)
    if (idx >= 0) {
      setErrors([])
      setStepIndex(idx)
    }
  }

  function goNext() {
    if (step === "photos" && hasPhotosUploading(q.photos)) {
      return
    }
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
        // Reset creator identity when audience changes — avoid stale names/ids
        creatorFirstName: null,
        creatorParticipantId: null,
      })
    })
  }

  async function resolveUserId(): Promise<string | null> {
    const supabase = createClient()
    const { data } = await supabase.auth.getUser()
    return data.user?.id ?? null
  }

  /**
   * Single-flight project ensure — concurrent photo uploads must share one projectId.
   * Recovers from stale/foreign draftProjectId by creating a fresh project.
   */
  async function ensureProjectId(snapshot: QuestionnaireV1): Promise<string | null> {
    if (projectEnsurePromise.current) return projectEnsurePromise.current

    projectEnsurePromise.current = (async () => {
      const knownId = draftProjectIdRef.current ?? snapshot.draftProjectId ?? undefined
      const base = knownId ? { ...snapshot, draftProjectId: knownId } : { ...snapshot, draftProjectId: undefined }

      let saved = await saveQuestionnaireDraftAction(base)
      if (
        !saved.ok &&
        base.draftProjectId &&
        (saved.code === "SAVE" || saved.code === "FORBIDDEN")
      ) {
        draftProjectIdRef.current = null
        saved = await saveQuestionnaireDraftAction({ ...snapshot, draftProjectId: undefined })
      }

      if (!saved.ok) {
        setSubmitError(saved.error)
        return null
      }
      draftProjectIdRef.current = saved.projectId
      setQ((prev) => ({ ...prev, draftProjectId: saved.projectId }))
      return saved.projectId
    })()

    try {
      return await projectEnsurePromise.current
    } finally {
      projectEnsurePromise.current = null
    }
  }

  async function persistPhoto(
    photo: QuestionnairePhoto,
    projectId: string,
    _userId: string,
  ): Promise<{ ok: true; storagePath: string } | { ok: false; error: string }> {
    if (isPhotoPersisted(photo) && photo.storagePath) {
      return { ok: true, storagePath: photo.storagePath }
    }

    setQ((prev) => ({
      ...prev,
      photos: prev.photos.map((p) =>
        p.id === photo.id
          ? { ...p, uploadStatus: "uploading", uploadError: undefined }
          : p,
      ),
    }))

    let storagePath = photo.storagePath
    const decision = decidePhotoUploadAction({
      uploadStatus: photo.uploadStatus,
      storagePath: photo.storagePath,
      hasLocalFile: hasPhotoFile(photo.id),
    })

    if (decision.action === "error_missing_file") {
      setQ((prev) => ({
        ...prev,
        photos: prev.photos.map((p) =>
          p.id === photo.id
            ? {
                ...p,
                uploadStatus: "error",
                uploadError: PHOTO_UPLOAD_USER_ERROR,
              }
            : p,
        ),
      }))
      return { ok: false, error: PHOTO_UPLOAD_USER_ERROR }
    }

    if (decision.action === "upload_and_register") {
      const file = getPhotoFile(photo.id)
      if (!file || !hasPhotoFile(photo.id)) {
        setQ((prev) => ({
          ...prev,
          photos: prev.photos.map((p) =>
            p.id === photo.id
              ? {
                  ...p,
                  uploadStatus: "error",
                  uploadError: PHOTO_UPLOAD_USER_ERROR,
                }
              : p,
          ),
        }))
        return { ok: false, error: PHOTO_UPLOAD_USER_ERROR }
      }
      const uploaded = await uploadBookPhotoFile({
        projectId,
        photoId: photo.id,
        file,
      })
      if (!uploaded.ok) {
        console.error(
          JSON.stringify({
            scope: "book-photos",
            step: uploaded.step,
            bookProjectId: projectId,
            photoId: photo.id,
            code: uploaded.code ?? null,
            message: uploaded.message?.slice(0, 240) ?? null,
          }),
        )
        setQ((prev) => ({
          ...prev,
          photos: prev.photos.map((p) =>
            p.id === photo.id
              ? {
                  ...p,
                  uploadStatus: "error",
                  uploadError: uploaded.error,
                }
              : p,
          ),
        }))
        return { ok: false, error: uploaded.error }
      }
      storagePath = uploaded.storagePath
    } else if (decision.action === "register_only") {
      storagePath = decision.storagePath
    }

    if (!storagePath) {
      return { ok: false, error: PHOTO_UPLOAD_USER_ERROR }
    }

    const registered = await registerBookPhotoAction({
      projectId,
      storagePath,
      caption: photo.caption,
      anecdote: photo.anecdote,
      useAuthorized: photo.useAuthorized,
    })
    if (!registered.ok) {
      setQ((prev) => ({
        ...prev,
        photos: prev.photos.map((p) =>
          p.id === photo.id
            ? {
                ...p,
                uploadStatus: "error",
                uploadError: registered.error,
                // Keep storagePath so retry registers without duplicating Storage objects.
                storagePath,
              }
            : p,
        ),
      }))
      return { ok: false, error: registered.error }
    }

    setQ((prev) => ({
      ...prev,
      draftProjectId: projectId,
      photos: prev.photos.map((p) =>
        p.id === photo.id
          ? {
              ...p,
              storagePath,
              uploadStatus: "persisted",
              uploadError: undefined,
            }
          : p,
      ),
    }))
    return { ok: true, storagePath }
  }

  async function handleSubmit() {
    setSubmitError(null)
    setSubmitOk(null)
    if (!isAuthenticated) {
      setSubmitError("Connectez-vous pour créer votre cahier — votre brouillon est conservé.")
      return
    }
    startTransition(async () => {
      const userId = await resolveUserId()
      if (!userId) {
        setSubmitError("Connectez-vous pour créer votre cahier — votre brouillon est conservé.")
        return
      }

      const projectId = await ensureProjectId(q)
      if (!projectId) return

      // Upload pending photos before completing — never via Server Action body.
      let workingPhotos = q.photos
      for (const photo of workingPhotos) {
        if (!photo.useAuthorized) continue
        if (isPhotoPersisted(photo)) continue
        const result = await persistPhoto(photo, projectId, userId)
        if (!result.ok) {
          setSubmitError(result.error)
          return
        }
        workingPhotos = workingPhotos.map((p) =>
          p.id === photo.id
            ? {
                ...p,
                storagePath: result.storagePath,
                uploadStatus: "persisted" as const,
                uploadError: undefined,
              }
            : p,
        )
      }

      const toSubmit: QuestionnaireV1 = {
        ...q,
        draftProjectId: projectId,
        photos: workingPhotos.filter((p) => p.uploadStatus !== "error"),
      }

      const result = await submitQuestionnaireAction(toSubmit)
      if (!result.ok) {
        setSubmitError(result.error)
        return
      }

      clearQuestionnaireDraft()
      clearAllPhotoFiles()
      setQ((prev) => ({ ...prev, draftProjectId: result.projectId }))
      setSubmitOk("Questionnaire terminé et enregistré. Retrouvez-le dans Mes cahiers.")
    })
  }

  if (!hydrated) {
    return <p className="text-muted-foreground">Chargement du questionnaire…</p>
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
          <span>
            Étape {safeIndex + 1} / {steps.length} — {copy.navLabel}
          </span>
          <span className="flex items-center gap-3">
            <span aria-live="polite" className="flex items-center gap-2">
              {saveState === "saving" && !manualSaveFlash && (
                <span>Enregistrement…</span>
              )}
              {saveState === "saved" && !manualSaveFlash && (
                <span className="text-foreground">Enregistré</span>
              )}
              {saveState === "error" && (
                <span className="text-destructive">
                  {saveMessage ?? "Erreur lors de l'enregistrement"}
                </span>
              )}
            </span>
            <span>{Math.round(progress)} %</span>
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {completed && (
        <p className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm">
          Ce questionnaire est terminé. Vous pouvez le consulter, mais plus le modifier.
        </p>
      )}

      <div className="rounded-2xl border border-border bg-card p-5 sm:p-8">
        {step === "audience" && (
          <AudienceStep
            q={q}
            copy={copy}
            onAudience={(a) => {
              ensureParticipantsForAudience(a)
              setStepIndex(0)
            }}
            onCreator={(v) =>
              update({
                creatorIsParticipant: v,
                creatorFirstName: null,
                creatorParticipantId: null,
              })
            }
          />
        )}
        {step === "participants" && (
          <ParticipantsStep q={q} copy={copy} setQ={setQ} update={update} />
        )}
        {step === "personality" && <PersonalityStep q={q} copy={copy} setQ={setQ} />}
        {step === "interests" && (
          <InterestsStep q={q} copy={copy} update={update} universes={universes} />
        )}
        {step === "personalFacts" && <PersonalFactsStep q={q} copy={copy} setQ={setQ} />}
        {step === "memories" && <MemoriesStep q={q} copy={copy} setQ={setQ} />}
        {step === "insideJokes" && <InsideJokesStep q={q} copy={copy} setQ={setQ} />}
        {step === "games" && <GamesStep q={q} copy={copy} setQ={setQ} />}
        {step === "photos" && (
          <PhotosStep
            q={q}
            copy={copy}
            setQ={setQ}
            isAuthenticated={isAuthenticated}
            ensureProjectId={ensureProjectId}
            persistPhoto={persistPhoto}
            resolveUserId={resolveUserId}
          />
        )}
        {step === "forbidden" && <ForbiddenStep q={q} copy={copy} update={update} />}
        {step === "color" && <ColorStep q={q} copy={copy} update={update} palettes={palettes} />}
        {step === "style" && <StyleStep q={q} copy={copy} update={update} styles={styles} />}
        {step === "finale" && <FinaleStep q={q} copy={copy} update={update} />}
        {step === "recap" && (
          <RecapStep
            q={q}
            copy={copy}
            richness={richness}
            universes={universes}
            palettes={palettes}
            styles={styles}
            isAuthenticated={isAuthenticated}
            submitError={submitError}
            submitOk={submitOk}
            pending={pending}
            onSubmit={handleSubmit}
            onEdit={goToStep}
          />
        )}

        {photoBannerKind && (
          <div
            role="status"
            aria-live="polite"
            className={cn(
              "mt-4 flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm",
              photoBannerKind === "uploading"
                ? "border-border bg-muted/50 text-foreground"
                : "border-border bg-muted/40 text-foreground",
            )}
          >
            {photoBannerKind === "uploading" && (
              <span
                aria-hidden
                className="inline-block size-3.5 shrink-0 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground"
              />
            )}
            <span>{photoUploadBannerCopy(photoBannerKind)}</span>
          </div>
        )}

        {errors.length > 0 && (
          <ul
            role="alert"
            aria-live="assertive"
            className="mt-4 list-disc space-y-1 rounded-lg border border-destructive/40 bg-destructive/10 p-3 pl-6 text-sm text-destructive"
          >
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button type="button" variant="outline" onClick={goPrev} disabled={safeIndex === 0}>
          <ChevronLeft className="size-4" />
          Précédent
        </Button>
        <div className="flex flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-3">
          {manualSaveFlash && (
            <span
              role="status"
              aria-live="polite"
              className="rounded-md border border-border bg-muted/50 px-2.5 py-1 text-sm text-foreground"
            >
              Brouillon enregistré
            </span>
          )}
          <div className="flex flex-wrap gap-2">
            {!completed && (
              <Button
                type="button"
                variant="outline"
                onClick={saveDraftNow}
                disabled={pending || manualSaving}
              >
                {manualSaving ? "Enregistrement…" : "Enregistrer mon brouillon"}
              </Button>
            )}
            {step !== "recap" && !completed ? (
              <Button
                type="button"
                onClick={goNext}
                disabled={step === "photos" && photosUploading}
              >
                Suivant
                <ChevronRight className="size-4" />
              </Button>
            ) : null}
          </div>
        </div>
      </div>
      {!isAuthenticated && !completed && (
        <p className="text-center text-sm text-muted-foreground">
          <Link
            href={`/auth/login?next=${encodeURIComponent("/questionnaire?claim=1")}`}
            className="underline"
          >
            Se connecter
          </Link>
          {" · "}
          <Link
            href={`/auth/sign-up?next=${encodeURIComponent("/questionnaire?claim=1")}`}
            className="underline"
          >
            Créer un compte
          </Link>
          {" — "}
          votre brouillon local est conservé.
        </p>
      )}
    </div>
  )
}

function StepHeader({
  title,
  subtitle,
}: {
  title: string
  subtitle?: string
}) {
  return (
    <div className="mb-5">
      <h2 className="font-serif text-2xl font-semibold">{title}</h2>
      {subtitle ? <p className="mt-2 text-muted-foreground">{subtitle}</p> : null}
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
  copy,
  onAudience,
  onCreator,
}: {
  q: QuestionnaireV1
  copy: { title: string; subtitle?: string }
  onAudience: (a: AudienceType) => void
  onCreator: (v: boolean) => void
}) {
  return (
    <div className="flex flex-col gap-6">
      <StepHeader title={copy.title} subtitle={copy.subtitle} />
      <div className="grid gap-2 sm:grid-cols-2">
        {AUDIENCE_OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onAudience(o.value)}
            className={cn(
              "rounded-2xl border px-4 py-4 text-left text-base font-medium transition-colors",
              q.audience === o.value
                ? "border-primary bg-primary/5 ring-2 ring-primary/25"
                : "border-border hover:bg-muted/50",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
      {(q.audience === "DUO" || q.audience === "GROUP") && (
        <div>
          <FieldLabel>Vous faites partie des personnes qui utiliseront ce cahier ?</FieldLabel>
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
  copy,
  setQ,
  update,
}: {
  q: QuestionnaireV1
  copy: { title: string; subtitle?: string }
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
      <StepHeader title={copy.title} subtitle={copy.subtitle} />
      {q.audience === "DUO" && (
        <div>
          <FieldLabel>Quel type de duo ?</FieldLabel>
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
              <Plus className="size-4" /> Ajouter quelqu&apos;un
            </Button>
            <span className="self-center text-sm text-muted-foreground">
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
          {q.audience !== "GROUP" && (
            <label className="flex flex-col gap-1 text-sm">
              Surnom (facultatif)
              <input
                className="h-10 rounded-lg border border-input bg-background px-3"
                value={p.nickname ?? ""}
                onChange={(e) => patchParticipant(i, { nickname: e.target.value })}
              />
            </label>
          )}
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
                  creatorParticipantId:
                    prev.creatorParticipantId === p.id ? null : prev.creatorParticipantId,
                }))
              }
            >
              Retirer
            </button>
          )}
        </div>
      ))}

      {q.audience === "OTHER_PERSON" ||
      ((q.audience === "DUO" || q.audience === "GROUP") &&
        q.creatorIsParticipant === false) ? (
        <div className="rounded-xl border border-border p-4">
          <FieldLabel>Et vous, comment vous appelez-vous ?</FieldLabel>
          <label className="mt-2 flex flex-col gap-1 text-sm">
            Votre prénom *
            <input
              className="h-10 rounded-lg border border-input bg-background px-3"
              value={q.creatorFirstName ?? ""}
              onChange={(e) => update({ creatorFirstName: e.target.value })}
              autoComplete="given-name"
            />
          </label>
          <p className="mt-2 text-xs text-muted-foreground">
            Il pourra être utilisé dans quelques clins d&apos;œil du cahier.
          </p>
        </div>
      ) : null}

      {(q.audience === "DUO" || q.audience === "GROUP") &&
      q.creatorIsParticipant === true ? (
        <div className="rounded-xl border border-border p-4">
          <FieldLabel>Et vous, qui êtes-vous ?</FieldLabel>
          <p className="mt-1 text-xs text-muted-foreground">
            Choisissez votre prénom parmi les personnes du cahier.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {q.participants.map((p) => (
              <Chip
                key={p.id}
                active={q.creatorParticipantId === p.id}
                onClick={() => update({ creatorParticipantId: p.id })}
              >
                {p.firstName.trim() || "Sans prénom"}
              </Chip>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function PersonalityStep({
  q,
  copy,
  setQ,
}: {
  q: QuestionnaireV1
  copy: { title: string; subtitle?: string }
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
      <StepHeader title={copy.title} subtitle={copy.subtitle} />
      {(q.audience === "ME" || q.audience === "OTHER_PERSON") && soloId && (
        <div>
          <FieldLabel>
            {q.audience === "ME" ? "Quels traits vous ressemblent ?" : "Quels traits lui ressemblent ?"}{" "}
            (3 à 6)
          </FieldLabel>
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
            <span className="sr-only">{copy.title}</span>
            <textarea
              className="min-h-20 rounded-lg border border-input bg-background p-3"
              placeholder="Quelques mots sur votre relation, votre complicité…"
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
            <FieldLabel>Dynamique du duo (au moins 2) *</FieldLabel>
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
              <FieldLabel>Traits pour {p.firstName || "cette personne"} (facultatif)</FieldLabel>
              <div className="flex flex-wrap gap-2">
                {PERSONALITY_TRAIT_OPTIONS.map((t) => (
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
              {GROUP_TRAIT_OPTIONS.map((t) => {
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
          <GroupParticularitiesStep q={q} setQ={setQ} />
        </>
      )}
    </div>
  )
}

function GroupParticularitiesStep({
  q,
  setQ,
}: {
  q: QuestionnaireV1
  setQ: React.Dispatch<React.SetStateAction<QuestionnaireV1>>
}) {
  const [drafts, setDrafts] = useState<{ id: string; participantId: string; text: string }[]>([])
  const filled = listGroupParticularities(q.participants)
  const takenIds = new Set(filled.map((f) => f.participantId))

  function patchParticipantTrait(participantId: string, text: string, clearFrom?: string) {
    setQ((prev) => ({
      ...prev,
      participants: prev.participants.map((p) => {
        if (clearFrom && p.id === clearFrom && clearFrom !== participantId) {
          return { ...p, personalTrait: undefined }
        }
        if (p.id === participantId) {
          const trimmed = text.trim()
          return { ...p, personalTrait: trimmed ? trimmed : undefined }
        }
        return p
      }),
    }))
  }

  return (
    <div className="mt-2 flex flex-col gap-3">
      <div>
        <h3 className="font-medium">Quelques particularités sur les membres du groupe</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Facultatif — ajoutez seulement les petites choses qui peuvent rendre le cahier plus
          personnel.
        </p>
      </div>

      {filled.map((row) => (
        <div
          key={row.participantId}
          className="flex flex-col gap-2 rounded-xl border border-border p-3 sm:flex-row sm:items-end"
        >
          <label className="flex flex-1 flex-col gap-1 text-sm">
            Personne
            <select
              className="h-10 rounded-lg border border-input bg-background px-2"
              value={row.participantId}
              onChange={(e) => {
                const nextId = e.target.value
                patchParticipantTrait(nextId, row.text, row.participantId)
              }}
            >
              {q.participants.map((p) => (
                <option
                  key={p.id}
                  value={p.id}
                  disabled={takenIds.has(p.id) && p.id !== row.participantId}
                >
                  {p.firstName || "Sans prénom"}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-[2] flex-col gap-1 text-sm">
            Particularité
            <input
              className="h-10 rounded-lg border border-input bg-background px-3"
              placeholder='Ex. Il est toujours en retard'
              value={row.text}
              onChange={(e) => patchParticipantTrait(row.participantId, e.target.value)}
            />
          </label>
          <button
            type="button"
            className="self-start text-sm text-destructive sm:self-end sm:pb-2"
            onClick={() =>
              setQ((prev) => ({
                ...prev,
                participants: clearGroupParticularity(prev.participants, row.participantId),
              }))
            }
          >
            Supprimer
          </button>
        </div>
      ))}

      {drafts.map((draft) => {
        const available = q.participants.filter(
          (p) => !takenIds.has(p.id) || p.id === draft.participantId,
        )
        return (
          <div
            key={draft.id}
            className="flex flex-col gap-2 rounded-xl border border-dashed border-border p-3 sm:flex-row sm:items-end"
          >
            <label className="flex flex-1 flex-col gap-1 text-sm">
              Personne
              <select
                className="h-10 rounded-lg border border-input bg-background px-2"
                value={draft.participantId}
                onChange={(e) => {
                  const participantId = e.target.value
                  setDrafts((prev) =>
                    prev.map((d) => (d.id === draft.id ? { ...d, participantId } : d)),
                  )
                  if (participantId && draft.text.trim()) {
                    patchParticipantTrait(participantId, draft.text)
                    setDrafts((prev) => prev.filter((d) => d.id !== draft.id))
                  }
                }}
              >
                <option value="">Choisir…</option>
                {available.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.firstName || "Sans prénom"}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-[2] flex-col gap-1 text-sm">
              Particularité
              <input
                className="h-10 rounded-lg border border-input bg-background px-3"
                placeholder='Ex. Il est toujours en retard'
                value={draft.text}
                onChange={(e) => {
                  const text = e.target.value
                  setDrafts((prev) =>
                    prev.map((d) => (d.id === draft.id ? { ...d, text } : d)),
                  )
                  if (draft.participantId) {
                    if (text.trim()) {
                      patchParticipantTrait(draft.participantId, text)
                      setDrafts((prev) => prev.filter((d) => d.id !== draft.id))
                    }
                  }
                }}
              />
            </label>
            <button
              type="button"
              className="self-start text-sm text-destructive sm:self-end sm:pb-2"
              onClick={() => setDrafts((prev) => prev.filter((d) => d.id !== draft.id))}
            >
              Supprimer
            </button>
          </div>
        )
      })}

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={
          filled.length + drafts.length >= q.participants.length || q.participants.length === 0
        }
        onClick={() =>
          setDrafts((prev) => [...prev, { id: newId("gp"), participantId: "", text: "" }])
        }
      >
        <Plus className="size-4" /> Ajouter une particularité
      </Button>
    </div>
  )
}

function InterestsStep({
  q,
  copy,
  update,
  universes,
}: {
  q: QuestionnaireV1
  copy: { title: string; subtitle?: string }
  update: (p: Partial<QuestionnaireV1>) => void
  universes: Universe[]
}) {
  return (
    <div className="flex flex-col gap-5">
      <StepHeader title={copy.title} subtitle={copy.subtitle} />
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
  copy,
  setQ,
}: {
  q: QuestionnaireV1
  copy: { title: string; subtitle?: string }
  setQ: React.Dispatch<React.SetStateAction<QuestionnaireV1>>
}) {
  const showWho = q.audience === "DUO" || q.audience === "GROUP"
  const everyoneLabel = q.audience === "DUO" ? "Tout le duo" : "Tout le groupe"

  return (
    <div className="flex flex-col gap-5">
      <StepHeader title={copy.title} subtitle={copy.subtitle} />
      {q.personalFacts.map((f, i) => {
        const cat = PERSONAL_FACT_CATEGORIES.find((c) => c.value === f.category)
        return (
          <div key={f.id} className="flex flex-col gap-3 rounded-xl border border-border p-4">
            <div className="flex flex-col gap-2 sm:flex-row">
              <select
                className="h-10 rounded-lg border border-input bg-background px-2 text-sm sm:w-56"
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
                placeholder={cat?.placeholder ?? "Ex. …"}
              />
              <button
                type="button"
                aria-label="Supprimer ce détail"
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
            {showWho && (
              <div>
                <FieldLabel>Qui cela concerne ?</FieldLabel>
                <div className="flex flex-wrap gap-2">
                  <Chip
                    active={!f.participantIds?.length}
                    onClick={() =>
                      setQ((prev) => ({
                        ...prev,
                        personalFacts: prev.personalFacts.map((x, idx) =>
                          idx === i ? { ...x, participantIds: undefined } : x,
                        ),
                      }))
                    }
                  >
                    {everyoneLabel}
                  </Chip>
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
                </div>
              </div>
            )}
          </div>
        )
      })}
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
        <Plus className="size-4" /> Ajouter un autre détail
      </Button>
    </div>
  )
}

function MemoriesStep({
  q,
  copy,
  setQ,
}: {
  q: QuestionnaireV1
  copy: { title: string; subtitle?: string }
  setQ: React.Dispatch<React.SetStateAction<QuestionnaireV1>>
}) {
  const suggestions = memorySuggestions(q.audience)

  function addMemory(seedTitle?: string) {
    setQ((prev) => ({
      ...prev,
      memories: [...prev.memories, { id: newId("m"), text: "", title: seedTitle }],
    }))
  }

  return (
    <div className="flex flex-col gap-5">
      <StepHeader title={copy.title} subtitle={copy.subtitle} />
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => addMemory(s)}
              className="rounded-full border border-dashed border-border bg-muted/40 px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-primary hover:bg-primary/5 hover:text-foreground"
            >
              {s}
            </button>
          ))}
        </div>
      )}
      {q.memories.map((m, i) => (
        <div key={m.id} className="flex flex-col gap-2 rounded-xl border border-border p-4">
          <textarea
            className="min-h-24 rounded-lg border border-input bg-background p-3 text-sm"
            placeholder="Racontez ce moment…"
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
          <details className="text-sm">
            <summary className="cursor-pointer text-muted-foreground">
              Titre ou lieu (facultatif)
            </summary>
            <div className="mt-3 flex flex-col gap-3">
              <label className="flex flex-col gap-1">
                <span className="font-medium text-foreground">Titre (facultatif)</span>
                <input
                  className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
                  placeholder="Ex. Notre premier voyage"
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
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-medium text-foreground">Lieu (facultatif)</span>
                <input
                  className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
                  placeholder="Ex. Lisbonne, Portugal"
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
              </label>
            </div>
          </details>
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
      <Button type="button" variant="outline" size="sm" onClick={() => addMemory()}>
        <Plus className="size-4" /> Ajouter un souvenir
      </Button>
    </div>
  )
}

function InsideJokesStep({
  q,
  copy,
  setQ,
}: {
  q: QuestionnaireV1
  copy: { title: string; subtitle?: string }
  setQ: React.Dispatch<React.SetStateAction<QuestionnaireV1>>
}) {
  return (
    <div className="flex flex-col gap-5">
      <StepHeader title={copy.title} subtitle={copy.subtitle} />
      {q.insideJokes.map((j, i) => (
        <div key={j.id} className="flex gap-2">
          <input
            className="h-10 flex-1 rounded-lg border border-input bg-background px-3 text-sm"
            placeholder="Ex. une expression, une blague interne…"
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
  copy,
  setQ,
}: {
  q: QuestionnaireV1
  copy: { title: string; subtitle?: string }
  setQ: React.Dispatch<React.SetStateAction<QuestionnaireV1>>
}) {
  const liked = q.gamePreferences.likedTypes ?? []
  const disliked = q.gamePreferences.dislikedTypes ?? []

  return (
    <div className="flex flex-col gap-5">
      <StepHeader title={copy.title} subtitle={copy.subtitle} />
      <div>
        <FieldLabel>Types de jeux *</FieldLabel>
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
  copy,
  setQ,
  isAuthenticated,
  ensureProjectId,
  persistPhoto,
  resolveUserId,
}: {
  q: QuestionnaireV1
  copy: { title: string; subtitle?: string }
  setQ: React.Dispatch<React.SetStateAction<QuestionnaireV1>>
  isAuthenticated: boolean
  ensureProjectId: (snapshot: QuestionnaireV1) => Promise<string | null>
  persistPhoto: (
    photo: QuestionnairePhoto,
    projectId: string,
    userId: string,
  ) => Promise<{ ok: true; storagePath: string } | { ok: false; error: string }>
  resolveUserId: () => Promise<string | null>
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [uploadErrors, setUploadErrors] = useState<string[]>([])
  const [brokenPreviewIds, setBrokenPreviewIds] = useState<string[]>([])
  const showWho = q.audience === "DUO" || q.audience === "GROUP"

  function pushUploadError(message: string) {
    setUploadErrors((prev) => [...prev, message])
  }

  /**
   * Snapshot FileList entries immediately, register each File under a stable
   * photoId OUTSIDE setState (avoids Strict Mode / stale FileList issues),
   * then append metadata in one state update.
   */
  async function readFiles(fileList: FileList | File[]) {
    setUploadErrors([])
    // Copy BEFORE any input reset / await — FileList is live.
    const all = Array.from(fileList)
    const images = all.filter((f) => f.type.startsWith("image/"))
    const rejected = all.length - images.length
    if (rejected > 0) {
      pushUploadError(
        rejected === 1
          ? "Un fichier n'est pas une image et a été ignoré."
          : `${rejected} fichiers ne sont pas des images et ont été ignorés.`,
      )
    }

    const remaining = MAX_PHOTOS - q.photos.length
    if (remaining <= 0 || images.length === 0) return
    if (images.length > remaining) {
      pushUploadError(
        `Maximum ${MAX_PHOTOS} photos : seules les ${remaining} premières ont été prises en compte.`,
      )
    }

    const selected = images.slice(0, remaining)
    const additions: Array<{
      id: string
      previewDataUrl: string
      fileName: string
    }> = []

    for (const original of selected) {
      const validation = validatePhotoFile(original)
      if (validation) {
        pushUploadError(validation)
        continue
      }
      // Detach bytes from the live FileList entry before input clear / GC.
      const snap = await snapshotPhotoFile(original)
      if (!snap) {
        pushUploadError(PHOTO_UPLOAD_USER_ERROR)
        continue
      }
      const id = newId("ph")
      try {
        const previewDataUrl = setPhotoFile(id, snap)
        additions.push({
          id,
          previewDataUrl,
          fileName: snap.name,
        })
      } catch {
        pushUploadError(PHOTO_UPLOAD_USER_ERROR)
      }
    }

    if (!additions.length) return

    setQ((prev) => {
      const room = MAX_PHOTOS - prev.photos.length
      if (room <= 0) {
        for (const a of additions) clearPhotoFile(a.id)
        return prev
      }
      const take = additions.slice(0, room)
      for (const dropped of additions.slice(room)) clearPhotoFile(dropped.id)
      return {
        ...prev,
        photos: [
          ...prev.photos,
          ...take.map((a) => ({
            id: a.id,
            previewDataUrl: a.previewDataUrl,
            fileName: a.fileName,
            useAuthorized: false,
            uploadStatus: "local" as const,
          })),
        ],
      }
    })
  }

  async function uploadAuthorizedPhoto(photo: QuestionnairePhoto) {
    if (!isAuthenticated) return
    const userId = await resolveUserId()
    if (!userId) return
    const projectId = await ensureProjectId(q)
    if (!projectId) {
      setQ((prev) => ({
        ...prev,
        photos: prev.photos.map((p) =>
          p.id === photo.id
            ? {
                ...p,
                uploadStatus: "error",
                uploadError: PHOTO_UPLOAD_USER_ERROR,
              }
            : p,
        ),
      }))
      return
    }
    // Always re-read the latest photo row (storagePath / status) from state via id.
    const latest = q.photos.find((p) => p.id === photo.id) ?? photo
    await persistPhoto({ ...latest, useAuthorized: true }, projectId, userId)
  }

  async function replacePhotoFile(photoId: string, fileList: FileList | null) {
    if (!fileList?.length) return
    const original = fileList[0]!
    const validation = validatePhotoFile(original)
    if (validation) {
      pushUploadError(validation)
      return
    }
    const snap = await snapshotPhotoFile(original)
    if (!snap) {
      pushUploadError(PHOTO_UPLOAD_USER_ERROR)
      return
    }
    try {
      const previewDataUrl = setPhotoFile(photoId, snap)
      setQ((prev) => ({
        ...prev,
        photos: prev.photos.map((p) =>
          p.id === photoId
            ? {
                ...p,
                previewDataUrl,
                fileName: snap.name,
                uploadStatus: "local",
                uploadError: undefined,
                // New file → previous failed storage path no longer valid.
                storagePath: undefined,
              }
            : p,
        ),
      }))
      setBrokenPreviewIds((prev) => prev.filter((id) => id !== photoId))
    } catch {
      pushUploadError(PHOTO_UPLOAD_USER_ERROR)
    }
  }

  async function removePhoto(photo: QuestionnairePhoto) {
    if (photo.storagePath && q.draftProjectId) {
      await deleteBookPhotoAction({
        projectId: q.draftProjectId,
        storagePath: photo.storagePath,
      })
    }
    clearPhotoFile(photo.id)
    setQ((prev) => ({
      ...prev,
      photos: prev.photos.filter((p) => p.id !== photo.id),
    }))
  }

  return (
    <div className="flex flex-col gap-5">
      <StepHeader title={copy.title} subtitle={copy.subtitle} />
      <p className="text-sm text-muted-foreground">
        {q.photos.length} / {MAX_PHOTOS} photos · max 10 Mo · JPG, PNG, WebP, GIF
      </p>
      {!isAuthenticated && q.photos.length > 0 && (
        <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
          Connectez-vous pour enregistrer vos photos sur le serveur. Elles restent visibles ici en
          local.
        </p>
      )}

      {uploadErrors.length > 0 && (
        <ul className="list-disc space-y-1 rounded-lg border border-destructive/40 bg-destructive/10 p-3 pl-6 text-sm text-destructive">
          {uploadErrors.map((e, i) => (
            <li key={`${e}-${i}`}>{e}</li>
          ))}
        </ul>
      )}

      {q.photos.length < MAX_PHOTOS && (
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            if (e.dataTransfer.files?.length) {
              const copied = Array.from(e.dataTransfer.files)
              void readFiles(copied)
            }
          }}
          className={cn(
            "flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-colors",
            dragging ? "border-primary bg-primary/5" : "border-border bg-muted/30",
          )}
        >
          <Upload className="size-8 text-muted-foreground" />
          <div>
            <p className="font-medium">Glissez vos photos ici</p>
            <p className="mt-1 text-sm text-muted-foreground">ou</p>
          </div>
          <Button type="button" variant="outline" onClick={() => inputRef.current?.click()}>
            Choisir des photos
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            className="hidden"
            onChange={(e) => {
              const list = e.target.files ? Array.from(e.target.files) : []
              e.target.value = ""
              if (list.length) void readFiles(list)
            }}
          />
        </div>
      )}

      {q.photos.map((photo, i) => {
        const objectUrl = ensurePhotoObjectUrl(photo.id) ?? getPhotoObjectUrl(photo.id)
        const previewSrc = objectUrl ?? photo.previewDataUrl
        const previewBroken =
          brokenPreviewIds.includes(photo.id) && !getPhotoFile(photo.id) && !previewSrc
        const hasPreview =
          (Boolean(previewSrc) && !brokenPreviewIds.includes(photo.id)) ||
          Boolean(ensurePhotoObjectUrl(photo.id))
        const status = photo.uploadStatus ?? (photo.storagePath ? "persisted" : "local")

        return (
          <div
            key={photo.id}
            className="flex flex-col gap-3 rounded-xl border border-border p-4 sm:flex-row"
          >
            {hasPreview && previewSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={ensurePhotoObjectUrl(photo.id) ?? previewSrc}
                alt={photo.fileName ? `Aperçu de ${photo.fileName}` : "Aperçu photo"}
                className="h-28 w-28 shrink-0 rounded-lg object-cover"
                onError={() => {
                  // If File is still in memory, recreate object URL instead of marking broken.
                  const recovered = ensurePhotoObjectUrl(photo.id)
                  if (recovered) {
                    setBrokenPreviewIds((prev) => prev.filter((id) => id !== photo.id))
                    return
                  }
                  setBrokenPreviewIds((prev) =>
                    prev.includes(photo.id) ? prev : [...prev, photo.id],
                  )
                }}
              />
            ) : (
              <div className="flex h-28 w-28 shrink-0 flex-col items-center justify-center rounded-lg border border-destructive/40 bg-destructive/10 p-2 text-center text-xs text-destructive">
                Aperçu indisponible
              </div>
            )}
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <p className="text-xs text-muted-foreground">
                {status === "uploading" && "Enregistrement…"}
                {status === "persisted" && "Enregistrée"}
                {status === "local" &&
                  (isAuthenticated ? "En attente d'autorisation" : "Brouillon local")}
                {status === "error" && (photo.uploadError ?? PHOTO_UPLOAD_USER_ERROR)}
              </p>
              {previewBroken && status !== "persisted" && (
                <p className="text-sm text-destructive">
                  Impossible d&apos;afficher cette photo. Supprimez-la et réessayez avec un autre
                  fichier (JPG ou PNG).
                </p>
              )}
              {showWho && (
                <div>
                  <FieldLabel>Qui apparaît sur cette photo ?</FieldLabel>
                  <div className="flex flex-wrap gap-2">
                    {q.participants.map((p) => {
                      const active = photo.participantIds?.includes(p.id) ?? false
                      return (
                        <Chip
                          key={p.id}
                          active={active}
                          onClick={() =>
                            setQ((prev) => ({
                              ...prev,
                              photos: prev.photos.map((x, idx) => {
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
                  </div>
                </div>
              )}
              <input
                className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
                placeholder="Une petite légende ?"
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
                placeholder="Une anecdote liée à cette photo ?"
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
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={photo.useAuthorized}
                  onChange={(e) => {
                    const checked = e.target.checked
                    setQ((prev) => ({
                      ...prev,
                      photos: prev.photos.map((x, idx) =>
                        idx === i ? { ...x, useAuthorized: checked } : x,
                      ),
                    }))
                    if (checked && isAuthenticated && !isPhotoPersisted(photo)) {
                      void uploadAuthorizedPhoto({ ...photo, useAuthorized: true })
                    }
                  }}
                />
                <span>
                  J&apos;autorise l&apos;utilisation de cette photo dans le cahier. Elle restera privée
                  et ne sera utilisée que pour ce projet. *
                </span>
              </label>
              <div className="flex flex-wrap gap-3">
                {status === "error" && hasPhotoFile(photo.id) && (
                  <button
                    type="button"
                    className="text-sm text-primary underline underline-offset-4"
                    onClick={() => void uploadAuthorizedPhoto({ ...photo, useAuthorized: true })}
                  >
                    Réessayer
                  </button>
                )}
                {status === "error" && !hasPhotoFile(photo.id) && (
                  <label className="cursor-pointer text-sm text-primary underline underline-offset-4">
                    Resélectionner le fichier
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="hidden"
                      onChange={(e) => {
                        const list = e.target.files
                        e.target.value = ""
                        void replacePhotoFile(photo.id, list)
                      }}
                    />
                  </label>
                )}
                <button
                  type="button"
                  className="text-sm text-destructive"
                  onClick={() => void removePhoto(photo)}
                >
                  Supprimer
                </button>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ForbiddenStep({
  q,
  copy,
  update,
}: {
  q: QuestionnaireV1
  copy: { title: string; subtitle?: string }
  update: (p: Partial<QuestionnaireV1>) => void
}) {
  const ft = q.forbiddenTopics
  return (
    <div className="flex flex-col gap-5">
      <StepHeader title={copy.title} subtitle={copy.subtitle} />
      <div className="flex gap-2">
        <Chip
          active={ft?.answered === true && ft.hasRestrictions === false}
          onClick={() => update({ forbiddenTopics: { answered: true, hasRestrictions: false } })}
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
            placeholder="Précisez ce qu'il faut éviter *"
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

function ColorStep({
  q,
  copy,
  update,
  palettes,
}: {
  q: QuestionnaireV1
  copy: { title: string; subtitle?: string }
  update: (p: Partial<QuestionnaireV1>) => void
  palettes: Palette[]
}) {
  return (
    <div className="flex flex-col gap-5">
      <StepHeader title={copy.title} subtitle={copy.subtitle} />
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() =>
            update({
              visualPreferences: { ...q.visualPreferences, paletteId: "AUTO" },
            })
          }
          className={cn(
            "rounded-2xl border p-4 text-left",
            q.visualPreferences.paletteId === "AUTO"
              ? "border-primary ring-2 ring-primary/30"
              : "border-border",
          )}
        >
          <div className="mb-3 h-10 overflow-hidden rounded-xl bg-gradient-to-r from-rose-300 via-amber-200 to-sky-300" />
          <p className="font-medium">Surprenez-moi</p>
          <p className="mt-1 text-xs text-muted-foreground">On choisit une ambiance pour vous</p>
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
              "rounded-2xl border p-4 text-left",
              q.visualPreferences.paletteId === p.id
                ? "border-primary ring-2 ring-primary/30"
                : "border-border",
            )}
          >
            <div className="mb-3 flex h-10 overflow-hidden rounded-xl">
              <span className="flex-1" style={{ backgroundColor: p.primary_color }} />
              <span className="flex-1" style={{ backgroundColor: p.secondary_color }} />
              <span className="flex-1" style={{ backgroundColor: p.accent_color }} />
              <span className="flex-1" style={{ backgroundColor: p.background_color }} />
            </div>
            <p className="font-medium">{p.name}</p>
          </button>
        ))}
      </div>
    </div>
  )
}

function StyleStep({
  q,
  copy,
  update,
  styles,
}: {
  q: QuestionnaireV1
  copy: { title: string; subtitle?: string }
  update: (p: Partial<QuestionnaireV1>) => void
  styles: Style[]
}) {
  return (
    <div className="flex flex-col gap-5">
      <StepHeader title={copy.title} subtitle={copy.subtitle} />
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() =>
            update({ visualPreferences: { ...q.visualPreferences, styleId: "AUTO" } })
          }
          className={cn(
            "rounded-2xl border p-3 text-left",
            q.visualPreferences.styleId === "AUTO"
              ? "border-primary ring-2 ring-primary/30"
              : "border-border",
          )}
        >
          <div className="mb-3 rounded-xl border border-dashed border-border bg-muted/40 p-3 text-center text-sm text-muted-foreground">
            Aperçu surprise
          </div>
          <p className="font-medium">Surprenez-moi</p>
        </button>
        {styles.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() =>
              update({ visualPreferences: { ...q.visualPreferences, styleId: s.id } })
            }
            className={cn(
              "rounded-2xl border p-3 text-left",
              q.visualPreferences.styleId === s.id
                ? "border-primary ring-2 ring-primary/30"
                : "border-border",
            )}
          >
            <StylePreview name={s.name} styleId={s.id} className="mb-3" />
            <p className="font-medium">{s.name}</p>
            {s.description ? (
              <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{s.description}</p>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  )
}

function FinaleStep({
  q,
  copy,
  update,
}: {
  q: QuestionnaireV1
  copy: { title: string; subtitle?: string }
  update: (p: Partial<QuestionnaireV1>) => void
}) {
  const isMe = q.audience === "ME"
  const isOther = q.audience === "OTHER_PERSON"
  const isGift =
    (q.audience === "DUO" || q.audience === "GROUP") && q.creatorIsParticipant === false

  return (
    <div className="flex flex-col gap-5">
      <StepHeader title={copy.title} subtitle={copy.subtitle} />
      {isMe && (
        <label className="flex flex-col gap-1 text-sm">
          Une dernière chose que vous aimeriez nous dire ?
          <textarea
            className="min-h-24 rounded-lg border border-input bg-background p-3"
            value={q.lastNote ?? ""}
            onChange={(e) => update({ lastNote: e.target.value })}
          />
        </label>
      )}
      {isOther && (
        <>
          <label className="flex flex-col gap-1 text-sm">
            Souhaitez-vous ajouter un petit mot personnel dans son cahier ?
            <textarea
              className="min-h-24 rounded-lg border border-input bg-background p-3"
              value={q.finalMessage ?? ""}
              onChange={(e) => update({ finalMessage: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Une dernière chose que nous devrions savoir ?
            <textarea
              className="min-h-20 rounded-lg border border-input bg-background p-3"
              value={q.lastNote ?? ""}
              onChange={(e) => update({ lastNote: e.target.value })}
            />
          </label>
        </>
      )}
      {(q.audience === "DUO" || q.audience === "GROUP") && (
        <>
          <label className="flex flex-col gap-1 text-sm">
            {isGift
              ? "Un petit mot cadeau à glisser dans le cahier ?"
              : "Une phrase ou un message à glisser dans le cahier ?"}
            <textarea
              className="min-h-24 rounded-lg border border-input bg-background p-3"
              value={q.finalMessage ?? ""}
              onChange={(e) => update({ finalMessage: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Une dernière chose que nous devrions savoir ?
            <textarea
              className="min-h-20 rounded-lg border border-input bg-background p-3"
              value={q.lastNote ?? ""}
              onChange={(e) => update({ lastNote: e.target.value })}
            />
          </label>
        </>
      )}
    </div>
  )
}

function RecapBlock({
  title,
  children,
  onEdit,
}: {
  title: string
  children: React.ReactNode
  onEdit?: () => void
}) {
  return (
    <div className="rounded-xl border border-border p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="font-medium">{title}</h3>
        {onEdit ? (
          <button type="button" className="text-sm text-primary underline-offset-2 hover:underline" onClick={onEdit}>
            Modifier
          </button>
        ) : null}
      </div>
      <div className="text-sm text-muted-foreground">{children}</div>
    </div>
  )
}

function RecapTagList({ items }: { items: string[] }) {
  if (!items.length) return <span>—</span>
  const { visible, overflow } = truncateTagList(items, 6)
  return (
    <div className="flex flex-wrap gap-1.5">
      {visible.map((label) => (
        <span
          key={label}
          className="rounded-full border border-border bg-background px-2.5 py-0.5 text-xs font-medium text-foreground"
        >
          {label}
        </span>
      ))}
      {overflow > 0 ? (
        <span className="rounded-full border border-dashed border-border bg-muted/50 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
          + {overflow} autres
        </span>
      ) : null}
    </div>
  )
}

function RecapStep({
  q,
  copy,
  richness,
  universes,
  palettes,
  styles,
  isAuthenticated,
  submitError,
  submitOk,
  pending,
  onSubmit,
  onEdit,
}: {
  q: QuestionnaireV1
  copy: { title: string; subtitle?: string }
  richness: ReturnType<typeof calculateProfileRichness>
  universes: Universe[]
  palettes: Palette[]
  styles: Style[]
  isAuthenticated: boolean
  submitError: string | null
  submitOk: string | null
  pending: boolean
  onSubmit: () => void
  onEdit: (step: StepId) => void
}) {
  const names = q.participants.map((p) => p.firstName).filter(Boolean)
  const forLabel =
    q.audience === "ME"
      ? `Pour vous${names[0] ? `, ${names[0]}` : ""}`
      : names.length
        ? names.join(" · ")
        : audienceHumanLabel(q.audience)

  const universeNames = q.interestUniverseIds
    .map((id) => universes.find((u) => u.id === id)?.name ?? null)
    .filter(Boolean) as string[]

  const gameLabels = (q.gamePreferences.likedTypes ?? [])
    .map((t) => GAME_TYPE_OPTIONS.find((o) => o.value === t)?.label ?? null)
    .filter(Boolean) as string[]

  const paletteLabel =
    q.visualPreferences.paletteId === "AUTO"
      ? "Surprenez-moi"
      : palettes.find((p) => p.id === q.visualPreferences.paletteId)?.name ?? "—"

  const styleLabel =
    q.visualPreferences.styleId === "AUTO"
      ? "Surprenez-moi"
      : styles.find((s) => s.id === q.visualPreferences.styleId)?.name ?? "—"

  const factsCount = q.personalFacts.filter((f) => f.value.trim()).length
  const memoriesCount = q.memories.filter((m) => m.text.trim()).length

  return (
    <div className="flex flex-col gap-5">
      <StepHeader title={copy.title} subtitle={copy.subtitle} />

      <RecapBlock title={forLabel} onEdit={() => onEdit("participants")}>
        {audienceHumanLabel(q.audience)}
        {q.audience !== "ME" && q.creatorFirstName?.trim() ? (
          <p className="mt-1 text-muted-foreground">Créé par {q.creatorFirstName.trim()}</p>
        ) : null}
        {q.audience !== "ME" &&
        q.creatorIsParticipant === true &&
        q.creatorParticipantId
          ? (() => {
              const me = q.participants.find((p) => p.id === q.creatorParticipantId)
              return me?.firstName.trim() ? (
                <p className="mt-1 text-muted-foreground">Créé par {me.firstName.trim()}</p>
              ) : null
            })()
          : null}
      </RecapBlock>

      <RecapBlock title={q.audience === "ME" ? "Vos univers" : "Univers"} onEdit={() => onEdit("interests")}>
        <RecapTagList items={universeNames} />
      </RecapBlock>

      <RecapBlock title={q.audience === "ME" ? "Vos jeux" : "Jeux"} onEdit={() => onEdit("games")}>
        <RecapTagList items={gameLabels} />
        <p className="mt-2">Niveau : {difficultyLabel(q.gamePreferences.difficulty)}</p>
      </RecapBlock>

      <RecapBlock
        title={q.audience === "ME" ? "Votre univers graphique" : "Univers graphique"}
        onEdit={() => onEdit("style")}
      >
        <p>{styleLabel}</p>
        <p className="mt-1">{paletteLabel}</p>
      </RecapBlock>

      <RecapBlock
        title={q.audience === "ME" ? "Votre personnalisation" : "Personnalisation"}
        onEdit={() => onEdit("personalFacts")}
      >
        {factsCount} petit{factsCount > 1 ? "s" : ""} détail{factsCount > 1 ? "s" : ""}
        {" · "}
        {memoriesCount} souvenir{memoriesCount > 1 ? "s" : ""}
        {" · "}
        {countRecapPhotos(q.photos)} photo{countRecapPhotos(q.photos) > 1 ? "s" : ""}
        {q.photos.some((p) => p.uploadStatus === "error")
          ? " (certaines non enregistrées)"
          : ""}
      </RecapBlock>

      <div
        className={cn(
          "rounded-xl border p-4 text-sm",
          richness.level === "INSUFFICIENT"
            ? "border-destructive/40 bg-destructive/10 text-destructive"
            : "border-border bg-muted/40 text-foreground",
        )}
      >
        {richness.level === "INSUFFICIENT" ? (
          <>
            <p className="font-medium">Encore quelques infos manquent</p>
            <p className="mt-1 opacity-90">{richness.message}</p>
          </>
        ) : (
          <p>{richnessClientMessage(richness.level)}</p>
        )}
      </div>

      {!isAuthenticated && (
        <p className="text-sm text-muted-foreground">
          Pour créer votre cahier,{" "}
          <Link
            href={`/auth/login?next=${encodeURIComponent("/questionnaire?claim=1")}`}
            className="underline"
          >
            connectez-vous ou créez un compte
          </Link>
          . Votre brouillon local est conservé.
        </p>
      )}

      {submitError && <p className="text-sm text-destructive">{submitError}</p>}
      {submitOk && <p className="text-sm text-chart-4">{submitOk}</p>}

      <Button
        type="button"
        size="lg"
        onClick={onSubmit}
        disabled={pending || richness.level === "INSUFFICIENT"}
      >
        {pending ? "Enregistrement…" : "Créer mon cahier"}
      </Button>
    </div>
  )
}
