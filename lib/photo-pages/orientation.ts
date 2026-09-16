/** Photo orientation for album layout — no face detection. */

export type PhotoOrientation = "LANDSCAPE" | "PORTRAIT" | "SQUARE"

/**
 * Classify aspect ratio (width/height).
 * Unknown → LANDSCAPE (safe wide plane).
 */
export function classifyPhotoOrientation(aspectRatio?: number | null): PhotoOrientation {
  if (aspectRatio == null || !Number.isFinite(aspectRatio) || aspectRatio <= 0) {
    return "LANDSCAPE"
  }
  if (aspectRatio >= 1.12) return "LANDSCAPE"
  if (aspectRatio <= 0.88) return "PORTRAIT"
  return "SQUARE"
}

/** Prefer object-position that limits aggressive crop by orientation. */
export function objectPositionForOrientation(orientation: PhotoOrientation): string {
  if (orientation === "PORTRAIT") return "center 28%"
  if (orientation === "LANDSCAPE") return "center center"
  return "center center"
}

/**
 * Suggested intrinsic box ratio for the image window (not forced crop of source).
 * Used as CSS aspect-ratio hint when the cell is flexible.
 */
export function preferredFrameRatio(orientation: PhotoOrientation): string {
  if (orientation === "PORTRAIT") return "3 / 4"
  if (orientation === "LANDSCAPE") return "4 / 3"
  return "1 / 1"
}
