import type { QuizThemeContext } from "./context"

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

export function buildQuizThemeSystemPrompt(ctx: QuizThemeContext): string {
  return [
    "Vous créez une page de quiz de CULTURE GÉNÉRALE THÉMATIQUE pour un cahier de vacances imprimé.",
    "Ce n'est PAS un quiz sur une personne. Aucune donnée personnelle n'est fournie et vous ne devez en inventer aucune.",
    "",
    `Univers / thème : ${ctx.universeName} (id: ${ctx.universeId || "n/a"}).`,
    `Difficulté : ${ctx.difficulty}/4 — ${difficultyGuidance(ctx.difficulty)}.`,
    `Nombre de questions : exactement ${ctx.targetQuestions}.`,
    "",
    "Objectif ludique :",
    "- Le joueur doit pouvoir se tromper ou chercher la réponse.",
    "- Questions intéressantes, accessibles selon la difficulté, jamais triviales.",
    "- Éviter absolument : « Quelle couleur est associée à la nature ? », « Quel animal vit dans la forêt ? » et tout QCM enfantin.",
    "",
    "Types de questions souhaités (selon l'univers) :",
    "- lieux, œuvres, notions, personnages, vocabulaire, faits remarquables,",
    "- géographie, histoire, science grand public, culture populaire — cohérents avec le thème.",
    "",
    "Diversité interne :",
    `- Variez les micro-sujets (champ topic). Pas ${ctx.targetQuestions} questions sur la même sous-thématique.`,
    "- Exemple NATURE : faune, flore, géographie, phénomènes, culture/science — pas 6 questions uniquement sur les arbres.",
    "",
    "Distracteurs :",
    "- 3 mauvaises réponses plausibles, même domaine, formes similaires, distinctes.",
    "- Pas d'absurde, pas de synonymes, pas de réponse évidente par sa forme.",
    "",
    "Indice dans la question :",
    "- La question ne doit pas contenir quasiment la réponse ni la traduire (ex. « mont Fuji japonais » → Japon).",
    "",
    "Stabilité factuelle :",
    "- Uniquement des connaissances raisonnablement stables et largement établies.",
    "- Éviter actualité, politique actuelle, classements en cours, records changeants, prix, stats récentes, résultats sportifs récents, « actuellement », années très récentes.",
    "- Si vous n'êtes pas certain d'un fait, ne l'utilisez pas.",
    "",
    "Chaque question doit avoir :",
    "- exactement 4 choix, correctIndex ∈ {0,1,2,3}",
    "- une explanation courte non vide (pourquoi la bonne réponse est correcte)",
    "- un topic court (sous-thème)",
    "",
    "Générez aussi un title court et élégant pour le quiz (style cahier de vacances), dérivé de l'univers — pas un titre générique plat.",
    "Répondez UNIQUEMENT via le schéma JSON imposé.",
  ].join("\n")
}

export function buildQuizThemeRepairSystemPrompt(
  base: string,
  validationErrors: string[],
): string {
  return [
    base,
    "",
    "Tentative de réparation : la génération précédente a échoué la validation.",
    "Corrigez UNIQUEMENT ces problèmes et renvoyez un JSON complet valide.",
    "Remplacez les questions faibles (triviales, réponse révélée, actualité, doublons, manque de diversité) sans inventer de trivia douteuse.",
    ...validationErrors.map((e) => `- ${e}`),
  ].join("\n")
}
