import { bookColor } from "@/lib/book-renderer/palette"
import type { BookStyleTokens } from "@/lib/book-renderer/styles"
import type { Palette } from "@/lib/supabase/types"

/**
 * Corrections divider — separation between game pages and solution pages.
 */
export function CorrectionsDividerTemplate({
  title = "CORRECTIONS",
  body = "Les réponses sont juste après.\nPromis, on ne dira rien.",
  style,
  palette: _palette,
}: {
  title?: string
  body?: string
  style: BookStyleTokens
  palette: Palette
}) {
  void _palette

  return (
    <div className="flex h-full w-full flex-col items-center justify-center text-center" style={{ gap: 28 }}>
      <h1
        className={style.titleClassName}
        style={{ fontSize: 48, color: bookColor.primary, maxWidth: 440 }}
      >
        {title}
      </h1>
      <p
        className={style.instructionClassName}
        style={{
          fontSize: 18,
          color: bookColor.dark,
          opacity: 0.85,
          maxWidth: 360,
          whiteSpace: "pre-line",
        }}
      >
        {body}
      </p>
      <div
        aria-hidden
        style={{
          width: 80,
          height: 4,
          borderRadius: 999,
          backgroundColor: bookColor.accent,
          marginTop: 12,
        }}
      />
    </div>
  )
}
