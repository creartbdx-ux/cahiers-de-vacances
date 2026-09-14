import type { CSSProperties } from "react"
import { bookColor } from "@/lib/book-renderer/palette"
import type { BookStyleTokens } from "@/lib/book-renderer/styles"
import type { Palette } from "@/lib/supabase/types"
import type { PersonalEditorialPageV1, PersonalBlockV1 } from "@/lib/personal-editorial/types"

/**
 * Composite personal editorial page — spatial composition fills the useful A4 plane.
 * Packing fill ≠ visual fill: templates stretch zones intentionally.
 */
export function PersonalEditorialTemplate({
  page,
  style,
  palette: _palette,
}: {
  page: PersonalEditorialPageV1
  style: BookStyleTokens
  palette: Palette
}) {
  void _palette
  const frameRadius =
    style.badgeRadius === 999 ? Math.min(14, style.frameRadius || 10) : style.frameRadius
  const frame: CSSProperties = {
    borderRadius: frameRadius,
    border: `${style.frameBorderWidth}px solid ${bookColor.dark}`,
    overflow: "hidden",
    backgroundColor: "color-mix(in srgb, var(--book-secondary) 10%, var(--book-light))",
  }

  return (
    <div
      className="flex h-full w-full flex-col"
      style={{ gap: 0, minHeight: "100%" }}
      data-personal-layout={page.layoutId}
      data-personal-weight={page.weight}
      data-packing-fill={page.packingFillScore.toFixed(2)}
      data-personal-hero={page.isHero ? "1" : "0"}
    >
      {page.layoutId === "HERO_MEMORY" && page.blocks[0]?.type === "MEMORY" && (
        <HeroMemory block={page.blocks[0]} style={style} />
      )}
      {page.layoutId === "SINGLE_MEMORY" && page.blocks[0]?.type === "MEMORY" && (
        <SingleMemory block={page.blocks[0]} style={style} />
      )}
      {page.layoutId === "HERO_PHOTO_MEMORY" && page.blocks[0]?.type === "PHOTO_MEMORY" && (
        <HeroPhoto block={page.blocks[0]} style={style} frame={frame} />
      )}
      {page.layoutId === "SINGLE_PHOTO_MEMORY" && page.blocks[0]?.type === "PHOTO_MEMORY" && (
        <SinglePhoto block={page.blocks[0]} style={style} frame={frame} />
      )}
      {page.layoutId === "PHOTO_PLUS_MEMORY" && (
        <PhotoPlusMemory
          blocks={page.blocks}
          style={style}
          frame={frame}
          variant={page.layoutVariant === "ASYMMETRIC" ? "ASYMMETRIC" : "STACK"}
        />
      )}
      {page.layoutId === "TWO_PHOTOS" && (
        <TwoPhotos blocks={page.blocks} style={style} frame={frame} />
      )}
      {page.layoutId === "TWO_MEMORIES" && <TwoMemories blocks={page.blocks} style={style} />}
      {page.layoutId === "THREE_SNIPPETS" && <ThreeSnippets blocks={page.blocks} style={style} />}
      {page.layoutId === "PHOTO_PLUS_TWO_SNIPPETS" && (
        <PhotoPlusTwoSnippets blocks={page.blocks} style={style} frame={frame} />
      )}
    </div>
  )
}

function bodySizeFor(density: string, base: number): number {
  if (density === "SHORT") return base + 3
  if (density === "RICH") return Math.max(base - 1, 13)
  return base
}

function titleSizeFor(density: string, base: number): number {
  if (density === "SHORT") return base + 6
  if (density === "RICH") return base - 2
  return base
}

