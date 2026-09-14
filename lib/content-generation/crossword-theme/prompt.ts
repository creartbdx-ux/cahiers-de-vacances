import { editorialPromptBlock, type CrosswordThemeContext } from "./context"
import type { GeneratedCrosswordThemeEntry } from "./types"

function difficultyGuidance(level: number): string {
  switch (level) {
    case 1:
      return "réponses très connues, définitions directes et accessibles"
    case 2:
      return "vocabulaire accessible, définitions claires"
    case 3:
      return "intermédiaire — formulations un peu plus indirectes, mots connus mais pas toujours évidents"
    case 4:
      return "difficile — termes plus spécialisés, clues plus indirectes, jamais ambigües ni obscures"
    default:
      return "intermédiaire"
  }
}

function topicKeyPromptBlock(ctx: CrosswordThemeContext): string {
  if (ctx.allowedTopics.length) {
    return [
      "Classification thématique (topicKey / topicLabel) :",
      "- topicKey DOIT être exactement l'une des valeurs allowedTopics (enum).",
      `- Valeurs autorisées : ${ctx.allowedTopics.join(" | ")}.`,
      "- topicLabel est un sous-thème libre et précis (ex. topicKey=parfums, topicLabel=concentration olfactive).",
      "- Ne jamais inventer un topicKey hors liste.",
    ].join("\n")
  }
  return [
    "Classification thématique (topicKey / topicLabel) :",
    "- topicKey : catégorie éditoriale courte de l'univers.",
    "- topicLabel : sous-thème libre plus précis.",
  ].join("\n")
}

export function buildCrosswordThemeSystemPrompt(ctx: CrosswordThemeContext): string {
  const n = ctx.targetEntries
  const diversityHint =
    ctx.allowedTopics.length >= 4
      ? `Si possible, répartissez les ${n} entrées sur au moins 3 topicKeys distincts (max ~4 entrées par topicKey).`
      : "Variez les topicKeys quand l'univers le permet."

  return [
    "Vous créez une page de MOTS CROISÉS THÉMATIQUES pour un cahier de vacances imprimé.",
    "Ce n'est PAS un jeu sur une personne. Aucune donnée personnelle n'est fournie.",
    "",
    `Univers / thème : ${ctx.universeName} (id: ${ctx.universeId || "n/a"}).`,
    `Difficulté : ${ctx.difficulty}/4 — ${difficultyGuidance(ctx.difficulty)}.`,
    `Nombre d'entrées : exactement ${n} couples (answer + clue).`,
    "",
    editorialPromptBlock(ctx),
    "",
    "Règles sur les réponses (answer) :",
    "- Chaque réponse doit appartenir clairement à l'univers éditorial.",
    "- Mots intéressants, reconnaissables, utilisables dans une grille de mots croisés.",
    "- Évitez les termes trop obscurs ou trop génériques.",
    "- Pas de doublons ni quasi-doublons (ex. PARFUM et PARFUMS).",
    "- answer : forme lisible (accents/espaces OK) ; l'application normalisera pour le moteur.",
    "- Longueur visée après normalisation : 3 à 12 lettres A–Z.",
    "- Préférez des mots d'une seule unité quand possible ; multi-mots OK s'ils restent courts après normalisation.",
    "",
    "Règles sur les définitions (clue) — QUALITÉ CRITIQUE :",
    "- La clue doit permettre réellement de retrouver la réponse.",
    "- Concise, claire, informative.",
    "- Ne jamais contenir directement la réponse ni la répéter trivialement.",
    "- Pas trop vague (« produit parfumé » pour PARFUM).",
    "- Pas triviale (« produit appelé sérum » pour SERUM).",
    "- Pas d'actualité, pas de connaissance ultra-spécialisée à difficulté moyenne.",
    "- Ne jamais augmenter la difficulté via une clue ambiguë ou douteuse.",
    "",
    "Variez la FORME des clues (pas 10 définitions identiques) :",
    "- définition classique, usage/fonction, origine, identification,",
    "- association, caractéristique distinctive, vocabulaire.",
    "",
    "Diversité thématique :",
    diversityHint,
    "",
    topicKeyPromptBlock(ctx),
    "",
    "Générez aussi un title court et élégant pour la page.",
    "Répondez UNIQUEMENT via le schéma JSON imposé (title + entries avec answer, clue, topicKey, topicLabel).",
  ].join("\n")
}

export function buildCrosswordThemeTargetedRepairPrompt(input: {
  baseSystem: string
  keptEntries: Array<{ index1: number; entry: GeneratedCrosswordThemeEntry }>
  invalid: Array<{ index1: number; errors: string[] }>
  usedTopicKeys: string[]
  engineFailure?: string | null
}): string {
  const keptBlock = input.keptEntries.map((k) => {
    const e = k.entry
    return [
      `E${k.index1} (À CONSERVER TELLE QUELLE) :`,
      `  answer=${e.answer}`,
      `  clue=${e.clue}`,
      `  topicKey=${e.topicKey}`,
      `  topicLabel=${e.topicLabel}`,
      `  normalized=${e.normalized}`,
    ].join("\n")
  })

  const invalidBlock = input.invalid.map((inv) =>
    [`E${inv.index1} À REMPLACER :`, ...inv.errors.map((e) => `  - ${e}`)].join("\n"),
  )

  return [
    input.baseSystem,
    "",
    "Réparation ciblée (une seule tentative) :",
    "Certaines entrées sont invalides ou empêchent la construction de la grille.",
    "Conservez STRICTEMENT les entrées listées comme valides.",
    "Renvoyez UNIQUEMENT les remplacements demandés (schéma replacements), pas la liste entière.",
    "Chaque remplacement doit porter le même index 1-based que l'entrée invalide.",
    "",
    ...(input.engineFailure
      ? [
          "Contexte moteur :",
          input.engineFailure,
          "La sélection est éditorialement valide mais ne permet pas de construire une grille satisfaisante.",
          "Remplacez les entrées ciblées par des réponses compatibles (lettres partagées utiles) du même univers.",
          "",
        ]
      : []),
    "Entrées valides à conserver (ne pas les réécrire) :",
    ...keptBlock,
    "",
    "Entrées invalides à remplacer :",
    ...invalidBlock,
    "",
    `topicKeys déjà présents : ${input.usedTopicKeys.join(", ") || "—"}.`,
    "Les remplacements doivent respecter la diversité et allowedTopics / excludedTopics.",
  ].join("\n")
}

export function buildCrosswordThemeRepairSystemPrompt(
  base: string,
  validationErrors: string[],
): string {
  return [
    base,
    "",
    "Tentative de réparation : la génération précédente a échoué la validation ou la construction de grille.",
    "Corrigez UNIQUEMENT ces problèmes et renvoyez un JSON complet valide.",
    ...validationErrors.map((e) => `- ${e}`),
  ].join("\n")
}
