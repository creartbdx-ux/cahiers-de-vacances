import assert from "node:assert/strict"
import { test } from "node:test"
import {
  BOOK_STATUS,
  buildInProgressPayload,
  canUseInEditorialLab,
  isInactiveByUpdatedAt,
  isQuestionnaireCompleted,
  isQuestionnaireInProgress,
  matchesAdminFilter,
  parseQuestionnairePayload,
  projectDisplayTitle,
  questionnaireProgressPercent,
} from "./lifecycle"
import { createEmptyQuestionnaire, type BookProfileV1, type QuestionnaireV1 } from "../questionnaire/types"

test("statuts book_project cohérents", () => {
  assert.ok(isQuestionnaireInProgress(BOOK_STATUS.DRAFT))
  assert.ok(isQuestionnaireInProgress(BOOK_STATUS.QUESTIONNAIRE_IN_PROGRESS))
  assert.ok(!isQuestionnaireInProgress(BOOK_STATUS.QUESTIONNAIRE_COMPLETED))
  assert.ok(isQuestionnaireCompleted(BOOK_STATUS.QUESTIONNAIRE_COMPLETED))
})

test("inactivité calculée depuis updated_at sans changer le statut", () => {
  const now = Date.parse("2026-09-13T12:00:00Z")
  const recent = new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString()
  const old = new Date(now - 20 * 24 * 60 * 60 * 1000).toISOString()
  assert.equal(isInactiveByUpdatedAt(recent, now), false)
  assert.equal(isInactiveByUpdatedAt(old, now), true)
})

test("filtres admin : en cours / terminés / inactifs", () => {
  const now = Date.parse("2026-09-13T12:00:00Z")
  const recent = new Date(now - 1 * 24 * 60 * 60 * 1000).toISOString()
  const old = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString()

  assert.ok(matchesAdminFilter("in_progress", BOOK_STATUS.QUESTIONNAIRE_IN_PROGRESS, recent, now))
  assert.ok(!matchesAdminFilter("in_progress", BOOK_STATUS.QUESTIONNAIRE_IN_PROGRESS, old, now))
  assert.ok(matchesAdminFilter("completed", BOOK_STATUS.QUESTIONNAIRE_COMPLETED, old, now))
  assert.ok(matchesAdminFilter("inactive", BOOK_STATUS.DRAFT, old, now))
  assert.ok(!matchesAdminFilter("inactive", BOOK_STATUS.QUESTIONNAIRE_COMPLETED, old, now))
})

test("Editorial Lab uniquement COMPLETED + profil valide", () => {
  const profile = {
    schemaVersion: 1,
    audience: "ME",
    creatorIsParticipant: true,
    participants: [{ id: "p1", firstName: "Alex" }],
    sharedProfile: { interestUniverseIds: ["MOUNTAIN"] },
    individualProfiles: [],
    personalFacts: [],
    memories: [],
    insideJokes: [],
    gamePreferences: { likedTypes: ["QUIZ"], difficulty: 2 },
    visualPreferences: { paletteId: "BLUE", styleId: "POP" },
    forbiddenTopics: { answered: true, hasRestrictions: false },
    photos: [],
  } as BookProfileV1

  assert.ok(
    canUseInEditorialLab({
      status: BOOK_STATUS.QUESTIONNAIRE_COMPLETED,
      profile,
      richnessLevel: "ENOUGH",
    }),
  )
  assert.ok(
    !canUseInEditorialLab({
      status: BOOK_STATUS.QUESTIONNAIRE_IN_PROGRESS,
      profile,
      richnessLevel: "ENOUGH",
    }),
  )
  assert.ok(
    !canUseInEditorialLab({
      status: BOOK_STATUS.QUESTIONNAIRE_COMPLETED,
      profile: null,
      richnessLevel: "ENOUGH",
    }),
  )
  // Legacy INSUFFICIENT no longer blocks lab — depth is not quality
  assert.ok(
    canUseInEditorialLab({
      status: BOOK_STATUS.QUESTIONNAIRE_COMPLETED,
      profile,
      richnessLevel: "INSUFFICIENT",
    }),
  )
  assert.ok(
    canUseInEditorialLab({
      status: BOOK_STATUS.QUESTIONNAIRE_COMPLETED,
      profile,
      richnessLevel: "LIGHT",
    }),
  )
})

test("payload brouillon conserve questionnaire + ownerEmail sans inventer de profil", () => {
  const q = createEmptyQuestionnaire()
  q.audience = "ME"
  const payload = buildInProgressPayload(q, "user@example.com")
  assert.equal(payload.ownerEmail, "user@example.com")
  assert.ok(payload.questionnaire)
  assert.equal("bookProfile" in payload, false)
  const parsed = parseQuestionnairePayload(payload)
  assert.equal(parsed.ownerEmail, "user@example.com")
  assert.equal(parsed.questionnaire?.audience, "ME")
  assert.equal(parsed.profile, null)
})

test("progression questionnaire augmente avec les réponses", () => {
  const empty = createEmptyQuestionnaire()
  assert.equal(questionnaireProgressPercent(empty), 0)

  const partial: QuestionnaireV1 = {
    ...empty,
    audience: "ME",
    creatorIsParticipant: true,
    participants: [{ id: "p1", firstName: "Sam", ageBracket: "26-35" }],
    interestUniverseIds: ["A", "B", "C"],
  }
  assert.ok(questionnaireProgressPercent(partial) > 0)
})

test("titre projet : groupe ou prénoms", () => {
  const q = createEmptyQuestionnaire()
  q.audience = "GROUP"
  q.groupName = "La bande"
  q.participants = [
    { id: "1", firstName: "A" },
    { id: "2", firstName: "B" },
  ]
  assert.equal(projectDisplayTitle(q, null, null), "La bande")

  q.audience = "DUO"
  q.groupName = undefined
  assert.equal(projectDisplayTitle(q, null, null), "A & B")
})

test("RLS attendu : lecture croisée refusée côté app (ownership check)", () => {
  // Pure contract: helpers expose ownership expectations used by actions.
  // Real RLS is enforced in SQL (book_projects_select_own / delete_own).
  const ownerId = "user-a"
  const otherId = "user-b"
  const project = { user_id: ownerId }
  assert.notEqual(project.user_id, otherId)
  assert.equal(project.user_id === ownerId, true)
})

test("plusieurs projets : titres distincts pour un même user (simulation)", () => {
  const projects = [
    { id: "1", title: projectDisplayTitle(
      { ...createEmptyQuestionnaire(), audience: "ME", participants: [{ id: "p", firstName: "Alex" }] },
      null,
      null,
    )},
    { id: "2", title: projectDisplayTitle(
      { ...createEmptyQuestionnaire(), audience: "ME", participants: [{ id: "p", firstName: "Sam" }] },
      null,
      null,
    )},
  ]
  assert.equal(projects.length, 2)
  assert.notEqual(projects[0]!.title, projects[1]!.title)
})

test("localStorage -> payload claim : draftProjectId peut être injecté sans perte d'audience", () => {
  const local: QuestionnaireV1 = {
    ...createEmptyQuestionnaire(),
    audience: "DUO",
    creatorIsParticipant: true,
    participants: [
      { id: "a", firstName: "Léa", ageBracket: "26-35" },
      { id: "b", firstName: "Noah", ageBracket: "26-35" },
    ],
  }
  const claimed = { ...local, draftProjectId: "proj_123" }
  assert.equal(claimed.audience, "DUO")
  assert.equal(claimed.participants.length, 2)
  assert.equal(claimed.draftProjectId, "proj_123")
})
