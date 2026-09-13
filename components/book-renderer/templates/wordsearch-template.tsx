import type { CSSProperties } from "react"
import { bookColor } from "@/lib/book-renderer/palette"
import type { BookStyleTokens } from "@/lib/book-renderer/styles"
import type { WordsearchSample } from "@/lib/book-renderer/templates"
import type { Palette } from "@/lib/supabase/types"
import type { WordSearchSuccess } from "@/lib/game-engines/wordsearch/types"
import { RecolorableAsset } from "@/components/book-renderer/assets/recolorable-asset"
import type { RenderableAsset } from "@/components/book-renderer/templates/crossword-template"
import { WordsearchGrid } from "@/components/book-renderer/games/wordsearch-grid"

/**
 * WORDSEARCH_01 — structural word-search template.
 *
 * Game label, title, instruction, square letter grid, original-form word list,
 * decorative asset zones. Colors come from the palette; grid logic is independent
 * of the graphic style.
 */
export function WordsearchTemplate({
  sample,
  style,
  palette,
  assets,
  wordsearch,
  mode = "game",
}: {
  sample: WordsearchSample
  style: BookStyleTokens
  palette: Palette
  assets: RenderableAsset[]
  wordsearch?: WordSearchSuccess | null
  mode?: "game" | "solution"
}) {
  const words = wordsearch ? wordsearch.placements.map((p) => p.originalWord) : sample.words
  const frame: CSSProperties = {
    borderWidth: style.frameBorderWidth,
    borderStyle: "solid",
    borderColor: bookColor.dark,
    borderRadius: style.frameRadius,
  }

  return (
    <div className="flex h-full w-full flex-col" style={{ gap: 18 }}>
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
            style={{ fontSize: 42, color: bookColor.primary, maxWidth: 480 }}
          >
            {sample.title}
          </h1>
        </div>

        {assets[0] && <AssetMedallion asset={assets[0]} palette={palette} style={style} size={96} />}
      </header>

      <p
        className={style.instructionClassName}
        style={{ fontSize: 15, color: bookColor.dark, maxWidth: 560, opacity: 0.85 }}
      >
        {sample.instruction}
      </p>

      {style.decorDensity === "high" && <RetroRule />}

      <div className="relative flex-1" style={{ ...frame, backgroundColor: bookColor.light, minHeight: 0 }}>
        <div className="absolute inset-0 flex items-center justify-center" style={{ padding: 20 }}>
          {wordsearch ? (
            <WordsearchGrid grid={wordsearch.grid} placements={wordsearch.placements} mode={mode} />
          ) : (
            <GridPlaceholder />
          )}
        </div>

        {assets[1] && (
          <AssetMedallion
            asset={assets[1]}
            palette={palette}
            style={style}
            size={68}
            className="absolute"
            positionStyle={{ bottom: -16, left: 24 }}
          />
        )}
        {assets[2] && (
          <AssetMedallion
            asset={assets[2]}
            palette={palette}
            style={style}
            size={68}
            className="absolute"
            positionStyle={{ top: -16, right: 24 }}
          />
        )}
      </div>

      <section
        style={{
          borderWidth: style.frameBorderWidth,
          borderStyle: "solid",
          borderColor: bookColor.secondary,
          borderRadius: style.frameRadius,
          padding: 16,
          backgroundColor: "color-mix(in srgb, var(--book-secondary) 10%, var(--book-light))",
        }}
      >
        <h2
          className={style.clueHeadingClassName}
          style={{
            fontSize: 14,
            color: bookColor.dark,
            marginBottom: 10,
            display: "inline-block",
            borderBottom: `3px solid ${bookColor.accent}`,
            paddingBottom: 4,
          }}
        >
          Mots à trouver
        </h2>
        <ul className="flex flex-wrap" style={{ gap: "6px 18px" }}>
          {words.map((word, i) => (
            <li
              key={`${word}-${i}`}
              className="font-sans"
              style={{ fontSize: 13, color: bookColor.dark, letterSpacing: "0.04em" }}
            >
              {word}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function GridPlaceholder() {
  const cols = 10
  const rows = 10
  const letters = "CAHIERSDEVACANCESMOTSMELES"
  return (
    <div
      className="grid"
      style={{
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gridTemplateRows: `repeat(${rows}, 1fr)`,
        gap: 2,
        width: "100%",
        maxWidth: 400,
        aspectRatio: "1 / 1",
      }}
    >
      {Array.from({ length: cols * rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center justify-center font-sans font-bold"
          style={{
            aspectRatio: "1 / 1",
            borderRadius: 2,
            backgroundColor: bookColor.light,
            border: `1.5px solid color-mix(in srgb, var(--book-dark) 30%, transparent)`,
            fontSize: 11,
            color: bookColor.dark,
          }}
        >
          {letters[i % letters.length]}
        </div>
      ))}
    </div>
  )
}

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

function RetroRule() {
  const dots = [bookColor.primary, bookColor.accent, bookColor.secondary, bookColor.accent, bookColor.primary]
  return (
    <div className="flex items-center" style={{ gap: 8 }} aria-hidden="true">
      {dots.map((c, i) => (
        <span key={i} style={{ width: 10, height: 10, borderRadius: 999, backgroundColor: c }} />
      ))}
      <span
        style={{
          flex: 1,
          height: 3,
          borderRadius: 999,
          backgroundColor: "color-mix(in srgb, var(--book-dark) 25%, transparent)",
        }}
      />
    </div>
  )
}