function HeroMemory({
  block,
  style,
}: {
  block: Extract<PersonalBlockV1, { type: "MEMORY" }>
  style: BookStyleTokens
}) {
  return (
    <div
      className="relative flex h-full flex-col justify-between"
      style={{ padding: 8 }}
      data-layout-zone="hero-memory"
    >
      <DecorCorner style={style} />
      <div className="flex flex-1 flex-col justify-center" style={{ gap: 18, paddingInline: 12 }}>
        <p className={style.gameLabelClassName} style={{ fontSize: 11, letterSpacing: "0.28em" }}>
          SOUVENIR
        </p>
        {(block.eyebrow || block.place) && (
          <p style={{ fontSize: 14, color: bookColor.dark, opacity: 0.65 }}>
            {block.eyebrow || block.place}
          </p>
        )}
        <h1
          className={style.titleClassName}
          style={{ fontSize: 44, color: bookColor.primary, lineHeight: 1.02, maxWidth: 480 }}
        >
          {block.title}
        </h1>
        <Rule />
        <p
          className={style.instructionClassName}
          style={{
            fontSize: 17,
            lineHeight: 1.6,
            color: bookColor.dark,
            maxWidth: 520,
            whiteSpace: "pre-wrap",
          }}
        >
          {block.body}
        </p>
      </div>
      <DecorFooter style={style} />
    </div>
  )
}

/** MEDIUM/SHORT alone — editorial full page, not a tiny centered card. */
function SingleMemory({
  block,
  style,
}: {
  block: Extract<PersonalBlockV1, { type: "MEMORY" }>
  style: BookStyleTokens
}) {
  const dense = block.density === "SHORT"
  return (
    <div
      className="relative flex h-full flex-col"
      style={{ padding: 10 }}
      data-layout-zone="single-memory"
      data-memory-density={block.density}
    >
      <div className="flex items-start justify-between">
        <span
          aria-hidden
          style={{
            width: 48,
            height: 48,
            borderRadius: style.frameRadius,
            backgroundColor: "color-mix(in srgb, var(--book-accent) 40%, var(--book-light))",
            border: `${style.frameBorderWidth}px solid ${bookColor.accent}`,
          }}
        />
        <p className={style.gameLabelClassName} style={{ fontSize: 11, letterSpacing: "0.26em" }}>
          SOUVENIR
        </p>
      </div>

      <div
        className="flex flex-1 flex-col justify-center"
        style={{ gap: dense ? 28 : 20, paddingBlock: 24 }}
      >
        {(block.eyebrow || block.place) && (
          <p style={{ fontSize: 13, letterSpacing: "0.12em", opacity: 0.7 }}>
            {block.eyebrow || block.place}
          </p>
        )}
        <h1
          className={style.titleClassName}
          style={{
            fontSize: titleSizeFor(block.density, dense ? 48 : 38),
            color: bookColor.primary,
            lineHeight: 1.05,
            maxWidth: 460,
          }}
        >
          {block.title}
        </h1>
        <Rule wide={dense} />
        <blockquote
          className={style.instructionClassName}
          style={{
            margin: 0,
            fontSize: bodySizeFor(block.density, dense ? 22 : 17),
            lineHeight: dense ? 1.55 : 1.5,
            color: bookColor.dark,
            maxWidth: 500,
            whiteSpace: "pre-wrap",
          }}
        >
          {block.body}
        </blockquote>
      </div>

      <div className="flex items-end justify-between">
        <span
          aria-hidden
          style={{
            width: 88,
            height: 14,
            borderRadius: style.frameRadius,
            backgroundColor: "color-mix(in srgb, var(--book-secondary) 50%, var(--book-light))",
          }}
        />
        <span
          aria-hidden
          style={{
            width: 28,
            height: 28,
            borderRadius: style.frameRadius,
            backgroundColor: bookColor.primary,
          }}
        />
      </div>
    </div>
  )
}

