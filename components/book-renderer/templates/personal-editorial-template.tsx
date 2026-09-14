import type { CSSProperties } from "react"
import { bookColor } from "@/lib/book-renderer/palette"
import type { BookStyleTokens } from "@/lib/book-renderer/styles"
import type { Palette } from "@/lib/supabase/types"
import type { PersonalEditorialPageV1, PersonalBlockV1 } from "@/lib/personal-editorial/types"

/**
 * Composite personal editorial page — multiple blocks, no narrative fusion.
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
      style={{ gap: 14 }}
      data-personal-layout={page.layoutId}
      data-personal-weight={page.weight}
      data-personal-hero={page.isHero ? "1" : "0"}
    >
      {page.layoutId === "HERO_MEMORY" && page.blocks[0]?.type === "MEMORY" && (
        <HeroMemory block={page.blocks[0]} style={style} />
      )}
      {page.layoutId === "HERO_PHOTO_MEMORY" && page.blocks[0]?.type === "PHOTO_MEMORY" && (
        <HeroPhoto block={page.blocks[0]} style={style} frame={frame} />
      )}
      {page.layoutId === "PHOTO_PLUS_MEMORY" && (
        <PhotoPlusMemory blocks={page.blocks} style={style} frame={frame} />
      )}
      {page.layoutId === "TWO_PHOTOS" && (
        <TwoPhotos blocks={page.blocks} style={style} frame={frame} />
      )}
      {page.layoutId === "TWO_MEMORIES" && (
        <TwoMemories blocks={page.blocks} style={style} />
      )}
      {page.layoutId === "THREE_SNIPPETS" && (
        <ThreeSnippets blocks={page.blocks} style={style} />
      )}
      {page.layoutId === "PHOTO_PLUS_TWO_SNIPPETS" && (
        <PhotoPlusTwoSnippets blocks={page.blocks} style={style} frame={frame} />
      )}
    </div>
  )
}

function HeroMemory({
  block,
  style,
}: {
  block: Extract<PersonalBlockV1, { type: "MEMORY" }>
  style: BookStyleTokens
}) {
  return (
    <div className="flex h-full flex-col justify-center" style={{ gap: 16, padding: 8 }}>
      <p className={style.gameLabelClassName} style={{ fontSize: 11, letterSpacing: "0.24em" }}>
        SOUVENIR
      </p>
      {(block.eyebrow || block.place) && (
        <p style={{ fontSize: 13, color: bookColor.dark, opacity: 0.65 }}>
          {block.eyebrow || block.place}
        </p>
      )}
      <h1
        className={style.titleClassName}
        style={{ fontSize: block.density === "RICH" ? 40 : 48, color: bookColor.primary, lineHeight: 1 }}
      >
        {block.title}
      </h1>
      <div style={{ width: 56, height: 3, backgroundColor: bookColor.accent, borderRadius: 999 }} />
      <p
        className={style.instructionClassName}
        style={{ fontSize: 17, lineHeight: 1.55, color: bookColor.dark, maxWidth: 500, whiteSpace: "pre-wrap" }}
      >
        {block.body}
      </p>
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
  return (
    <div className="flex h-full flex-col" style={{ gap: 14 }}>
      {block.signedUrl ? (
        <div style={{ ...frame, flex: "1 1 55%", minHeight: 280 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={block.signedUrl}
            alt=""
            data-object-fit="cover"
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        </div>
      ) : null}
      <div style={{ gap: 8, display: "flex", flexDirection: "column" }}>
        {block.eyebrow ? (
          <p className={style.gameLabelClassName} style={{ fontSize: 11, letterSpacing: "0.2em" }}>
            {block.eyebrow}
          </p>
        ) : null}
        <h1 className={style.titleClassName} style={{ fontSize: 34, color: bookColor.primary }}>
          {block.title}
        </h1>
        {block.body ? (
          <p
            className={style.instructionClassName}
            style={{ fontSize: 15, lineHeight: 1.5, color: bookColor.dark, whiteSpace: "pre-wrap" }}
          >
            {block.body}
          </p>
        ) : null}
      </div>
    </div>
  )
}

function PhotoPlusMemory({
  blocks,
  style,
  frame,
}: {
  blocks: PersonalBlockV1[]
  style: BookStyleTokens
  frame: CSSProperties
}) {
  const photo = blocks.find((b) => b.type === "PHOTO_MEMORY")
  const memory = blocks.find((b) => b.type === "MEMORY")
  if (!photo || photo.type !== "PHOTO_MEMORY" || !memory || memory.type !== "MEMORY") return null
  return (
    <div className="flex h-full flex-col" style={{ gap: 16 }}>
      {photo.signedUrl ? (
        <div style={{ ...frame, height: "46%", minHeight: 220 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo.signedUrl}
            alt=""
            data-object-fit="cover"
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        </div>
      ) : null}
      <BlockText
        style={style}
        eyebrow={photo.eyebrow}
        title={photo.title}
        body={photo.body}
        titleSize={26}
        bodySize={14}
      />
      <div style={{ height: 1, backgroundColor: "color-mix(in srgb, var(--book-secondary) 40%, transparent)" }} />
      <BlockText
        style={style}
        eyebrow={memory.eyebrow || memory.place}
        title={memory.title}
        body={memory.body}
        titleSize={24}
        bodySize={14}
      />
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
  return (
    <div className="flex h-full flex-col" style={{ gap: 18 }}>
      {photos.map((p) =>
        p.type === "PHOTO_MEMORY" ? (
          <div key={p.sourcePhotoId} className="flex flex-1 flex-col" style={{ gap: 8, minHeight: 0 }}>
            {p.signedUrl ? (
              <div style={{ ...frame, flex: "1 1 auto", minHeight: 140 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.signedUrl}
                  alt=""
                  data-object-fit="cover"
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                />
              </div>
            ) : null}
            <BlockText style={style} title={p.title} body={p.body} titleSize={20} bodySize={13} />
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
    <div className="flex h-full flex-col justify-center" style={{ gap: 22 }}>
      {memories.map((m, i) =>
        m.type === "MEMORY" ? (
          <div key={m.sourceMemoryId}>
            {i > 0 ? (
              <div
                style={{
                  height: 1,
                  marginBottom: 18,
                  backgroundColor: "color-mix(in srgb, var(--book-accent) 35%, transparent)",
                }}
              />
            ) : null}
            <BlockText
              style={style}
              eyebrow={m.eyebrow || m.place}
              title={m.title}
              body={m.body}
              titleSize={28}
              bodySize={15}
            />
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
  return (
    <div className="flex h-full flex-col justify-between" style={{ gap: 12, paddingBlock: 8 }}>
      {blocks.map((b) => (
        <div
          key={b.type === "MEMORY" ? b.sourceMemoryId : b.sourcePhotoId}
          style={{
            paddingBottom: 10,
            borderBottom: `1px solid color-mix(in srgb, var(--book-secondary) 30%, transparent)`,
          }}
        >
          <BlockText
            style={style}
            title={b.title}
            body={b.body}
            titleSize={22}
            bodySize={13}
          />
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
  return (
    <div className="flex h-full" style={{ gap: 16 }}>
      <div className="flex flex-col" style={{ width: "42%", gap: 8 }}>
        {photo && photo.type === "PHOTO_MEMORY" && photo.signedUrl ? (
          <div style={{ ...frame, flex: "1 1 auto", minHeight: 200 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.signedUrl}
              alt=""
              data-object-fit="cover"
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
          </div>
        ) : null}
        {photo && photo.type === "PHOTO_MEMORY" ? (
          <BlockText style={style} title={photo.title} body={photo.body} titleSize={18} bodySize={12} />
        ) : null}
      </div>
      <div className="flex flex-1 flex-col justify-center" style={{ gap: 16 }}>
        {memories.map((m) =>
          m.type === "MEMORY" ? (
            <BlockText
              key={m.sourceMemoryId}
              style={style}
              title={m.title}
              body={m.body}
              titleSize={22}
              bodySize={13}
            />
          ) : null,
        )}
      </div>
    </div>
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
        <p className={style.gameLabelClassName} style={{ fontSize: 10, letterSpacing: "0.18em", opacity: 0.75 }}>
          {eyebrow}
        </p>
      ) : null}
      <h2 className={style.titleClassName} style={{ fontSize: titleSize, color: bookColor.primary, lineHeight: 1.1, margin: 0 }}>
        {title}
      </h2>
      {body.trim() ? (
        <p
          className={style.instructionClassName}
          style={{ fontSize: bodySize, lineHeight: 1.45, color: bookColor.dark, margin: 0, whiteSpace: "pre-wrap", opacity: 0.92 }}
        >
          {body}
        </p>
      ) : null}
    </div>
  )
}
