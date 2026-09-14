import { editorialPromptBlock, type QuizThemeContext } from "./context"
import {
  QUIZ_THEME_QUESTION_STYLES,
  QUIZ_THEME_STYLE_GUIDANCE,
} from "./styles"

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
    "Visez un mix raisonnable (vocabulaire, différence, curiosité / histoire, identification, fonction, séquence, association…) adapté à l'univers — sans forcer un style inadapté.",
    "La diversité de forme ne remplace PAS la difficulté : à difficulté 3, une question FUNCTION ne doit pas être évidente (ex. éviter « À quoi sert un mascara ? »).",
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
    "- Chaque topic de question doit coller aux sujets autorisés (et jamais aux exclus).",
    "",
    questionStylePromptBlock(ctx.targetQuestions),
    "",
    "Diversité de SUJETS (topic) :",
    `- Variez les micro-sujets à l'intérieur du cadre éditorial. Pas ${ctx.targetQuestions} questions sur la même sous-thématique.`,
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
    "- un questionStyle (enum)",
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
  const overused = validationErrors
    .filter((e) => /Style \w+ surutilisé/i.test(e) || /même questionStyle/i.test(e))
    .join("\n")
  return [
    base,
    "",
    "Tentative de réparation : la génération précédente a échoué la validation.",
    "Corrigez UNIQUEMENT ces problèmes et renvoyez un JSON complet valide.",
    "Remplacez les questions hors cadre éditorial, triviales, révélatrices, d'actualité, en doublon, ou trop uniformes de forme — sans inventer de trivia douteuse.",
    "Redistribuez les questionStyle : maximum 2 par style, ≥ 3 styles distincts, pas deux identiques d'affilée.",
    ...(overused
      ? ["Styles déjà problématiques à corriger en priorité :", overused]
      : []),
    ...validationErrors.map((e) => `- ${e}`),
  ].join("\n")
}
