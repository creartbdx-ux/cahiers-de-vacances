import type { CSSProperties } from "react"
import { bookColor } from "@/lib/book-renderer/palette"
import type { BookStyleTokens } from "@/lib/book-renderer/styles"
import type { QuizSample } from "@/lib/book-renderer/templates"
import type { Palette } from "@/lib/supabase/types"
import { QUIZ_CHOICE_LABELS, type QuizSuccess } from "@/lib/game-engines/quiz/types"
import { isCorrectChoiceHighlighted } from "@/lib/game-engines/quiz/solution"
import { RecolorableAsset } from "@/components/book-renderer/assets/recolorable-asset"
import type { RenderableAsset } from "@/components/book-renderer/templates/crossword-template"

/**
 * QUIZ_01 — structural quiz template.
 * Game label, title, instruction, numbered questions with A–D choices,
 * decorative asset zones. Correction only highlights the correct choice.
 */
export function QuizTemplate({
  sample,
  style,
  palette,
  assets,
  quiz,
  mode = "game",
}: {
  sample: QuizSample
  style: BookStyleTokens
  palette: Palette
  assets: RenderableAsset[]
  quiz?: QuizSuccess | null
  mode?: "game" | "solution"
}) {
  const questions = quiz?.questions ?? PLACEHOLDER_QUESTIONS

  return (
    <div className="flex h-full w-full flex-col" style={{ gap: 16 }}>
      <header className="flex items-start justify-between gap-6">
        <div className="flex flex-col gap-3">
          <span
            className={style.gameLabelClassName}
            style={{
              alignSelf: "flex-start",
              fontSize: 12,
              padding: "6px 16px",
              color: bookColor.light,
              backgroundColor: bookColor.primary,
              borderRadius: style.badgeRadius,
            }}
          >
            {sample.gameLabel}
          </span>
          <h1
            className={style.titleClassName}
            style={{ fontSize: 40, color: bookColor.primary, maxWidth: 480 }}
          >
            {sample.title}
          </h1>
        </div>
        {assets[0] && <AssetMedallion asset={assets[0]} palette={palette} style={style} size={88} />}
      </header>

      <p
        className={style.instructionClassName}
        style={{ fontSize: 14, color: bookColor.dark, maxWidth: 560, opacity: 0.85 }}
      >
        {sample.instruction}
      </p>

      <div className="relative flex-1 min-h-0 overflow-hidden">
        <ol className="flex flex-col" style={{ gap: 14 }}>
          {questions.map((q, qi) => (
            <li key={qi} className="flex flex-col" style={{ gap: 8 }}>
              <p className="font-sans" style={{ fontSize: 14, color: bookColor.dark, fontWeight: 600 }}>
                <span style={{ color: bookColor.accent, marginRight: 8 }}>{qi + 1}.</span>
                {q.question}
              </p>
              <ul className="grid grid-cols-2" style={{ gap: 6 }}>
                {q.choices.map((choice, ci) => {
                  const highlighted = isCorrectChoiceHighlighted(mode, ci, q.correctIndex)
                  return (
                    <li
                      key={ci}
                      className="flex items-start font-sans"
                      style={{
                        gap: 8,
                        fontSize: 13,
                        color: bookColor.dark,
                        padding: "6px 8px",
                        borderRadius: style.frameRadius,
                        border: `1.5px solid ${
                          highlighted
                            ? bookColor.accent
                            : "color-mix(in srgb, var(--book-dark) 22%, transparent)"
                        }`,
                        backgroundColor: highlighted
                          ? "color-mix(in srgb, var(--book-accent) 22%, var(--book-light))"
                          : bookColor.light,
                      }}
                    >
                      <span
                        style={{
                          fontWeight: 700,
                          color: highlighted ? bookColor.accent : bookColor.primary,
                          minWidth: 16,
                        }}
                      >
                        {QUIZ_CHOICE_LABELS[ci]}
                      </span>
                      <span>{choice}</span>
                    </li>
                  )
                })}
              </ul>
              {mode === "solution" && q.explanation && (
                <p
                  className="font-sans"
                  style={{ fontSize: 12, color: bookColor.dark, opacity: 0.75, paddingLeft: 4 }}
                >
                  {q.explanation}
                </p>
              )}
            </li>
          ))}
        </ol>

        {assets[1] && (
          <AssetMedallion
            asset={assets[1]}
            palette={palette}
            style={style}
            size={56}
            className="absolute"
            positionStyle={{ bottom: 0, right: 8 }}
          />
        )}
      </div>
    </div>
  )
}

const PLACEHOLDER_QUESTIONS: Array<{
  question: string
  choices: [string, string, string, string]
  correctIndex: 0 | 1 | 2 | 3
  explanation?: string
}> = [
  {
    question: "Question d'exemple ?",
    choices: ["Réponse A", "Réponse B", "Réponse C", "Réponse D"],
    correctIndex: 0,
  },
]

function AssetMedallion({
  asset,
  palette,
  style,
  size,
  className,
  positionStyle,
}: {
  asset: RenderableAsset
  palette: Palette
  style: BookStyleTokens
  size: number
  className?: string
  positionStyle?: CSSProperties
}) {
  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        padding: size * 0.16,
        borderRadius: style.badgeRadius === 999 ? 999 : style.frameRadius,
        backgroundColor: "color-mix(in srgb, var(--book-accent) 22%, var(--book-light))",
        border: `${style.frameBorderWidth}px solid ${bookColor.accent}`,
        ...positionStyle,
      }}
    >
      <RecolorableAsset master={asset.svg} palette={palette} recolorable={asset.asset.recolorable} />
    </div>
  )
}
