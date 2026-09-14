import { editorialPromptBlock, type QuizThemeContext } from "./context"

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
    editorialPromptBlock(ctx),
    "",
    "Objectif ludique :",
    "- Le joueur doit pouvoir se tromper ou chercher la réponse.",
    "- Questions intéressantes, accessibles selon la difficulté, jamais triviales.",
    "- Éviter absolument les QCM enfantins sans vraie connaissance.",
    "- Chaque topic de question doit coller aux sujets autorisés (et jamais aux exclus).",
    "",
    "Diversité interne :",
    `- Variez les micro-sujets (champ topic) à l'intérieur du cadre éditorial. Pas ${ctx.targetQuestions} questions sur la même sous-thématique.`,
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
    "- Pas de conseil médical, pas de diagnostic, pas de claims santé douteux.",
    "",
    "Chaque question doit avoir :",
    "- exactement 4 choix, correctIndex ∈ {0,1,2,3}",
    "- une explanation courte non vide (pourquoi la bonne réponse est correcte)",
    "- un topic court (sous-thème) aligné sur les sujets autorisés",
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
    "Remplacez les questions hors cadre éditorial, triviales, révélatrices, d'actualité, en doublon ou peu diversifiées — sans inventer de trivia douteuse.",
    ...validationErrors.map((e) => `- ${e}`),
  ].join("\n")
}
