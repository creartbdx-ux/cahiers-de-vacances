/**
 * Synthetic BookProfile fixtures for personalization depth / Blueprint tests.
 */

import type { BookProfileV1 } from "@/lib/questionnaire/types"
import { newId } from "@/lib/questionnaire/types"

/** CORE only — no memories, photos, jokes, close people. */
export function fixtureProfileLight(over: Partial<BookProfileV1> = {}): BookProfileV1 {
  return {
    schemaVersion: 1,
    audience: "OTHER_PERSON",
    creatorIsParticipant: false,
    creator: { firstName: "Emma", isParticipant: false, participantId: null },
    participants: [
      {
        id: "p_laure",
        firstName: "Laure",
        ageBracket: "26-35",
        relationship: "sœur",
      },
    ],
    sharedProfile: {
      interestUniverseIds: ["TRAVEL", "FOOD", "MUSIC"],
    },
    individualProfiles: [
      { participantId: "p_laure", traits: ["drôle", "solaire", "créatif"] },
    ],
    personalFacts: [],
    memories: [],
    insideJokes: [],
    gamePreferences: { likedTypes: ["QUIZ", "WORDSEARCH", "CROSSWORD"], difficulty: 2 },
    visualPreferences: { paletteId: "ORANGE", styleId: "RETRO" },
    forbiddenTopics: { answered: true, hasRestrictions: false },
    photos: [],
    ...over,
  }
}

/** CORE + close people + life context + a few facts. */
export function fixtureProfilePersonalized(over: Partial<BookProfileV1> = {}): BookProfileV1 {
  return fixtureProfileLight({
    closePeople: [
      { id: newId("cp"), firstName: "Emma", relationship: "sœur" },
      { id: newId("cp"), firstName: "Lolo", relationship: "ami" },
    ],
    lifeContext: {
      hasChildren: false,
      inCouple: true,
      hasPet: true,
      petNames: ["Moustache"],
    },
    personalFacts: [
      { id: newId("f"), category: "FOOD", value: "Raclette" },
      { id: newId("f"), category: "PLACE", value: "Bretagne" },
    ],
    ...over,
  })
}

/** Full deep personalization matter. */
export function fixtureProfileRich(over: Partial<BookProfileV1> = {}): BookProfileV1 {
  return fixtureProfilePersonalized({
    memories: [
      { id: newId("m"), text: "Week-end improvisé à la mer" },
      { id: newId("m"), text: "Anniversaire surprise au restaurant" },
    ],
    insideJokes: [{ id: newId("j"), text: "La blague du train de nuit" }],
    photos: [
      { id: newId("ph"), useAuthorized: true, storagePath: "books/t/1.jpg", caption: "Mer" },
      { id: newId("ph"), useAuthorized: true, storagePath: "books/t/2.jpg", caption: "Fête" },
      { id: newId("ph"), useAuthorized: true, storagePath: "books/t/3.jpg", caption: "Café" },
    ],
    participants: [
      {
        id: "p_laure",
        firstName: "Laure",
        ageBracket: "26-35",
        birthDate: "1994-06-12",
        relationship: "sœur",
      },
    ],
    ...over,
  })
}
