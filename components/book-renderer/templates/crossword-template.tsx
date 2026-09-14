import type { CSSProperties } from "react"
import { bookColor } from "@/lib/book-renderer/palette"
import type { BookStyleTokens } from "@/lib/book-renderer/styles"
import type { CrosswordSample, CrosswordSampleClue } from "@/lib/book-renderer/templates"
import type { Asset, Palette } from "@/lib/supabase/types"
import type { CrosswordClue, CrosswordSuccess } from "@/lib/game-engines/crossword/types"
import { resolveCrosswordPageLayout } from "@/lib/book-renderer/crossword-layout"
import { RecolorableAsset } from "@/components/book-renderer/assets/recolorable-asset"
import { CrosswordGrid } from "@/components/book-renderer/games/crossword-grid"

export interface RenderableAsset {
  asset: Asset
  svg: string | null
}

/**
 * CROSSWORD_01 — print-first crossword page.
 * Grid is the visual priority; definitions stay compact and adaptive.
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
  crossword?: CrosswordSuccess | null
  mode?: "game" | "solution"
}) {
  const horizontalClues: CrosswordSampleClue[] = crossword
    ? crossword.across.map(toSampleClue)
    : sample.horizontal
  const verticalClues: CrosswordSampleClue[] = crossword
    ? crossword.down.map(toSampleClue)
    : sample.vertical

  const width = crossword?.stats.width ?? 11
  const height = crossword?.stats.height ?? 11
  const layout = resolveCrosswordPageLayout({
    acrossCount: horizontalClues.length,
    downCount: verticalClues.length,
    width,
    height,
  })

  const frame: CSSProperties = {
    borderWidth: style.frameBorderWidth,
    borderStyle: "solid",
    borderColor: bookColor.dark,
    borderRadius: style.frameRadius,
  }

  const gridBlock = (
    <div
      className="relative flex min-h-0 items-center justify-center"
      style={{
        ...frame,
        backgroundColor: bookColor.light,
        padding: layout === "side-by-side" ? 16 : 18,
        flex: layout === "side-by-side" ? "1 1 58%" : "1 1 auto",
        minHeight: layout === "grid-top" ? 320 : 280,
        maxHeight: layout === "grid-top" ? "58%" : undefined,
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          maxWidth: layout === "side-by-side" ? 420 : 480,
          aspectRatio: `${width} / ${height}`,
        }}
      >
        {crossword ? (
          <CrosswordGrid cells={crossword.cells} mode={mode} />
        ) : (
          <GridPlaceholder />
        )}
      </div>
      {assets[1] && layout === "grid-top" && (
        <AssetMedallion
          asset={assets[1]}
          palette={palette}
          style={style}
          size={56}
          className="absolute"
          positionStyle={{ bottom: -12, left: 16 }}
        />
      )}
    </div>
  )

  const cluesBlock = (
    <div
      className={layout === "side-by-side" ? "flex min-h-0 flex-col" : "grid grid-cols-2"}
      style={{
        gap: layout === "side-by-side" ? 10 : 12,
        flex: layout === "side-by-side" ? "1 1 42%" : undefined,
        minWidth: layout === "side-by-side" ? 0 : undefined,
      }}
    >
      <ClueBlock
        heading="Horizontalement"
        clues={horizontalClues}
        style={style}
        compact
        stacked={layout === "side-by-side"}
      />
      <ClueBlock
        heading="Verticalement"
        clues={verticalClues}
        style={style}
        compact
        stacked={layout === "side-by-side"}
      />
    </div>
  )

  return (
    <div className="flex h-full w-full flex-col" style={{ gap: 12 }}>
      <header className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <span
            className={style.gameLabelClassName}
            style={{
              alignSelf: "flex-start",
              fontSize: 11,
              padding: "5px 14px",
              color: bookColor.light,
              backgroundColor: bookColor.primary,
              borderRadius: style.badgeRadius,
            }}
          >
            {sample.gameLabel}
          </span>
          <h1
            className={style.titleClassName}
            style={{ fontSize: 34, color: bookColor.primary, maxWidth: 480, lineHeight: 1 }}
          >
            {sample.title}
          </h1>
        </div>
        {assets[0] && <AssetMedallion asset={assets[0]} palette={palette} style={style} size={72} />}
      </header>

      <p
        className={style.instructionClassName}
        style={{ fontSize: 13, color: bookColor.dark, maxWidth: 560, opacity: 0.8 }}
      >
        {sample.instruction}
      </p>

      {layout === "side-by-side" ? (
        <div className="flex min-h-0 flex-1 gap-4" style={{ alignItems: "stretch" }}>
          {gridBlock}
          {cluesBlock}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col" style={{ gap: 12 }}>
          {gridBlock}
          {cluesBlock}
        </div>
      )}
    </div>
  )
}

function toSampleClue(clue: CrosswordClue): CrosswordSampleClue {
  return { number: clue.number, clue: clue.clue }
}

function ClueBlock({
  heading,
  clues,
  style,
  compact = false,
  stacked = false,
}: {
  heading: string
  clues: CrosswordSampleClue[]
  style: BookStyleTokens
  compact?: boolean
  stacked?: boolean
}) {
  return (
    <section
      style={{
        borderWidth: style.frameBorderWidth,
        borderStyle: "solid",
        borderColor: bookColor.secondary,
        borderRadius: style.frameRadius,
        padding: compact ? 12 : 18,
        backgroundColor: "var(--book-page-panel, color-mix(in srgb, var(--book-secondary) 10%, var(--book-light)))",
        flex: stacked ? "1 1 auto" : undefined,
        minHeight: 0,
        overflow: "hidden",
      }}
    >
      <h2
        className={style.clueHeadingClassName}
        style={{
          fontSize: compact ? 13 : 15,
          color: bookColor.dark,
          marginBottom: compact ? 8 : 12,
          display: "inline-block",
          borderBottom: `2px solid ${bookColor.accent}`,
          paddingBottom: 2,
        }}
      >
        {heading}
      </h2>
      <ol className="flex flex-col" style={{ gap: compact ? 5 : 9 }}>
        {clues.map((clue) => (
          <li key={clue.number} className="flex items-baseline" style={{ gap: 8 }}>
            <span
              className={style.clueNumberClassName}
              style={{
                fontSize: 11,
                color: bookColor.light,
                backgroundColor: bookColor.accent,
                borderRadius: style.badgeRadius,
                minWidth: compact ? 18 : 22,
                height: compact ? 18 : 22,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              {clue.number}
            </span>
            <span
              className="font-sans"
              style={{ fontSize: compact ? 12 : 13, color: bookColor.dark, lineHeight: 1.35 }}
            >
              {clue.clue}
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}

function GridPlaceholder() {
  const cols = 11
  const rows = 11
  const blocked = new Set([0, 5, 10, 13, 24, 27, 33, 38, 49, 55, 60, 71, 82, 87, 96, 108, 110, 115, 117, 120])

  return (
    <div
      className="grid h-full w-full"
      style={{
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gridTemplateRows: `repeat(${rows}, 1fr)`,
        gap: 2,
        aspectRatio: "1 / 1",
      }}
    >
      {Array.from({ length: cols * rows }).map((_, i) => {
        const isBlocked = blocked.has(i)
        return (
          <div
            key={i}
            style={{
              borderRadius: 2,
              backgroundColor: isBlocked ? bookColor.dark : bookColor.light,
              border: `1px solid color-mix(in srgb, var(--book-dark) 30%, transparent)`,
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
