import { editorialPromptBlock, type TrueFalseThemeContext } from "./context"
import {
  TRUE_FALSE_THEME_STATEMENT_STYLES,
  TRUE_FALSE_THEME_STYLE_GUIDANCE,
} from "./styles"
import type { GeneratedTrueFalseThemeStatement } from "./types"

function difficultyGuidance(level: number): string {
  switch (level) {
    case 1:
      return "très accessible — distinction assez claire, jamais infantilisante"
    case 2:
      return "accessible — culture générale courante"
    case 3:
      return "intermédiaire — affirmation plausible, vraie connaissance nécessaire, faux énoncé crédible, pas de piège linguistique"
    case 4:
      return "difficile — détails plus précis, faits stables, jamais d'ambiguïté pour « augmenter » la difficulté"
    case 5:
      return "amateur averti — précision élevée, faits durables uniquement"
    default:
      return "intermédiaire"
  }
}

function statementStylePromptBlock(target: number): string {
  const lines = TRUE_FALSE_THEME_STATEMENT_STYLES.map(
    (s) => `- ${s} : ${TRUE_FALSE_THEME_STYLE_GUIDANCE[s]}`,
  )
  return [
    "Diversité de FORME (statementStyle) — obligatoire :",
    "Ne créez pas huit affirmations construites de la même façon.",
    `Pour ${target} affirmations : au plus 3 du même statementStyle, au moins 4 styles distincts, et évitez deux fois le même style d'affilée.`,
    "Chaque affirmation DOIT déclarer un statementStyle parmi :",
    ...lines,
  ].join("\n")
}

function topicKeyPromptBlock(ctx: TrueFalseThemeContext): string {
  if (ctx.allowedTopics.length) {
    return [
      "Classification thématique (topicKey / topicLabel) :",
      "- topicKey DOIT être exactement l'une des valeurs allowedTopics (enum).",
      `- Valeurs autorisées : ${ctx.allowedTopics.join(" | ")}.`,
      "- topicLabel est un sous-thème libre et précis pour le debug.",
      "- Ne jamais inventer un topicKey hors liste.",
    ].join("\n")
  }
  return [
    "Classification thématique (topicKey / topicLabel) :",
    "- topicKey : catégorie éditoriale courte de l'univers.",
    "- topicLabel : sous-thème libre plus précis.",
  ].join("\n")
}

export function buildTrueFalseThemeSystemPrompt(ctx: TrueFalseThemeContext): string {
  const half = Math.floor(ctx.targetStatements / 2)
  return [
    "Vous créez une page VRAI OU FAUX de CULTURE GÉNÉRALE THÉMATIQUE pour un cahier de vacances imprimé.",
    "Ce n'est PAS un jeu sur une personne. Aucune donnée personnelle n'est fournie et vous ne devez en inventer aucune.",
    "",
    `Univers / thème : ${ctx.universeName} (id: ${ctx.universeId || "n/a"}).`,
    `Difficulté : ${ctx.difficulty}/4 — ${difficultyGuidance(ctx.difficulty)}.`,
    `Nombre d'affirmations : exactement ${ctx.targetStatements}.`,
    `Équilibre : viser ${half} VRAIES (answer=true) et ${half} FAUSSES (answer=false).`,
    "",
    editorialPromptBlock(ctx),
    "",
    "Comment écrire une affirmation FAUSSE (essentiel) :",
    "- Modifiez UN élément précis d'un fait réel pour obtenir un énoncé faux mais plausible.",
    "- Exemple : inverser une comparaison (« A est plus concentré que B » → « B est plus concentré que A »).",
    "- Interdit : absurde, caricature, négation artificielle creuse, détail ridicule.",
    "- L'explanation d'une affirmation fausse DOIT rétablir clairement le fait correct.",
    "",
    "Formulation :",
    "- Affirmations simples, une idée claire.",
    "- Éviter double négation, « toujours », « jamais », « tous », « aucun » sauf si le fait est réellement absolu et stable.",
    "- Pas de « Il n'est pas faux que… ». Le défi vient du contenu, pas de la grammaire.",
    "",
    topicKeyPromptBlock(ctx),
    "",
    statementStylePromptBlock(ctx.targetStatements),
    "",
    "Diversité de SUJETS (topicKey) :",
    ctx.allowedTopics.length >= 4
      ? `- Au moins 3 topicKeys distincts ; pas plus de 4 affirmations sur le même topicKey.`
      : `- Variez les topicKey à l'intérieur du cadre.`,
    "",
    "Stabilité factuelle :",
    "- Uniquement des connaissances raisonnablement stables et largement établies.",
    "- Éviter actualité, classements, tendances du moment, prix, stats récentes, records évolutifs, politiques actuelles.",
    "- Si vous n'êtes pas suffisamment certain d'un fait, ne l'utilisez pas.",
    "",
    "Chaque affirmation doit avoir :",
    "- statement non vide",
    "- answer boolean (true|false)",
    "- explanation utile (pourquoi vrai, ou correction précise si faux)",
    "- statementStyle (enum)",
    "- topicKey + topicLabel",
    "",
    "Générez aussi un title court et élégant, cohérent avec l'univers (ex. style « Vrai ou faux : … », sans hardcoder).",
    "Répondez UNIQUEMENT via le schéma JSON imposé.",
  ].join("\n")
}

export function buildTrueFalseThemeTargetedRepairPrompt(input: {
  baseSystem: string
  kept: Array<{ index1: number; statement: GeneratedTrueFalseThemeStatement }>
  invalid: Array<{ index1: number; errors: string[] }>
  usedStyles: string[]
  usedTopicKeys: string[]
  keptTrue: number
  keptFalse: number
}): string {
  const keptBlock = input.kept.map((k) => {
    const s = k.statement
    return [
      `A${k.index1} (À CONSERVER) :`,
      `  statementStyle=${s.statementStyle} answer=${s.answer}`,
      `  topicKey=${s.topicKey}`,
      `  statement=${s.statement}`,
    ].join("\n")
  })

  const invalidBlock = input.invalid.map((inv) =>
    [`A${inv.index1} À REMPLACER — erreurs :`, ...inv.errors.map((e) => `  - ${e}`)].join("\n"),
  )

  return [
    input.baseSystem,
    "",
    "RÉPARATION CIBLÉE :",
    "Conservez inchangées les affirmations listées comme « À CONSERVER ».",
    "Remplacez UNIQUEMENT les index demandés.",
    `Styles déjà utilisés (conservés) : ${input.usedStyles.join(", ") || "—"}.`,
    `TopicKeys déjà utilisés (conservés) : ${input.usedTopicKeys.join(", ") || "—"}.`,
    `Équilibre conservé : ${input.keptTrue} VRAI / ${input.keptFalse} FAUX — complétez pour viser un équilibre global.`,
    "",
    ...keptBlock,
    "",
    ...invalidBlock,
    "",
    "Retournez uniquement les replacements pour les index invalides (index 1-based).",
  ].join("\n")
}

export function buildTrueFalseThemeRepairSystemPrompt(
  baseSystem: string,
  errors: string[],
): string {
  return [
    baseSystem,
    "",
    "La génération précédente a échoué la validation. Corrigez TOUT le jeu.",
    "Erreurs :",
    ...errors.map((e) => `- ${e}`),
  ].join("\n")
}
