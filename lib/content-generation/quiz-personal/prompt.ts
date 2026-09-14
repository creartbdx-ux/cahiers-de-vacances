import type { QuizPersonalSourceContext } from "../types"
import { quizPersonalQuestionRange, countSourceUnits } from "../source-context"

export function buildQuizPersonalSystemPrompt(ctx: QuizPersonalSourceContext): string {
  const sourceCount = countSourceUnits(ctx)
  const range = quizPersonalQuestionRange(sourceCount)

  const audienceTone =
    ctx.audience === "ME"
      ? "Adresse-toi directement à la personne (tu / vous selon un ton chaleureux de cahier)."
      : ctx.audience === "OTHER_PERSON"
        ? "Les questions portent sur la personne destinataire (3e personne)."
        : ctx.audience === "DUO"
          ? "Varie entre chaque membre du duo et leur relation, uniquement selon les sources fournies."
          : "Varie entre membres du groupe et faits collectifs, uniquement selon les sources fournies."

  return [
    "Tu génères le contenu d'un QUIZ PERSONNALISÉ pour un cahier de vacances imprimé.",
    "Tu ne reçois QUE les sources autorisées listées dans le JSON utilisateur. Tu n'inventes AUCUN fait personnel.",
    "",
    "Règles absolues :",
    "- Chaque question doit être justifiée par au moins un sourceRef (FACT, MEMORY, JOKE ou PARTICIPANT) dont l'id existe dans les sources fournies.",
    "- La bonne réponse (correctIndex) doit être strictement fondée sur ces sources. Jamais de fait personnel inventé.",
    "- Les formulations peuvent être créatives et amusantes (pas une répétition mécanique du questionnaire).",
    "- Les 3 distracteurs peuvent être inventés pour le jeu, mais ne doivent jamais :",
    "  • être présentés comme de vrais faits sur la personne",
    "  • être blessants ou sensibles",
    "  • réutiliser une autre vraie donnée du contexte comme fausse piste ambiguë",
    "  • évoquer les sujets interdits",
    "- Exactement 4 choix par question, correctIndex ∈ {0,1,2,3}.",
    `- Nombre de questions : entre ${range.min} et ${range.max} (sources disponibles : ${sourceCount}).`,
    "- Évite deux questions qui reposent sur exactement le même fait/souvenir/joke si d'autres sources sont disponibles.",
    "- Réponds UNIQUEMENT via le schéma JSON imposé.",
    "",
    `Audience structurée : ${ctx.audience}. ${audienceTone}`,
    ctx.forbiddenTopics.hasRestrictions
      ? `Sujets interdits (ne jamais poser de question, allusion ou distracteur dessus) : ${[
          ctx.forbiddenTopics.text,
          ctx.forbiddenTopics.peopleToAvoid,
        ]
          .filter(Boolean)
          .join(" | ")}`
      : "Aucun sujet interdit déclaré.",
  ].join("\n")
}

export function buildQuizPersonalUserPayload(ctx: QuizPersonalSourceContext): unknown {
  return {
    audience: ctx.audience,
    participants: ctx.participants,
    facts: ctx.facts,
    memories: ctx.memories,
    jokes: ctx.jokes,
    ...(ctx.interests.length ? { interests: ctx.interests } : {}),
    forbiddenTopics: ctx.forbiddenTopics,
  }
}

export function buildQuizPersonalRepairSystemPrompt(
  base: string,
  validationErrors: string[],
): string {
  return [
    base,
    "",
    "Tentative de réparation : la génération précédente a échoué la validation.",
    "Corrige UNIQUEMENT ces problèmes et renvoie un JSON complet valide :",
    ...validationErrors.map((e) => `- ${e}`),
  ].join("\n")
}
