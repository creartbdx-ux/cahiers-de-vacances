/**
 * Fixed page geometry for the book renderer. The page is authored in a stable
 * pixel coordinate system that mirrors a printed A4 portrait sheet at 96 DPI,
 * so the same composition can later be handed to a PDF pipeline unchanged.
 *
 *   210 mm x 297 mm  ->  794 px x 1123 px  (1 mm ≈ 3.7795 px)
 *
 * On screen we never change these numbers; we only scale the whole page down
 * with a CSS transform to fit the available width (see PagePreview).
 */
export const PAGE_WIDTH = 794
export const PAGE_HEIGHT = 1123

/** Print safety margin (~15 mm). Nothing functional should sit outside it. */
export const SAFE_MARGIN = 57
