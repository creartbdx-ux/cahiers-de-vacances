import { deriveCreatorIsParticipant } from "./audience"
import { resolveCreatorFromQuestionnaire } from "./creator"
import { isPhotoPersisted } from "./photos"
import type {
  BookProfileV1,
  GamePreferences,
  QuestionnaireV1,
  VisualPreferences,
} from "./types"
import { QUESTIONNAIRE_SCHEMA_VERSION } from "./types"

/**
 * Deterministic transform: questionnaire → BookProfileV1.
 * Never invents fields — only copies / reshapes provided answers.
 */
export function buildBookProfile(questionnaire: QuestionnaireV1): BookProfileV1 {
  if (questionnaire.schemaVersion !== QUESTIONNAIRE_SCHEMA_VERSION) {
    throw new Error(`Unsupported questionnaire schemaVersion: ${questionnaire.schemaVersion}`)
  }
  if (!questionnaire.audience) {
    throw new Error("Cannot build profile without audience.")
  }
  if (!questionnaire.forbiddenTopics?.answered) {
    throw new Error("Cannot build profile without explicit forbiddenTopics answer.")
  }
  const difficulty = questionnaire.gamePreferences.difficulty
  if (difficulty !== 1 && difficulty !== 2 && difficulty !== 3 && difficulty !== 4) {
    throw new Error("Cannot build profile without valid difficulty.")
  }
  if (!questionnaire.visualPreferences.paletteId || !questionnaire.visualPreferences.styleId) {
    throw new Error("Cannot build profile without visual preferences.")
  }
  if (!questionnaire.gamePreferences.likedTypes?.length) {
    throw new Error("Cannot build profile without game preferences.")
  }

  const audience = questionnaire.audience
  const creatorIsParticipant = deriveCreatorIsParticipant(
    audience,
    questionnaire.creatorIsParticipant,
  )
  const creator = resolveCreatorFromQuestionnaire(questionnaire, creatorIsParticipant)

  const gamePreferences: GamePreferences = {
    likedTypes: [...questionnaire.gamePreferences.likedTypes],
    difficulty,
    ...(questionnaire.gamePreferences.dislikedTypes?.length
      ? { dislikedTypes: [...questionnaire.gamePreferences.dislikedTypes] }
      : {}),
  }

  const visualPreferences: VisualPreferences = {
    paletteId: questionnaire.visualPreferences.paletteId,
    styleId: questionnaire.visualPreferences.styleId,
  }

  const individualProfiles = questionnaire.participants.map((p) => ({
    participantId: p.id,
    traits: [...(questionnaire.personality.traitsByParticipantId[p.id] ?? [])],
    ...(p.personalTrait?.trim() ? { personalTrait: p.personalTrait.trim() } : {}),
  }))

  const profile: BookProfileV1 = {
    schemaVersion: 1,
    audience,
    creatorIsParticipant,
    creator,
    participants: questionnaire.participants.map((p) => ({
      id: p.id,
      firstName: p.firstName.trim(),
      ...(p.ageBracket ? { ageBracket: p.ageBracket } : {}),
      ...(p.birthDate?.trim() ? { birthDate: p.birthDate.trim() } : {}),
      ...(typeof p.approximateAge === "number" && p.approximateAge > 0
        ? { approximateAge: p.approximateAge }
        : {}),
      ...(p.nickname?.trim() ? { nickname: p.nickname.trim() } : {}),
      ...(p.relationship?.trim() ? { relationship: p.relationship.trim() } : {}),
      ...(p.personalTrait?.trim() ? { personalTrait: p.personalTrait.trim() } : {}),
    })),
    sharedProfile: {
      interestUniverseIds: [...questionnaire.interestUniverseIds],
      ...(questionnaire.interestFreeText?.trim()
        ? { interestFreeText: questionnaire.interestFreeText.trim() }
        : {}),
      ...(questionnaire.personality.duoDescription?.trim()
        ? { duoDescription: questionnaire.personality.duoDescription.trim() }
        : {}),
      ...(questionnaire.personality.duoDynamics?.length
        ? { duoDynamics: [...questionnaire.personality.duoDynamics] }
        : {}),
      ...(questionnaire.personality.groupTraits?.length
        ? { groupTraits: [...questionnaire.personality.groupTraits] }
        : {}),
      ...(questionnaire.personality.freeText?.trim()
        ? { personalityFreeText: questionnaire.personality.freeText.trim() }
        : {}),
    },
    individualProfiles,
    personalFacts: questionnaire.personalFacts
      .filter((f) => f.value.trim())
      .map((f) => ({
        id: f.id,
        category: f.category,
        value: f.value.trim(),
        ...(f.participantIds?.length ? { participantIds: [...f.participantIds] } : {}),
      })),
    memories: questionnaire.memories
      .filter((m) => m.text.trim())
      .map((m) => ({
        id: m.id,
        text: m.text.trim(),
        ...(m.title?.trim() ? { title: m.title.trim() } : {}),
        ...(m.place?.trim() ? { place: m.place.trim() } : {}),
        ...(m.participantIds?.length ? { participantIds: [...m.participantIds] } : {}),
      })),
    insideJokes: questionnaire.insideJokes
      .filter((j) => j.text.trim())
      .map((j) => ({
        id: j.id,
        text: j.text.trim(),
        ...(j.participantIds?.length ? { participantIds: [...j.participantIds] } : {}),
      })),
    gamePreferences,
    visualPreferences,
    forbiddenTopics: {
      answered: true,
      hasRestrictions: questionnaire.forbiddenTopics.hasRestrictions,
      ...(questionnaire.forbiddenTopics.text?.trim()
        ? { text: questionnaire.forbiddenTopics.text.trim() }
        : {}),
      ...(questionnaire.forbiddenTopics.peopleToAvoid?.trim()
        ? { peopleToAvoid: questionnaire.forbiddenTopics.peopleToAvoid.trim() }
        : {}),
    },
    photos: questionnaire.photos
      .filter((p) => p.useAuthorized && isPhotoPersisted(p))
      .map((p) => ({
        id: p.id,
        useAuthorized: p.useAuthorized,
        ...(p.storagePath ? { storagePath: p.storagePath } : {}),
        ...(p.caption?.trim() ? { caption: p.caption.trim() } : {}),
        ...(p.anecdote?.trim() ? { anecdote: p.anecdote.trim() } : {}),
        ...(p.participantIds?.length ? { participantIds: [...p.participantIds] } : {}),
      })),
    ...(questionnaire.finalMessage?.trim()
      ? { finalMessage: questionnaire.finalMessage.trim() }
      : {}),
    ...(questionnaire.lastNote?.trim() ? { lastNote: questionnaire.lastNote.trim() } : {}),
  }

  if (questionnaire.duoType) profile.duoType = questionnaire.duoType
  if (questionnaire.groupName?.trim()) profile.groupName = questionnaire.groupName.trim()

  const closePeople = (questionnaire.closePeople ?? [])
    .filter((c) => c.firstName.trim())
    .map((c) => ({
      id: c.id,
      firstName: c.firstName.trim(),
      ...(c.relationship?.trim() ? { relationship: c.relationship.trim() } : {}),
    }))
  if (closePeople.length) profile.closePeople = closePeople

  if (questionnaire.lifeContext) {
    const lc = questionnaire.lifeContext
    const cleaned: NonNullable<BookProfileV1["lifeContext"]> = {}
    if (lc.hasChildren === true || lc.hasChildren === false) cleaned.hasChildren = lc.hasChildren
    if (typeof lc.childrenCount === "number") cleaned.childrenCount = lc.childrenCount
    if (lc.childrenNames?.some((n) => n.trim())) {
      cleaned.childrenNames = lc.childrenNames.map((n) => n.trim()).filter(Boolean)
    }
    if (lc.inCouple === true || lc.inCouple === false) cleaned.inCouple = lc.inCouple
    if (lc.hasFamilyNearby === true || lc.hasFamilyNearby === false) {
      cleaned.hasFamilyNearby = lc.hasFamilyNearby
    }
    if (lc.hasPet === true || lc.hasPet === false) cleaned.hasPet = lc.hasPet
    if (lc.petNames?.some((n) => n.trim())) {
      cleaned.petNames = lc.petNames.map((n) => n.trim()).filter(Boolean)
    }
    if (lc.livingSituation) cleaned.livingSituation = lc.livingSituation
    if (lc.notes?.trim()) cleaned.notes = lc.notes.trim()
    if (Object.keys(cleaned).length) profile.lifeContext = cleaned
  }

  return profile
}
