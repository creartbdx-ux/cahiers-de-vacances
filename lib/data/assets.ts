import { createClient } from "@/lib/supabase/server"
import { sanitizeSvg } from "@/lib/svg/transform"
import type { Asset, Palette } from "@/lib/supabase/types"

const ASSETS_BUCKET = "assets"

export interface AssetWithSvg {
  asset: Asset
  /** Sanitized markup, safe to render. Null when the file could not be read. */
  svg: string | null
}

/** Download the raw (unsanitized) master SVG text for an asset path. */
export async function getAssetSvgRaw(storagePath: string): Promise<string | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.storage.from(ASSETS_BUCKET).download(storagePath)
  if (error || !data) return null
  return await data.text()
}

/** All assets with their sanitized preview markup, newest first. */
export async function getAssetsWithSvg(): Promise<AssetWithSvg[]> {
  const supabase = await createClient()
  const { data } = await supabase.from("assets").select("*").order("created_at", { ascending: false })
  const assets = (data as Asset[]) ?? []

  return Promise.all(
    assets.map(async (asset) => {
      const raw = await getAssetSvgRaw(asset.svg_storage_path)
      return { asset, svg: raw ? sanitizeSvg(raw) : null }
    }),
  )
}

/**
 * Renderable assets for the book engine: only VALIDATED + active assets, with
 * their sanitized master SVG. Highest priority first. Recoloring per palette
 * happens client-side from this single master (no per-palette copies).
 */
export async function getRenderableAssetsWithSvg(): Promise<AssetWithSvg[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("assets")
    .select("*")
    .eq("status", "VALIDATED")
    .eq("active", true)
    .order("priority", { ascending: false })
    .order("created_at", { ascending: false })
  const assets = (data as Asset[]) ?? []

  return Promise.all(
    assets.map(async (asset) => {
      const raw = await getAssetSvgRaw(asset.svg_storage_path)
      return { asset, svg: raw ? sanitizeSvg(raw) : null }
    }),
  )
}

export async function getAssetById(id: string): Promise<Asset | null> {
  const supabase = await createClient()
  const { data } = await supabase.from("assets").select("*").eq("id", id).maybeSingle()
  return (data ?? null) as Asset | null
}

/** Active palettes, ordered by name, used for the recolor preview grid. */
export async function getActivePalettes(): Promise<Palette[]> {
  const supabase = await createClient()
  const { data } = await supabase.from("palettes").select("*").eq("active", true).order("name")
  return (data as Palette[]) ?? []
}
