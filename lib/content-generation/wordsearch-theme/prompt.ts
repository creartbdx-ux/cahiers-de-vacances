import { editorialPromptBlock, type WordSearchThemeContext } from "./context"
import type { GeneratedWordSearchThemeWord } from "./types"

function difficultyGuidance(level: number): string {
  switch (level) {
    case 1:
      return "mots très courants et plutôt courts (3–6 lettres après normalisation), familiers au grand public"
    case 2:
      return "vocabulaire accessible, mélange de mots courts et moyens"
    case 3:
      return "mélange accessible / intermédiaire — termes reconnaissables sans être triviaux"
    case 4:
      return "termes plus spécialisés mais jamais obscurs ni injustes — longueurs variées"
    default:
      return "mélange accessible / intermédiaire"
  }
}

function topicKeyPromptBlock(ctx: WordSearchThemeContext): string {
  if (ctx.allowedTopics.length) {
    return [
      "Classification thématique (topicKey) :",
      "- topicKey DOIT être exactement l'une des valeurs allowedTopics (enum).",
      `- Valeurs autorisées : ${ctx.allowedTopics.join(" | ")}.`,
      "- Ne jamais inventer un topicKey hors liste.",
    ].join("\n")
  }
  return [
    "Classification thématique (topicKey) :",
    "- topicKey : catégorie éditoriale courte de l'univers.",
  ].join("\n")
}

function wordRulesBlock(ctx: WordSearchThemeContext): string {
  const n = ctx.targetWords
  const diversityHint =
    ctx.allowedTopics.length >= 4
      ? `Si possible, répartissez les ${n} mots sur au moins 3 topicKeys distincts (max ~5 mots par topicKey).`
      : "Variez les topicKeys quand l'univers le permet."

  return [
    "Règles sur les mots :",
    "- Chaque mot doit appartenir clairement à l'univers éditorial.",
    "- Mots intéressants, reconnaissables, utilisables dans une grille de mots mêlés.",
    "- Évitez les termes trop obscurs ou trop génériques (ex. MOT, CHOSE, COULEUR).",
    "- Pas de doublons ni quasi-doublons (ex. PARFUM et PARFUMS).",
    "- display : forme lisible pour le joueur (majuscules acceptées, espaces/tirets/apostrophes OK).",
    "- Ne normalisez PAS vous-même : l'application dérivera la version moteur.",
    `- Longueur visée après normalisation : environ 3 à 12 caractères (lettres A-Z).`,
    `- Exactement ${n} mots.`,
    "",
    "Diversité thématique :",
    diversityHint,
    "- Ne répétez pas la même micro-thématique sur tous les mots.",
    "",
    topicKeyPromptBlock(ctx),
  ].join("\n")
}

export function buildWordSearchThemeSystemPrompt(ctx: WordSearchThemeContext): string {
  return [
    "Vous créez une liste de mots pour une page de MOTS MÊLÉS THÉMATIQUES dans un cahier de vacances imprimé.",
    "Ce n'est PAS un jeu sur une personne. Aucune donnée personnelle n'est fournie.",
    "",
    `Univers / thème : ${ctx.universeName} (id: ${ctx.universeId || "n/a"}).`,
    `Difficulté : ${ctx.difficulty}/4 — ${difficultyGuidance(ctx.difficulty)}.`,
    `Nombre de mots : exactement ${ctx.targetWords}.`,
    "",
    editorialPromptBlock(ctx),
    "",
    wordRulesBlock(ctx),
    "",
    "Générez aussi un title court et élégant pour la page.",
    "Répondez UNIQUEMENT via le schéma JSON imposé (title + words avec display et topicKey).",
  ].join("\n")
}

export function buildWordSearchThemeTargetedRepairPrompt(input: {
  baseSystem: string
  keptWords: Array<{ index1: number; word: GeneratedWordSearchThemeWord }>
  invalid: Array<{ index1: number; errors: string[] }>
  usedTopicKeys: string[]
}): string {
  const keptBlock = input.keptWords.map((k) => {
    const w = k.word
    return [
      `M${k.index1} (À CONSERVER TELLE QUELLE) :`,
      `  display=${w.display}`,
      `  topicKey=${w.topicKey}`,
      `  normalized=${w.normalized}`,
    ].join("\n")
  })

  const invalidBlock = input.invalid.map((inv) =>
    [
      `M${inv.index1} À REMPLACER :`,
      ...inv.errors.map((e) => `  - ${e}`),
    ].join("\n"),
  )

  return [
    input.baseSystem,
    "",
    "Réparation ciblée (une seule tentative) :",
    "Certains mots sont invalides. Conservez STRICTEMENT les mots listés comme valides.",
    "Renvoyez UNIQUEMENT les remplacements demandés (schéma replacements), pas la liste entière.",
    "Chaque remplacement doit porter le même index 1-based que le mot invalide.",
    "",
    "Mots valides à conserver (ne pas les réécrire) :",
    ...keptBlock,
    "",
    "Mots invalides à remplacer :",
    ...invalidBlock,
    "",
    `topicKeys déjà présents : ${input.usedTopicKeys.join(", ") || "—"}.`,
    "Les remplacements doivent respecter la diversité globale et allowedTopics / excludedTopics.",
  ].join("\n")
}

export function buildWordSearchThemeRepairSystemPrompt(
  base: string,
  validationErrors: string[],
): string {
  return [
    base,
    "",
    "Tentative de réparation : la génération précédente a échoué la validation.",
    "Corrigez UNIQUEMENT ces problèmes et renvoyez un JSON complet valide.",
    ...validationErrors.map((e) => `- ${e}`),
  ].join("\n")
}
