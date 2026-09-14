import { createClient } from "@/lib/supabase/server"
import type { Asset, Game, Palette, Style, Template, Universe } from "@/lib/supabase/types"

/**
 * Read helpers for the admin library tables, run with the caller's session.
 * RLS: palettes/styles/universes are public-read (surfaced to customers during
 * book creation); games/templates/assets are admin-only reads. Writes across
 * all tables are admin-only and left to later steps (forms + server actions).
 */

export async function getPalettes(): Promise<Palette[]> {
  const supabase = await createClient()
  const { data } = await supabase.from("palettes").select("*").order("name")
  return (data as Palette[]) ?? []
}

export async function getStyles(): Promise<Style[]> {
  const supabase = await createClient()
  const { data } = await supabase.from("styles").select("*").order("name")
  return (data as Style[]) ?? []
}

export async function getUniverses(): Promise<Universe[]> {
  const supabase = await createClient()
  const { data } = await supabase.from("universes").select("*").order("name")
  return ((data as Universe[]) ?? []).map(normalizeUniverse)
}

export async function getActiveUniverses(): Promise<Universe[]> {
  const supabase = await createClient()
  const { data } = await supabase.from("universes").select("*").eq("active", true).order("name")
  return ((data as Universe[]) ?? []).map(normalizeUniverse)
}

/** Tolerant mapping while editorial columns roll out. */
function normalizeUniverse(row: Universe): Universe {
  return {
    ...row,
    editorial_description: row.editorial_description ?? null,
    allowed_topics: Array.isArray(row.allowed_topics) ? row.allowed_topics : [],
    excluded_topics: Array.isArray(row.excluded_topics) ? row.excluded_topics : [],
    quiz_guidance: row.quiz_guidance ?? null,
  }
}

export async function getActiveStyles(): Promise<Style[]> {
  const supabase = await createClient()
  const { data } = await supabase.from("styles").select("*").eq("active", true).order("name")
  return (data as Style[]) ?? []
}

export async function getAssets(): Promise<Asset[]> {
  const supabase = await createClient()
  const { data } = await supabase.from("assets").select("*").order("created_at", { ascending: false })
  return (data as Asset[]) ?? []
}

export async function getGames(): Promise<Game[]> {
  const supabase = await createClient()
  const { data } = await supabase.from("games").select("*").order("name")
  return (data as Game[]) ?? []
}

export async function getTemplates(): Promise<Template[]> {
  const supabase = await createClient()
  const { data } = await supabase.from("templates").select("*").order("name")
  return (data as Template[]) ?? []
}
