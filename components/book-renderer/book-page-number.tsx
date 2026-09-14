import { bookColor } from "@/lib/book-renderer/palette"

/** Discrete page number for mini-cahier pages (not on cover). */
export function BookPageNumber({ n }: { n: number }) {
  return (
    <div
      className="pointer-events-none absolute bottom-5 left-0 right-0 flex justify-center"
      aria-hidden
    >
      <span
        className="font-sans tabular-nums"
        style={{
          fontSize: 12,
          color: bookColor.dark,
          opacity: 0.45,
          letterSpacing: "0.08em",
        }}
      >
        {n}
      </span>
    </div>
  )
}
