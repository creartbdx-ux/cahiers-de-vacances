import type { CSSProperties } from "react"
import { bookColor } from "@/lib/book-renderer/palette"
import type { BookStyleTokens } from "@/lib/book-renderer/styles"
import type { CrosswordSample, CrosswordSampleClue } from "@/lib/book-renderer/templates"
import type { Asset, Palette } from "@/lib/supabase/types"
import type { CrosswordClue, CrosswordSuccess } from "@/lib/game-engines/crossword/types"
import { RecolorableAsset } from "@/components/book-renderer/assets/recolorable-asset"
import { CrosswordGrid } from "@/components/book-renderer/games/crossword-grid"

export interface RenderableAsset {
  asset: Asset
  svg: string | null
}

/**
 * CROSSWORD_01 — the first structural crossword template.
 *
 * Structure only: game label, editorial title, instruction, a clean central
 * grid placeholder (NOT a real crossword), the HORIZONTALEMENT / VERTICALEMENT
 * clue blocks and decorative asset zones. The graphic language comes from the
 * style tokens, all colors come from the palette vars, and the assets are
 * decorative recolorable SVGs.
 */
export function CrosswordTemplate({
  sample,
  style,
  palette,
  assets,
  crossword,
  mode = "game",
}: {
  sample: CrosswordSample
  style: BookStyleTokens
  palette: Palette
  assets: RenderableAsset[]
  /** Real generated grid. When absent, a decorative placeholder is shown. */
  crossword?: CrosswordSuccess | null
  mode?: "game" | "solution"
}) {
  // Clue blocks follow the engine when a grid exists, otherwise the local
  // sample content used purely to preview the structure.
  const horizontalClues: CrosswordSampleClue[] = crossword
    ? crossword.across.map(toSampleClue)
    : sample.horizontal
  const verticalClues: CrosswordSampleClue[] = crossword
    ? crossword.down.map(toSampleClue)
    : sample.vertical
  const frame: CSSProperties = {
    borderWidth: style.frameBorderWidth,
    borderStyle: "solid",
    borderColor: bookColor.dark,
    borderRadius: style.frameRadius,
  }

  return (
    <div className="flex h-full w-full flex-col" style={{ gap: 22 }}>
      {/* Header: game label + primary decorative asset medallion */}
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
            style={{ fontSize: 46, color: bookColor.primary, maxWidth: 460 }}
          >
            {sample.title}
          </h1>
        </div>

        {assets[0] && (
          <AssetMedallion asset={assets[0]} palette={palette} style={style} size={96} />
        )}
      </header>

      <p
        className={style.instructionClassName}
        style={{ fontSize: 15, color: bookColor.dark, maxWidth: 560, opacity: 0.85 }}
      >
        {sample.instruction}
      </p>

      {style.decorDensity === "high" && <RetroRule style={style} />}

      {/* Central grid placeholder */}
      <div className="relative flex-1" style={{ ...frame, backgroundColor: bookColor.light }}>
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ padding: 24 }}
        >
          {crossword ? (
            <CrosswordGrid cells={crossword.cells} mode={mode} />
          ) : (
            <GridPlaceholder />
          )}
        </div>

        {/* Corner decorative assets, no asset shown twice */}
        {assets[1] && (
          <AssetMedallion
            asset={assets[1]}
            palette={palette}
            style={style}
            size={72}
            className="absolute"
            positionStyle={{ bottom: -18, left: 28 }}
          />
        )}
        {assets[2] && (
          <AssetMedallion
            asset={assets[2]}
            palette={palette}
            style={style}
            size={72}
            className="absolute"
            positionStyle={{ top: -18, right: 28 }}
          />
        )}
      </div>

      {/* Clue blocks — driven by the engine's across/down when a grid exists. */}
      <div className="grid grid-cols-2" style={{ gap: 20 }}>
        <ClueBlock heading="Horizontalement" clues={horizontalClues} style={style} />
        <ClueBlock heading="Verticalement" clues={verticalClues} style={style} />
      </div>
    </div>
  )
}

/** The engine's clue shape mapped to the block's minimal display shape. */
function toSampleClue(clue: CrosswordClue): CrosswordSampleClue {
  return { number: clue.number, clue: clue.clue }
}

function ClueBlock({
  heading,
  clues,
  style,
}: {
  heading: string
  clues: CrosswordSampleClue[]
  style: BookStyleTokens
}) {
  return (
    <section
      style={{
        borderWidth: style.frameBorderWidth,
        borderStyle: "solid",
        borderColor: bookColor.secondary,
        borderRadius: style.frameRadius,
        padding: 18,
        backgroundColor: "color-mix(in srgb, var(--book-secondary) 10%, var(--book-light))",
      }}
    >
      <h2
        className={style.clueHeadingClassName}
        style={{
          fontSize: 15,
          color: bookColor.dark,
          marginBottom: 12,
          display: "inline-block",
          borderBottom: `3px solid ${bookColor.accent}`,
          paddingBottom: 4,
        }}
      >
        {heading}
      </h2>
      <ol className="flex flex-col" style={{ gap: 9 }}>
        {clues.map((clue) => (
          <li key={clue.number} className="flex items-baseline" style={{ gap: 10 }}>
            <span
              className={style.clueNumberClassName}
              style={{
                fontSize: 13,
                color: bookColor.light,
                backgroundColor: bookColor.accent,
                borderRadius: style.badgeRadius,
                minWidth: 22,
                height: 22,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              {clue.number}
            </span>
            <span className="font-sans" style={{ fontSize: 13, color: bookColor.dark, lineHeight: 1.5 }}>
              {clue.clue}
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}

/** Clean decorative grid — a placeholder, not a functional crossword. */
function GridPlaceholder() {
  const cols = 11
  const rows = 11
  // Deterministic scatter of "blocked" cells so the placeholder reads as a
  // crossword skeleton without implying a real puzzle.
  const blocked = new Set([0, 5, 10, 13, 24, 27, 33, 38, 49, 55, 60, 71, 82, 87, 96, 108, 110, 115, 117, 120])

  return (
    <div
      className="grid"
      style={{
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gridTemplateRows: `repeat(${rows}, 1fr)`,
        gap: 3,
        width: "100%",
        maxWidth: 420,
        aspectRatio: "1 / 1",
      }}
    >
      {Array.from({ length: cols * rows }).map((_, i) => {
        const isBlocked = blocked.has(i)
        return (
          <div
            key={i}
            style={{
              borderRadius: 3,
              backgroundColor: isBlocked ? bookColor.dark : bookColor.light,
              border: `1.5px solid color-mix(in srgb, var(--book-dark) 30%, transparent)`,
            }}
          />
        )
      })}
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

/** Small retro decorative rule: a row of dots that uses palette colors. */
function RetroRule({ style }: { style: BookStyleTokens }) {
  void style
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