function HeroPhoto({
  block,
  style,
  frame,
}: {
  block: Extract<PersonalBlockV1, { type: "PHOTO_MEMORY" }>
  style: BookStyleTokens
  frame: CSSProperties
}) {
  const portrait = (block.aspectRatio ?? 1.4) < 0.95
  if (portrait) {
    return (
      <div className="flex h-full" style={{ gap: 18 }} data-layout-zone="hero-photo-portrait">
        <div style={{ ...frame, width: "48%", alignSelf: "stretch" }}>
          {block.signedUrl ? <PhotoImg src={block.signedUrl} /> : null}
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-center" style={{ gap: 14 }}>
          <PhotoCopy block={block} style={style} titleSize={32} bodySize={15} />
        </div>
      </div>
    )
  }
  return (
    <div className="flex h-full flex-col" style={{ gap: 14 }} data-layout-zone="hero-photo">
      {block.signedUrl ? (
        <div style={{ ...frame, flex: "1 1 58%", minHeight: 320 }}>
          <PhotoImg src={block.signedUrl} />
        </div>
      ) : null}
      <div style={{ flex: "0 0 auto", paddingBottom: 8 }}>
        <PhotoCopy block={block} style={style} titleSize={34} bodySize={15} />
      </div>
    </div>
  )
}

function SinglePhoto({
  block,
  style,
  frame,
}: {
  block: Extract<PersonalBlockV1, { type: "PHOTO_MEMORY" }>
  style: BookStyleTokens
  frame: CSSProperties
}) {
  const portrait = (block.aspectRatio ?? 1.4) < 0.95
  return (
    <div
      className={portrait ? "flex h-full" : "flex h-full flex-col"}
      style={{ gap: 16 }}
      data-layout-zone="single-photo"
    >
      {block.signedUrl ? (
        <div
          style={{
            ...frame,
            ...(portrait
              ? { width: "46%", alignSelf: "stretch" }
              : { flex: "1 1 48%", minHeight: 260, maxHeight: "52%" }),
          }}
        >
          <PhotoImg src={block.signedUrl} />
        </div>
      ) : null}
      <div
        className="flex min-w-0 flex-1 flex-col justify-center"
        style={{ gap: 12, paddingBlock: 8 }}
      >
        <PhotoCopy
          block={block}
          style={style}
          titleSize={titleSizeFor(block.density, 30)}
          bodySize={bodySizeFor(block.density, 15)}
        />
      </div>
    </div>
  )
}

/**
 * PHOTO_PLUS_MEMORY — full-page: photo ~45% + caption, separator, memory zone fills rest.
 * Variants (seed-stable): STACK (classic) vs ASYMMETRIC (slightly taller photo / offset surface).
 */
