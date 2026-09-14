import { editorialPromptBlock, type QuizThemeContext } from "./context"
import {
  QUIZ_THEME_QUESTION_STYLES,
  QUIZ_THEME_STYLE_GUIDANCE,
} from "./styles"
import type { GeneratedQuizThemeQuestion } from "./types"

function difficultyGuidance(level: number): string {
  switch (level) {
    case 1:
      return "très accessible — connaissances grand public, jamais infantilisantes ni triviales"
    case 2:
      return "accessible — culture générale courante"
    case 3:
      return "intermédiaire — plusieurs réponses plausibles, une vraie connaissance est nécessaire, pas de piège obscur ni d'ambiguïté"
    case 4:
      return "difficile / amateur averti — faits stables et vérifiables, jamais d'ambiguïté pour « augmenter » la difficulté"
    default:
      return "intermédiaire"
  }
}

function questionStylePromptBlock(targetQuestions: number): string {
  const lines = QUIZ_THEME_QUESTION_STYLES.map(
    (s) => `- ${s} : ${QUIZ_THEME_STYLE_GUIDANCE[s]}`,
  )
  return [
    "Diversité de FORME (questionStyle) — obligatoire :",
    "Ne créez pas six questions construites sur la même mécanique.",
    "Le quiz doit varier les angles et les formes pour donner l'impression d'un vrai jeu, pas d'une fiche de formation.",
    `Pour ${targetQuestions} questions : au plus 2 du même questionStyle, au moins 3 styles distincts, et évitez deux fois le même style d'affilée.`,
    "Chaque question DOIT déclarer un questionStyle parmi :",
    ...lines,
    "Visez un mix raisonnable adapté à l'univers — sans forcer un style inadapté.",
    "La diversité de forme ne remplace PAS la difficulté : à difficulté 3, une question FUNCTION ne doit pas être évidente.",
  ].join("\n")
}

function topicKeyPromptBlock(ctx: QuizThemeContext): string {
  if (ctx.allowedTopics.length) {
    return [
      "Classification thématique (topicKey / topicLabel) :",
      "- topicKey DOIT être exactement l'une des valeurs allowedTopics (enum).",
      `- Valeurs autorisées : ${ctx.allowedTopics.join(" | ")}.`,
      "- topicLabel est un sous-thème libre et précis pour le debug (ex. topicKey=parfums, topicLabel=concentration olfactive).",
      "- Ne jamais inventer un topicKey hors liste.",
    ].join("\n")
  }
  return [
    "Classification thématique (topicKey / topicLabel) :",
    "- topicKey : catégorie éditoriale courte de l'univers.",
    "- topicLabel : sous-thème libre plus précis.",
  ].join("\n")
}

export function buildQuizThemeSystemPrompt(ctx: QuizThemeContext): string {
  return [
    "Vous créez une page de quiz de CULTURE GÉNÉRALE THÉMATIQUE pour un cahier de vacances imprimé.",
    "Ce n'est PAS un quiz sur une personne. Aucune donnée personnelle n'est fournie et vous ne devez en inventer aucune.",
    "",
    `Univers / thème : ${ctx.universeName} (id: ${ctx.universeId || "n/a"}).`,
    `Difficulté : ${ctx.difficulty}/4 — ${difficultyGuidance(ctx.difficulty)}.`,
    `Nombre de questions : exactement ${ctx.targetQuestions}.`,
    "",
    editorialPromptBlock(ctx),
    "",
    "Objectif ludique :",
    "- Le joueur doit pouvoir se tromper ou chercher la réponse.",
    "- Questions intéressantes, accessibles selon la difficulté, jamais triviales.",
    "- Éviter absolument les QCM enfantins sans vraie connaissance.",
    "",
    topicKeyPromptBlock(ctx),
    "",
    questionStylePromptBlock(ctx.targetQuestions),
    "",
    "Diversité de SUJETS (topicKey) :",
    `- Variez les topicKey à l'intérieur du cadre. Pas ${ctx.targetQuestions} questions sur le même topicKey.`,
    "",
    "Distracteurs :",
    "- 3 mauvaises réponses plausibles, même domaine, formes similaires, distinctes.",
    "- Pas d'absurde, pas de synonymes, pas de réponse évidente par sa forme.",
    "",
    "Indice dans la question :",
    "- La question ne doit pas contenir quasiment la réponse ni la traduire.",
    "",
    "Stabilité factuelle :",
    "- Uniquement des connaissances raisonnablement stables et largement établies.",
    "- Éviter actualité, politique actuelle, classements en cours, records changeants, prix, stats récentes.",
    "- Si vous n'êtes pas certain d'un fait, ne l'utilisez pas.",
    "- Pas de conseil médical, pas de diagnostic, pas de claims santé douteux.",
    "",
    "Chaque question doit avoir :",
    "- exactement 4 choix, correctIndex ∈ {0,1,2,3}",
    "- un questionStyle (enum)",
    "- un topicKey (enum allowedTopics si fourni) + topicLabel précis",
    "- une explanation courte non vide",
    "",
    "Générez aussi un title court et élégant pour le quiz.",
    "Répondez UNIQUEMENT via le schéma JSON imposé.",
  ].join("\n")
}

export function buildQuizThemeTargetedRepairPrompt(input: {
  baseSystem: string
  keptQuestions: Array<{ index1: number; question: GeneratedQuizThemeQuestion }>
  invalid: Array<{ index1: number; errors: string[] }>
  usedStyles: string[]
  usedTopicKeys: string[]
}): string {
  const keptBlock = input.keptQuestions.map((k) => {
    const q = k.question
    return [
      `Q${k.index1} (À CONSERVER TELLE QUELLE) :`,
      `  questionStyle=${q.questionStyle}`,
      `  topicKey=${q.topicKey}`,
      `  topicLabel=${q.topicLabel}`,
      `  question=${q.question}`,
    ].join("\n")
  })

  const invalidBlock = input.invalid.map((inv) =>
    [
      `Q${inv.index1} À REMPLACER :`,
      ...inv.errors.map((e) => `  - ${e}`),
    ].join("\n"),
  )

  return [
    input.baseSystem,
    "",
    "Réparation ciblée (une seule tentative) :",
    "Certaines questions du quiz sont invalides. Conservez STRICTEMENT les questions listées comme valides.",
    "Renvoyez UNIQUEMENT les questions de remplacement demandées (schéma replacements), pas le quiz entier.",
    "Chaque remplacement doit porter le même index 1-based que la question invalide.",
    "",
    "Questions valides à conserver (ne pas les réécrire) :",
    ...keptBlock,
    "",
    "Questions invalides à remplacer :",
    ...invalidBlock,
    "",
    `questionStyles déjà présents dans le quiz conservé : ${input.usedStyles.join(", ") || "—"}.`,
    `topicKeys déjà présents dans le quiz conservé : ${input.usedTopicKeys.join(", ") || "—"}.`,
    "Les remplacements doivent respecter la diversité globale (styles ≤2, ≥3 distincts, pas deux identiques d'affilée) une fois réintégrés.",
    "Ne créez pas de questions triviales. Respectez allowedTopics / excludedTopics.",
  ].join("\n")
}

/** @deprecated Prefer buildQuizThemeTargetedRepairPrompt — kept for full-regeneration edge cases. */
export function buildQuizThemeRepairSystemPrompt(
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
