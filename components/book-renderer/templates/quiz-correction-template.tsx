import { bookColor } from "@/lib/book-renderer/palette"
import type { BookStyleTokens } from "@/lib/book-renderer/styles"
import type { QuizSuccess } from "@/lib/game-engines/quiz/types"
import { buildQuizCorrectionItems } from "@/lib/mini-book/corrections"
import type { Palette } from "@/lib/supabase/types"

/**
 * Compact editorial quiz correction — answers list, not a full game replay.
 */
export function QuizCorrectionTemplate({
  title,
  universeName,
  style,
  quiz,
  palette: _palette,
}: {
  title: string
  universeName?: string | null
  style: BookStyleTokens
  quiz: QuizSuccess
  palette: Palette
}) {
  void _palette
  const heading = universeName
    ? `Quiz ${universeName} — Réponses`
    : `${title} — Réponses`
  const items = buildQuizCorrectionItems(quiz)

  return (
    <div className="flex h-full w-full flex-col" style={{ gap: 16 }}>
      <header className="flex flex-col gap-2">
        <span
          className={style.gameLabelClassName}
          style={{
            alignSelf: "flex-start",
            fontSize: 11,
            padding: "5px 14px",
            color: bookColor.light,
            backgroundColor: "var(--book-page-band, var(--book-primary))",
            borderRadius: style.badgeRadius,
          }}
        >
          Réponses & corrections
        </span>
        <h1
          className={style.titleClassName}
          style={{ fontSize: 32, color: bookColor.primary, lineHeight: 1.05, maxWidth: 520 }}
        >
          {heading}
        </h1>
      </header>

      <ol className="flex flex-col" style={{ gap: 14 }}>
        {items.map((item, i) => (
          <li
            key={item.index}
            style={{
              paddingBottom: 12,
              borderBottom:
                i < items.length - 1
                  ? "1px solid color-mix(in srgb, var(--book-dark) 12%, transparent)"
                  : undefined,
            }}
          >
            <p className="font-sans" style={{ fontSize: 14, fontWeight: 600, color: bookColor.dark }}>
              <span style={{ color: bookColor.accent, marginRight: 8 }}>{i + 1}.</span>
              {item.question}
            </p>
            <p className="font-sans" style={{ fontSize: 13, color: bookColor.dark, marginTop: 6 }}>
              <span style={{ fontWeight: 700, color: bookColor.primary }}>Réponse :</span>{" "}
              {item.answerLabel} — {item.answerText}
            </p>
            {item.explanation ? (
              <p
                className="font-sans"
                style={{ fontSize: 12, color: bookColor.dark, opacity: 0.78, marginTop: 4, lineHeight: 1.4 }}
              >
                <span style={{ fontWeight: 600 }}>Explication :</span> {item.explanation}
              </p>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  )
}