function PhotoPlusMemory({
  blocks,
  style,
  frame,
  variant = "STACK",
}: {
  blocks: PersonalBlockV1[]
  style: BookStyleTokens
  frame: CSSProperties
  variant?: "STACK" | "ASYMMETRIC"
}) {
  const photo = blocks.find((b) => b.type === "PHOTO_MEMORY")
  const memory = blocks.find((b) => b.type === "MEMORY")
  if (!photo || photo.type !== "PHOTO_MEMORY" || !memory || memory.type !== "MEMORY") return null

  const portrait = (photo.aspectRatio ?? 1.4) < 0.95
  const photoFlex = variant === "ASYMMETRIC" ? "0 0 52%" : "0 0 46%"
  const photoWidthPortrait = variant === "ASYMMETRIC" ? "48%" : "44%"

  if (portrait) {
    return (
      <div
        className="flex h-full"
        style={{ gap: 16 }}
        data-layout-zone="photo-plus-memory-portrait"
        data-ppm-variant={variant}
      >
        <div className="flex flex-col" style={{ width: photoWidthPortrait, gap: 10 }}>
          {photo.signedUrl ? (
            <div style={{ ...frame, flex: "1 1 auto", minHeight: 280 }}>
              <PhotoImg src={photo.signedUrl} />
            </div>
          ) : null}
          <PhotoCopy block={photo} style={style} titleSize={18} bodySize={12} label="Photo" />
        </div>
        <div
          className="flex min-w-0 flex-1 flex-col justify-center"
          style={{
            gap: 12,
            borderLeft: `1px solid color-mix(in srgb, var(--book-secondary) 40%, transparent)`,
            paddingLeft: 16,
            ...(variant === "ASYMMETRIC"
              ? {
                  backgroundColor: "color-mix(in srgb, var(--book-secondary) 7%, transparent)",
                  borderRadius: style.frameRadius,
                  padding: 14,
                  borderLeft: "none",
                }
              : {}),
          }}
          data-source="memory"
        >
          <p className={style.gameLabelClassName} style={{ fontSize: 10, letterSpacing: "0.22em" }}>
            Souvenir
          </p>
          <BlockText
            style={style}
            eyebrow={memory.eyebrow || memory.place}
            title={memory.title}
            body={memory.body}
            titleSize={titleSizeFor(memory.density, 28)}
            bodySize={bodySizeFor(memory.density, 15)}
          />
        </div>
      </div>
    )
  }

  return (
    <div
      className="flex h-full flex-col"
      data-layout-zone="photo-plus-memory"
      data-ppm-variant={variant}
    >
      <div className="flex flex-col" style={{ flex: photoFlex, gap: 8, minHeight: 0 }} data-source="photo">
        {photo.signedUrl ? (
          <div style={{ ...frame, flex: "1 1 auto", minHeight: variant === "ASYMMETRIC" ? 250 : 220 }}>
            <PhotoImg src={photo.signedUrl} />
          </div>
        ) : null}
        <PhotoCopy block={photo} style={style} titleSize={20} bodySize={13} label="Photo" />
      </div>

      <div
        style={{
          marginBlock: variant === "ASYMMETRIC" ? 8 : 12,
          height: 1,
          backgroundColor: "color-mix(in srgb, var(--book-secondary) 45%, transparent)",
        }}
      />

      <div
        className="flex flex-1 flex-col justify-center"
        style={{
          minHeight: 0,
          gap: 12,
          padding: variant === "ASYMMETRIC" ? 16 : 12,
          borderRadius: style.frameRadius,
          backgroundColor:
            variant === "ASYMMETRIC"
              ? "color-mix(in srgb, var(--book-accent) 6%, transparent)"
              : "color-mix(in srgb, var(--book-secondary) 8%, transparent)",
        }}
        data-source="memory"
      >
        <p className={style.gameLabelClassName} style={{ fontSize: 10, letterSpacing: "0.22em" }}>
          Souvenir
        </p>
        <BlockText
          style={style}
          eyebrow={memory.eyebrow || memory.place}
          title={memory.title}
          body={memory.body}
          titleSize={titleSizeFor(memory.density, variant === "ASYMMETRIC" ? 26 : 28)}
          bodySize={bodySizeFor(memory.density, 15)}
        />
      </div>
    </div>
  )
}

