import type { CSSProperties } from "react"
import { bookColor } from "@/lib/book-renderer/palette"
import type { BookStyleTokens } from "@/lib/book-renderer/styles"
import type { TrueFalseSample } from "@/lib/book-renderer/templates"
import type { Palette } from "@/lib/supabase/types"
import type { TrueFalseSuccess } from "@/lib/game-engines/true-false/types"
import { isTrueFalseAnswerHighlighted } from "@/lib/game-engines/true-false/solution"
import { RecolorableAsset } from "@/components/book-renderer/assets/recolorable-asset"
import type { RenderableAsset } from "@/components/book-renderer/templates/crossword-template"

/**
 * TRUE_FALSE_01 — structural true/false template.
 * Affirmations with VRAI / FAUX choices; correction highlights the answer gently.
 */
export function TrueFalseTemplate({
  sample,
  style,
  palette,
  assets,
  trueFalse,
  mode = "game",
}: {
  sample: TrueFalseSample
  style: BookStyleTokens
  palette: Palette
  assets: RenderableAsset[]
  trueFalse?: TrueFalseSuccess | null
  mode?: "game" | "solution"
}) {
  const statements = trueFalse?.statements ?? PLACEHOLDER

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

      <div className="relative flex-1 min-h-0">
        <ol className="flex flex-col" style={{ gap: 16 }}>
          {statements.map((s, i) => (
            <li key={i} className="flex flex-col" style={{ gap: 8 }}>
              <p className="font-sans" style={{ fontSize: 14, color: bookColor.dark, fontWeight: 600 }}>
                <span style={{ color: bookColor.accent, marginRight: 8 }}>{i + 1}.</span>
                {s.statement}
              </p>
              <div className="flex" style={{ gap: 10 }}>
                {([true, false] as const).map((choice) => {
                  const highlighted = isTrueFalseAnswerHighlighted(mode, choice, s.correctAnswer)
                  return (
                    <span
                      key={String(choice)}
                      className="font-sans"
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        letterSpacing: "0.06em",
                        padding: "8px 18px",
                        borderRadius: style.frameRadius,
                        border: `1.5px solid ${
                          highlighted
                            ? bookColor.accent
                            : "color-mix(in srgb, var(--book-dark) 22%, transparent)"
                        }`,
                        backgroundColor: highlighted
                          ? "color-mix(in srgb, var(--book-accent) 22%, var(--book-light))"
                          : bookColor.light,
                        color: bookColor.dark,
                      }}
                    >
                      {choice ? "VRAI" : "FAUX"}
                    </span>
                  )
                })}
              </div>
              {mode === "solution" && s.explanation && (
                <p className="font-sans" style={{ fontSize: 12, color: bookColor.dark, opacity: 0.75 }}>
                  {s.explanation}
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

const PLACEHOLDER: Array<{
  statement: string
  correctAnswer: boolean
  explanation?: string
}> = [
  { statement: "Affirmation d'exemple.", correctAnswer: true },
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
