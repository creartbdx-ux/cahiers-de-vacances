"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import { getAssetById, getAssetSvgRaw } from "@/lib/data/assets"
import { createClient } from "@/lib/supabase/server"
import { analyzeSvg } from "@/lib/svg/analyze"
import type { AssetStatus, AssetType } from "@/lib/supabase/types"

const ASSETS_BUCKET = "assets"
const MAX_SVG_BYTES = 512 * 1024 // 512 KB
const ASSET_TYPES: AssetType[] = ["ICON", "DECOR", "HERO"]

export type CreateAssetState = { error?: string } | null

async function requireAdmin() {
  const { user, profile } = await getCurrentUser()
  if (!user || profile?.role !== "admin") return null
  return user
}

/**
 * Upload a new master SVG. The status is ALWAYS forced to DRAFT here — there is
 * no code path that lets creation produce a VALIDATED asset. validated_at /
 * validated_by stay null until a human validates later.
 */
export async function createAsset(_prev: CreateAssetState, formData: FormData): Promise<CreateAssetState> {
  const user = await requireAdmin()
  if (!user) return { error: "Action réservée aux administrateurs." }

  const id = String(formData.get("id") ?? "").trim()
  const name = String(formData.get("name") ?? "").trim()
  const universeId = String(formData.get("universe_id") ?? "").trim()
  const styleId = String(formData.get("style_id") ?? "").trim()
  const assetType = String(formData.get("asset_type") ?? "").trim() as AssetType
  const recolorable = formData.get("recolorable") === "on"
  const active = formData.get("active") === "on"
  const priority = Number(formData.get("priority") ?? 3)
  const file = formData.get("file")

  if (!id || !/^[a-z0-9_-]+$/i.test(id)) {
    return { error: "L'identifiant est requis (lettres, chiffres, tirets et underscores uniquement)." }
  }
  if (!name) return { error: "Le nom est requis." }
  if (!ASSET_TYPES.includes(assetType)) return { error: "Type d'asset invalide." }
  if (!Number.isInteger(priority) || priority < 1 || priority > 5) {
    return { error: "La priorité doit être un entier entre 1 et 5." }
  }
  if (!(file instanceof File) || file.size === 0) return { error: "Un fichier SVG est requis." }
  if (file.size > MAX_SVG_BYTES) return { error: "Le fichier SVG dépasse 512 Ko." }

  const svgText = await file.text()
  const analysis = analyzeSvg(svgText, recolorable)

  // Hard-block only on a non-SVG file; every other issue is surfaced later on
  // the detail page and simply keeps the asset in DRAFT (per spec).
  if (!analysis.hasSvgElement) {
    return { error: "Le fichier fourni n'est pas un SVG valide." }
  }

  const supabase = await createClient()
  const storagePath = `${id}.svg`

  const { error: uploadError } = await supabase.storage
    .from(ASSETS_BUCKET)
    .upload(storagePath, svgText, { contentType: "image/svg+xml", upsert: false })

  if (uploadError) {
    const duplicate = uploadError.message?.toLowerCase().includes("exists")
    return {
      error: duplicate
        ? "Un asset avec cet identifiant existe déjà."
        : `Échec de l'envoi du fichier : ${uploadError.message}`,
    }
  }

  const insertPayload = {
    id,
    name,
    universe_id: universeId || null,
    style_id: styleId || null,
    asset_type: assetType,
    svg_storage_path: storagePath,
    recolorable,
    color_slots: analysis.colorSlots,
    priority,
    status: "DRAFT" as AssetStatus, // never anything else at creation
    active,
    validated_at: null,
    validated_by: null,
  }
  // Cast: the hand-written Database type models Insert as the full Row, so the
  // generated insert parameter resolves too strictly for a defaulted row.
  const { error: insertError } = await supabase.from("assets").insert(insertPayload as never)

  if (insertError) {
    // Roll back the uploaded file so storage and table stay consistent.
    await supabase.storage.from(ASSETS_BUCKET).remove([storagePath])
    const duplicate = insertError.message?.toLowerCase().includes("duplicate")
    return {
      error: duplicate
        ? "Un asset avec cet identifiant existe déjà."
        : `Échec de l'enregistrement : ${insertError.message}`,
    }
  }

  revalidatePath("/admin/assets")
  redirect(`/admin/assets/${id}`)
}

export type ActionResult = { ok: boolean; error?: string }

async function updateStatus(id: string, patch: Record<string, unknown>): Promise<ActionResult> {
  const user = await requireAdmin()
  if (!user) return { ok: false, error: "Action réservée aux administrateurs." }

  const supabase = await createClient()
  const { error } = await supabase.from("assets").update(patch as never).eq("id", id)
  if (error) return { ok: false, error: error.message }

  revalidatePath("/admin/assets")
  revalidatePath(`/admin/assets/${id}`)
  return { ok: true }
}

/**
 * Human validation. Re-downloads and re-analyzes the master SVG so an asset can
 * only ever be validated when it currently passes the required checks.
 */
export async function validateAsset(id: string): Promise<ActionResult> {
  const user = await requireAdmin()
  if (!user) return { ok: false, error: "Action réservée aux administrateurs." }

  const asset = await getAssetById(id)
  if (!asset) return { ok: false, error: "Asset introuvable." }

  const raw = await getAssetSvgRaw(asset.svg_storage_path)
  if (!raw) return { ok: false, error: "Fichier SVG illisible." }

  const analysis = analyzeSvg(raw, asset.recolorable)
  if (!analysis.canValidate) {
    return { ok: false, error: "Le SVG ne passe pas les contrôles requis pour la validation." }
  }

  return updateStatus(id, {
    status: "VALIDATED" satisfies AssetStatus,
    validated_at: new Date().toISOString(),
    validated_by: user.id,
  })
}

export async function rejectAsset(id: string): Promise<ActionResult> {
  return updateStatus(id, { status: "REJECTED" satisfies AssetStatus })
}

export async function disableAsset(id: string): Promise<ActionResult> {
  return updateStatus(id, { active: false })
}

export async function enableAsset(id: string): Promise<ActionResult> {
  return updateStatus(id, { active: true })
}

/** Send an asset back to DRAFT (clears the validation stamp). */
export async function setAssetDraft(id: string): Promise<ActionResult> {
  return updateStatus(id, {
    status: "DRAFT" satisfies AssetStatus,
    validated_at: null,
    validated_by: null,
  })
}