function TwoPhotos({
  blocks,
  style,
  frame,
}: {
  blocks: PersonalBlockV1[]
  style: BookStyleTokens
  frame: CSSProperties
}) {
  const photos = blocks.filter((b) => b.type === "PHOTO_MEMORY")
  const bothPortrait = photos.every(
    (p) => p.type === "PHOTO_MEMORY" && (p.aspectRatio ?? 1.4) < 0.95,
  )

  if (bothPortrait) {
    return (
      <div className="flex h-full" style={{ gap: 14 }} data-layout-zone="two-photos-side">
        {photos.map((p) =>
          p.type === "PHOTO_MEMORY" ? (
            <div key={p.sourcePhotoId} className="flex min-w-0 flex-1 flex-col" style={{ gap: 8 }}>
              {p.signedUrl ? (
                <div style={{ ...frame, flex: "1 1 auto", minHeight: 280 }}>
                  <PhotoImg src={p.signedUrl} />
                </div>
              ) : null}
              <PhotoCopy block={p} style={style} titleSize={17} bodySize={12} />
            </div>
          ) : null,
        )}
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col" style={{ gap: 14 }} data-layout-zone="two-photos-stack">
      {photos.map((p) =>
        p.type === "PHOTO_MEMORY" ? (
          <div key={p.sourcePhotoId} className="flex min-h-0 flex-1 flex-col" style={{ gap: 6 }}>
            {p.signedUrl ? (
              <div style={{ ...frame, flex: "1 1 72%", minHeight: 160 }}>
                <PhotoImg src={p.signedUrl} />
              </div>
            ) : null}
            <PhotoCopy block={p} style={style} titleSize={17} bodySize={12} />
          </div>
        ) : null,
      )}
    </div>
  )
}

function TwoMemories({
  blocks,
  style,
}: {
  blocks: PersonalBlockV1[]
  style: BookStyleTokens
}) {
  const memories = blocks.filter((b) => b.type === "MEMORY")
  return (
    <div className="flex h-full flex-col" style={{ gap: 0 }} data-layout-zone="two-memories" data-memory-split="50-50">
      {memories.map((m, i) =>
        m.type === "MEMORY" ? (
          <div
            key={m.sourceMemoryId}
            className="flex min-h-0 flex-1 flex-col justify-center"
            style={{
              paddingBlock: 14,
              paddingInline: 4,
              borderTop:
                i > 0
                  ? `1px solid color-mix(in srgb, var(--book-accent) 40%, transparent)`
                  : undefined,
            }}
            data-source="memory"
          >
            <BlockText
              style={style}
              eyebrow={m.eyebrow || m.place || "Souvenir"}
              title={m.title}
              body={m.body}
              titleSize={titleSizeFor(m.density, 28)}
              bodySize={bodySizeFor(m.density, 15)}
            />
            <Rule />
          </div>
        ) : null,
      )}
    </div>
  )
}

function ThreeSnippets({
  blocks,
  style,
}: {
  blocks: PersonalBlockV1[]
  style: BookStyleTokens
}) {
  const items = blocks.slice(0, 3)
  const [top, ...rest] = items
  if (!top) return null

  if (rest.length === 2) {
    return (
      <div className="flex h-full flex-col" style={{ gap: 12 }} data-layout-zone="three-snippets">
        <div className="flex min-h-0 flex-[1.25] flex-col justify-center" style={{ paddingBottom: 8 }}>
          <BlockText
            style={style}
            title={top.title}
            body={top.body}
            titleSize={28}
            bodySize={15}
            eyebrow={top.type === "MEMORY" ? top.eyebrow || top.place : top.eyebrow}
          />
        </div>
        <div
          style={{
            height: 1,
            backgroundColor: "color-mix(in srgb, var(--book-secondary) 40%, transparent)",
          }}
        />
        <div className="flex min-h-0 flex-1 gap-4">
          {rest.map((b, i) => (
            <div
              key={b.type === "MEMORY" ? b.sourceMemoryId : b.sourcePhotoId}
              className="flex min-w-0 flex-1 flex-col justify-center"
              style={{
                paddingRight: i === 0 ? 10 : 0,
                borderRight:
                  i === 0
                    ? `1px solid color-mix(in srgb, var(--book-secondary) 28%, transparent)`
                    : undefined,
              }}
            >
              <BlockText style={style} title={b.title} body={b.body} titleSize={20} bodySize={13} />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col" data-layout-zone="three-snippets-equal">
      {items.map((b, i) => (
        <div
          key={b.type === "MEMORY" ? b.sourceMemoryId : b.sourcePhotoId}
          className="flex min-h-0 flex-1 flex-col justify-center"
          style={{
            borderTop:
              i > 0
                ? `1px solid color-mix(in srgb, var(--book-secondary) 35%, transparent)`
                : undefined,
            paddingBlock: 10,
          }}
        >
          <BlockText style={style} title={b.title} body={b.body} titleSize={22} bodySize={13} />
        </div>
      ))}
    </div>
  )
}

function PhotoPlusTwoSnippets({
  blocks,
  style,
  frame,
}: {
  blocks: PersonalBlockV1[]
  style: BookStyleTokens
  frame: CSSProperties
}) {
  const photo = blocks.find((b) => b.type === "PHOTO_MEMORY")
  const memories = blocks.filter((b) => b.type === "MEMORY")
  const portrait = photo?.type === "PHOTO_MEMORY" && (photo.aspectRatio ?? 1.4) < 0.95

  // Portrait: photo column + two memory zones stacked
  if (portrait) {
    return (
      <div className="flex h-full" style={{ gap: 16 }} data-layout-zone="photo-plus-two">
        <div className="flex flex-col" style={{ width: "46%", gap: 8 }}>
          {photo && photo.type === "PHOTO_MEMORY" && photo.signedUrl ? (
            <div style={{ ...frame, flex: "1 1 auto", minHeight: 240 }}>
              <PhotoImg src={photo.signedUrl} />
            </div>
          ) : null}
          {photo && photo.type === "PHOTO_MEMORY" ? (
            <PhotoCopy block={photo} style={style} titleSize={17} bodySize={12} label="Photo" />
          ) : null}
        </div>
        <div
          className="flex min-w-0 flex-1 flex-col"
          style={{
            gap: 0,
            borderLeft: `1px solid color-mix(in srgb, var(--book-secondary) 35%, transparent)`,
            paddingLeft: 14,
          }}
        >
          {memories.map((m, i) =>
            m.type === "MEMORY" ? (
              <div
                key={m.sourceMemoryId}
                className="flex min-h-0 flex-1 flex-col justify-center"
                style={{
                  gap: 8,
                  borderTop:
                    i > 0
                      ? `1px solid color-mix(in srgb, var(--book-secondary) 30%, transparent)`
                      : undefined,
                  paddingBlock: 10,
                }}
                data-source="memory"
              >
                <p
                  className={style.gameLabelClassName}
                  style={{ fontSize: 9, letterSpacing: "0.2em" }}
                >
                  Souvenir
                </p>
                <BlockText
                  style={style}
                  title={m.title}
                  body={m.body}
                  titleSize={titleSizeFor(m.density, 22)}
                  bodySize={bodySizeFor(m.density, 13)}
                />
              </div>
            ) : null,
          )}
        </div>
      </div>
    )
  }

  // Landscape: photo ~45% top, then two distinct memory zones on remaining height
  return (
    <div className="flex h-full flex-col" data-layout-zone="photo-plus-two">
      <div
        className="flex flex-col"
        style={{ flex: "0 0 44%", gap: 8, minHeight: 0 }}
        data-source="photo"
      >
        {photo && photo.type === "PHOTO_MEMORY" && photo.signedUrl ? (
          <div style={{ ...frame, flex: "1 1 auto", minHeight: 200 }}>
            <PhotoImg src={photo.signedUrl} />
          </div>
        ) : null}
        {photo && photo.type === "PHOTO_MEMORY" ? (
          <PhotoCopy block={photo} style={style} titleSize={18} bodySize={12} label="Photo" />
        ) : null}
      </div>

      <div
        style={{
          marginBlock: 10,
          height: 1,
          backgroundColor: "color-mix(in srgb, var(--book-secondary) 40%, transparent)",
        }}
      />

      <div className="flex min-h-0 flex-1 flex-col" style={{ gap: 0 }}>
        {memories.map((m, i) =>
          m.type === "MEMORY" ? (
            <div
              key={m.sourceMemoryId}
              className="flex min-h-0 flex-1 flex-col justify-center"
              style={{
                gap: 8,
                paddingBlock: 8,
                borderTop:
                  i > 0
                    ? `1px solid color-mix(in srgb, var(--book-accent) 35%, transparent)`
                    : undefined,
              }}
              data-source="memory"
            >
              <p
                className={style.gameLabelClassName}
                style={{ fontSize: 9, letterSpacing: "0.2em" }}
              >
                Souvenir
              </p>
              <BlockText
                style={style}
                title={m.title}
                body={m.body}
                titleSize={titleSizeFor(m.density, 22)}
                bodySize={bodySizeFor(m.density, 13)}
              />
            </div>
          ) : null,
        )}
      </div>
    </div>
  )
}

function PhotoCopy({
  block,
  style,
  titleSize,
  bodySize,
  label,
}: {
  block: Extract<PersonalBlockV1, { type: "PHOTO_MEMORY" }>
  style: BookStyleTokens
  titleSize: number
  bodySize: number
  label?: string
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {(label || block.eyebrow) && (
        <p className={style.gameLabelClassName} style={{ fontSize: 10, letterSpacing: "0.2em" }}>
          {label || block.eyebrow}
        </p>
      )}
      <h2
        className={style.titleClassName}
        style={{ fontSize: titleSize, color: bookColor.primary, lineHeight: 1.1, margin: 0 }}
      >
        {block.title}
      </h2>
      {block.body.trim() ? (
        <p
          className={style.instructionClassName}
          style={{
            fontSize: bodySize,
            lineHeight: 1.45,
            color: bookColor.dark,
            margin: 0,
            whiteSpace: "pre-wrap",
            opacity: 0.92,
          }}
        >
          {block.body}
        </p>
      ) : null}
    </div>
  )
}

function PhotoImg({ src }: { src: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      data-object-fit="cover"
      style={{
        width: "100%",
        height: "100%",
        objectFit: "cover",
        objectPosition: "center",
        display: "block",
      }}
    />
  )
}

function BlockText({
  style,
  eyebrow,
  title,
  body,
  titleSize,
  bodySize,
}: {
  style: BookStyleTokens
  eyebrow?: string | null
  title: string
  body: string
  titleSize: number
  bodySize: number
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {eyebrow ? (
        <p
          className={style.gameLabelClassName}
          style={{ fontSize: 10, letterSpacing: "0.18em", opacity: 0.75 }}
        >
          {eyebrow}
        </p>
      ) : null}
      <h2
        className={style.titleClassName}
        style={{
          fontSize: titleSize,
          color: bookColor.primary,
          lineHeight: 1.1,
          margin: 0,
        }}
      >
        {title}
      </h2>
      {body.trim() ? (
        <p
          className={style.instructionClassName}
          style={{
            fontSize: bodySize,
            lineHeight: 1.5,
            color: bookColor.dark,
            margin: 0,
            whiteSpace: "pre-wrap",
            opacity: 0.92,
          }}
        >
          {body}
        </p>
      ) : null}
    </div>
  )
}

function Rule({ wide }: { wide?: boolean } = {}) {
  return (
    <div
      aria-hidden
      style={{
        width: wide ? 72 : 48,
        height: 3,
        borderRadius: 999,
        backgroundColor: bookColor.accent,
        marginBlock: 4,
      }}
    />
  )
}

function DecorCorner({ style }: { style: BookStyleTokens }) {
  return (
    <div className="flex justify-between">
      <span
        aria-hidden
        style={{
          width: 40,
          height: 40,
          borderRadius: style.frameRadius,
          border: `${style.frameBorderWidth}px solid ${bookColor.accent}`,
          backgroundColor: "color-mix(in srgb, var(--book-accent) 35%, var(--book-light))",
        }}
      />
      <span
        className={style.gameLabelClassName}
        style={{ fontSize: 11, letterSpacing: "0.28em", color: "var(--book-page-band, var(--book-primary))" }}
      >
        SOUVENIR
      </span>
    </div>
  )
}

function DecorFooter({ style }: { style: BookStyleTokens }) {
  return (
    <div className="flex items-end justify-between">
      <span
        aria-hidden
        style={{
          width: 96,
          height: 16,
          borderRadius: style.frameRadius,
          backgroundColor: "color-mix(in srgb, var(--book-secondary) 50%, var(--book-light))",
        }}
      />
      <span
        aria-hidden
        style={{
          width: 28,
          height: 28,
          borderRadius: style.frameRadius,
          backgroundColor: bookColor.primary,
        }}
      />
    </div>
  )
}
