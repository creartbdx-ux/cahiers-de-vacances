import { bookColor } from "@/lib/book-renderer/palette"
import type { BookStyleTokens } from "@/lib/book-renderer/styles"
import type { CrosswordSuccess } from "@/lib/game-engines/crossword/types"
import type { WordSearchSuccess } from "@/lib/game-engines/wordsearch/types"
import {
  buildCrosswordCorrectionAnswers,
  buildWordsearchCorrectionWords,
} from "@/lib/mini-book/corrections"
import type { Palette } from "@/lib/supabase/types"
import { CrosswordGrid } from "@/components/book-renderer/games/crossword-grid"
import { WordsearchGrid } from "@/components/book-renderer/games/wordsearch-grid"

/**
 * Compact combined letters correction page — wordsearch + crossword answers.
 * Reuses generated game content only (no IA).
 */
export function LettersCorrectionTemplate({
  style,
  palette: _palette,
  wordsearchTitle,
  wordsearch,
  crosswordTitle,
  crossword,
}: {
  style: BookStyleTokens
  palette: Palette
  wordsearchTitle: string
  wordsearch: WordSearchSuccess | null
  crosswordTitle: string
  crossword: CrosswordSuccess | null
}) {
  void _palette
  const wsWords = wordsearch ? buildWordsearchCorrectionWords(wordsearch) : []
  const cwAnswers = crossword ? buildCrosswordCorrectionAnswers(crossword) : null

  return (
    <div className="flex h-full w-full flex-col" style={{ gap: 18 }}>
      <header className="flex flex-col gap-2">
        <span
          className={style.gameLabelClassName}
          style={{
            alignSelf: "flex-start",
            fontSize: 11,
            padding: "5px 14px",
            color: bookColor.light,
            backgroundColor: "var(--book-page-band, var(--book-secondary))",
            borderRadius: style.badgeRadius,
          }}
        >
          Les solutions
        </span>
        <h1
          className={style.titleClassName}
          style={{ fontSize: 28, color: bookColor.primary, lineHeight: 1.05 }}
        >
          Réponses lettres
        </h1>
      </header>

      <section
        className="flex min-h-0 flex-col"
        style={{
          gap: 10,
          padding: 12,
          borderRadius: style.frameRadius,
          border: `${style.frameBorderWidth}px solid color-mix(in srgb, var(--book-secondary) 45%, transparent)`,
          backgroundColor:
            "var(--book-page-panel, color-mix(in srgb, var(--book-secondary) 8%, var(--book-light)))",
          flex: "0 0 auto",
        }}
      >
        <h2 className={style.clueHeadingClassName} style={{ fontSize: 15, color: bookColor.dark }}>
          {wordsearchTitle || "Mots mêlés"} — réponses
        </h2>
        {wordsearch ? (
          <div className="flex gap-4" style={{ alignItems: "flex-start" }}>
            <div style={{ width: 200, height: 200, flexShrink: 0 }}>
              <WordsearchGrid
                grid={wordsearch.grid}
                placements={wordsearch.placements}
                mode="solution"
              />
            </div>
            <ul
              className="grid flex-1 font-sans"
              style={{
                gridTemplateColumns: "1fr 1fr",
                gap: "4px 12px",
                fontSize: 12,
                color: bookColor.dark,
                alignContent: "start",
              }}
            >
              {wsWords.map((word) => (
                <li key={word}>{word}</li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="font-sans text-sm" style={{ color: bookColor.dark, opacity: 0.7 }}>
            Mots mêlés indisponibles.
          </p>
        )}
      </section>

      <section
        className="flex min-h-0 flex-1 flex-col"
        style={{
          gap: 10,
          padding: 12,
          borderRadius: style.frameRadius,
          border: `${style.frameBorderWidth}px solid color-mix(in srgb, var(--book-primary) 35%, transparent)`,
          backgroundColor: "color-mix(in srgb, var(--book-primary) 5%, var(--book-light))",
          minHeight: 0,
        }}
      >
        <h2 className={style.clueHeadingClassName} style={{ fontSize: 15, color: bookColor.dark }}>
          {crosswordTitle || "Mots croisés"} — réponses
        </h2>
        {crossword && cwAnswers ? (
          <div className="flex min-h-0 flex-1 gap-4">
            <div className="flex min-w-0 flex-1 flex-col" style={{ gap: 10 }}>
              <AnswerList heading="Horizontalement" clues={cwAnswers.across} style={style} />
              <AnswerList heading="Verticalement" clues={cwAnswers.down} style={style} />
            </div>
            {crossword.stats.width * crossword.stats.height <= 140 ? (
              <div style={{ width: 160, height: 160, flexShrink: 0 }}>
                <CrosswordGrid cells={crossword.cells} mode="solution" />
              </div>
            ) : null}
          </div>
        ) : (
          <p className="font-sans text-sm" style={{ color: bookColor.dark, opacity: 0.7 }}>
            Mots croisés indisponibles.
          </p>
        )}
      </section>
    </div>
  )
}

function AnswerList({
  heading,
  clues,
  style,
}: {
  heading: string
  clues: Array<{ number: number; answer: string }>
  style: BookStyleTokens
}) {
  return (
    <div>
      <h3
        className={style.clueHeadingClassName}
        style={{
          fontSize: 12,
          color: bookColor.dark,
          marginBottom: 6,
          borderBottom: `2px solid ${bookColor.accent}`,
          display: "inline-block",
          paddingBottom: 2,
        }}
      >
        {heading}
      </h3>
      <ul className="font-sans" style={{ fontSize: 12, color: bookColor.dark, lineHeight: 1.45 }}>
        {clues.map((c) => (
          <li key={`${heading}-${c.number}`}>
            <span style={{ fontWeight: 700, color: bookColor.primary }}>{c.number}.</span>{" "}
            {c.answer}
          </li>
        ))}
      </ul>
    </div>
  )
}
