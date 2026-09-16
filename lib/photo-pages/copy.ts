/**
 * Light editorialization of photo caption / anecdote.
 * 1–2 lines max — photo remains the subject.
 */

export function editorializePhotoCopy(input: {
  caption: string | null
  anecdote: string | null
  place: string | null
}): {
  kicker: string | null
  caption: string | null
  anecdote: string | null
} {
  const rawCaption = input.caption?.trim() || null
  const rawAnecdote = input.anecdote?.trim() || null
  const place = input.place?.trim() || null

  let kicker: string | null = place ? place.toUpperCase() : null
  if (!kicker && rawCaption) {
    // Prefer a short place-like head from caption
    const head = rawCaption.split(/[.,!—–]/)[0]?.trim()
    if (head && head.length <= 28) kicker = head.toUpperCase()
  }

  let caption: string | null = null
  if (rawAnecdote && rawAnecdote.length <= 90) {
    caption = clipOneLine(rawAnecdote)
  } else if (rawCaption) {
    caption = clipOneLine(shortenCaption(rawCaption))
  }

  let anecdote: string | null = null
  if (rawAnecdote && caption !== clipOneLine(rawAnecdote) && rawCaption) {
    // Keep a second short line only if distinct and brief
    const second = clipOneLine(shortenCaption(rawCaption))
    if (second && second !== caption && second.length <= 70) {
      anecdote = second
    }
  }

  return { kicker, caption, anecdote }
}

function shortenCaption(s: string): string {
  let t = s.trim()
  // Drop leading "Sami et moi" / "Nous" style for shorter album captions
  t = t.replace(/^(Sami et moi|Emma et moi|Nous|On)\s+/i, "")
  t = t.replace(/\s+pendant notre voyage[^.]*\.?/i, ".")
  return t.replace(/\s+/g, " ").trim()
}

function clipOneLine(s: string): string {
  const t = s.replace(/\s+/g, " ").trim()
  if (t.length <= 90) return t
  const cut = t.slice(0, 87)
  const sp = cut.lastIndexOf(" ")
  return `${(sp > 40 ? cut.slice(0, sp) : cut).trim()}…`
}
