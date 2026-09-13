"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { PAGE_HEIGHT, PAGE_WIDTH } from "@/lib/book-renderer/constants"

/**
 * Scales a full-size A4 page down to fit the available width while preserving
 * its exact proportions. The page keeps its stable internal pixel dimensions
 * (good for a future PDF render); only a CSS transform changes on screen.
 */
export function PagePreview({ children }: { children: ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = () => setScale(Math.min(1, el.clientWidth / PAGE_WIDTH))
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <div ref={containerRef} className="w-full">
      <div className="mx-auto" style={{ width: PAGE_WIDTH * scale, height: PAGE_HEIGHT * scale }}>
        <div
          style={{
            width: PAGE_WIDTH,
            height: PAGE_HEIGHT,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
