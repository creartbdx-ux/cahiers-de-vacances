import type { QuizPersonalSourceContext } from "../types"
import { quizPersonalQuestionRange, countSourceUnits } from "../source-context"

function audienceStrategyBlock(ctx: QuizPersonalSourceContext): string {
  const readers = ctx.targetParticipantNames.join(", ") || "le destinataire"
  switch (ctx.audience) {
    case "ME":
      return [
        `Audience ME — lecteur : ${readers} (soi-même).`,
        "Ne pose PAS un interrogatoire administratif (« Quelle est votre couleur préférée ? »).",
        "Privilégie souvenirs, petites habitudes, situations et clins d'œil.",
        "Adresse-toi directement au lecteur (ton cahier chaleureux).",
      ].join("\n")
    case "OTHER_PERSON":
      return [
        `Audience OTHER_PERSON — le sujet du profil est AUSSI le lecteur du cahier : ${readers}.`,
        "Adressez-vous à lui/elle directement (vouvoiement).",
        "Le but n'est PAS de tester si un tiers connaît cette personne, ni si elle se « connaît » elle-même.",
        "Transformez souvenirs, habitudes et goûts en petits défis et clins d'œil.",
        "Évitez la 3e personne sur le destinataire (« Quelle série Emma… », « la couleur préférée d'Emma »).",
        "Préférez des mises en situation ludiques où la bonne réponse reste strictement fondée sur une source.",
      ].join("\n")
    case "DUO":
      return [
        `Audience DUO — lecteurs / sujets : ${readers}.`,
        "Variez entre chaque personne et leurs souvenirs communs, uniquement selon les sources.",
        "Les questions croisées sont bienvenues si les sources le permettent.",
      ].join("\n")
    case "GROUP":
      return [
        `Audience GROUP — lecteurs / sujets : ${readers}.`,
        "Les questions « qui dans le groupe… » ou « qui connaît… » peuvent être pertinentes.",
        "Variez membres et faits collectifs, uniquement selon les sources fournies.",
      ].join("\n")
    default:
      return `Audience : ${ctx.audience}. Lecteur(s) : ${readers}.`
  }
}

export function buildQuizPersonalSystemPrompt(ctx: QuizPersonalSourceContext): string {
  const sourceCount = countSourceUnits(ctx)
  const range = quizPersonalQuestionRange(sourceCount)
  const high = [...ctx.facts, ...ctx.memories, ...ctx.jokes].filter((s) => s.quizValue === "HIGH").length
  const low = [...ctx.facts, ...ctx.memories, ...ctx.jokes].filter((s) => s.quizValue === "LOW").length

  return [
    "Vous créez une page de cahier de vacances personnalisée, destinée à être amusante à remplir.",
    "Vous ne créez PAS un questionnaire administratif sur la personne.",
    "Vous ne recevez QUE les sources autorisées listées dans le JSON utilisateur. Vous n'inventez AUCUN fait personnel.",
    "",
    audienceStrategyBlock(ctx),
    "",
    "Perspective & ton :",
    `- Métadonnées lecteur : audience=${ctx.audience}, creatorIsParticipant=${ctx.creatorIsParticipant}, targetParticipantNames=${JSON.stringify(ctx.targetParticipantNames)}.`,
    `- Difficulté slot : ${ctx.difficulty}/4 — augmentez le défi via distracteurs proches, détail précis d'un souvenir, formulation moins littérale, ou combinaison de sources. JAMAIS via invention.`,
    "",
    "Priorité éditoriale des sources (champ quizValue) :",
    "- HIGH (anecdotes, souvenirs détaillés, inside jokes, habitudes amusantes) : à privilégier pour les questions principales.",
    "- MEDIUM : utiles en mise en situation ou combinées.",
    "- LOW (couleur / série / artiste / plat isolés) : NE PAS en faire une question scolaire directe. Utiliser en clin d'œil ludique, en combinaison, ou laisser inutilisées.",
    `- Inventaire : ${sourceCount} sources (${high} HIGH, ${low} LOW).`,
    "",
    "Utilisation des sources :",
    "- Vous N'êtes PAS obligé d'utiliser toutes les sources. Une source autorisée peut rester inutilisée.",
    "- Une source HIGH riche peut exceptionnellement justifier DEUX questions SI elles testent deux infos distinctes déjà présentes dans la source, sans invention, et sans se ressembler.",
    "- Limite : au plus 2 questions par source HIGH ; 1 seule pour MEDIUM/LOW.",
    "- Plusieurs sourceRefs sur une même question sont encouragés quand deux petits faits fondent ensemble une bonne réponse (sans inventer de lien factuel nouveau).",
    "",
    "Mix indicatif (qualité d'abord, pas un quota rigide) si les sources le permettent :",
    "- 2–3 souvenirs / anecdotes",
    "- 1–2 habitudes / goûts mis en situation",
    "- 1 question combinant plusieurs petits détails",
    "",
    "Qualité d'énoncé :",
    "- La question ne doit pas contenir directement (ou quasi) la bonne réponse (ex. éviter « expérience japonaise » → Japon).",
    "- Les formulations peuvent être créatives ; le FAIT correct jamais inventé.",
    "- Distracteurs inventés OK pour le jeu, jamais présentés comme de vrais faits, jamais blessants, jamais sujets interdits.",
    "",
    "Règles techniques absolues :",
    "- Chaque question : ≥1 sourceRef (FACT|MEMORY|JOKE|PARTICIPANT) dont l'id existe dans les sources fournies.",
    "- correctIndex ∈ {0,1,2,3}, exactement 4 choix.",
    `- Nombre de questions : entre ${range.min} et ${range.max}.`,
    "- Répondez UNIQUEMENT via le schéma JSON imposé.",
    "",
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
    creatorIsParticipant: ctx.creatorIsParticipant,
    targetParticipantIds: ctx.targetParticipantIds,
    targetParticipantNames: ctx.targetParticipantNames,
    difficulty: ctx.difficulty,
    participants: ctx.participants,
    facts: ctx.facts.map((f) => ({
      id: f.id,
      text: f.text,
      subjectParticipantIds: f.subjectParticipantIds,
      quizValue: f.quizValue,
      ...(f.category ? { category: f.category } : {}),
    })),
    memories: ctx.memories.map((m) => ({
      id: m.id,
      text: m.text,
      ...(m.title ? { title: m.title } : {}),
      ...(m.place ? { place: m.place } : {}),
      participantIds: m.participantIds,
      quizValue: m.quizValue,
    })),
    jokes: ctx.jokes.map((j) => ({
      id: j.id,
      text: j.text,
      participantIds: j.participantIds,
      quizValue: j.quizValue,
    })),
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
    "Tentative de réparation : la génération précédente a échoué la validation (technique ou qualité éditoriale).",
    "Corrigez UNIQUEMENT ces problèmes et renvoyez un JSON complet valide.",
    "Remplacez les questions faibles (perspective, préférence trop directe, réponse révélée) par de meilleures formulations ludiques, sans inventer de faits.",
    ...validationErrors.map((e) => `- ${e}`),
  ].join("\n")
}
