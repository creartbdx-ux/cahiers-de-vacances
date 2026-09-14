"use server"

import { revalidatePath } from "next/cache"
import { getCurrentUser } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"

export type UpdateUniverseEditorialState = { ok?: true; error?: string } | null

function parseTopicLines(raw: string): string[] {
  return raw
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export async function updateUniverseEditorialAction(
  _prev: UpdateUniverseEditorialState,
  formData: FormData,
): Promise<UpdateUniverseEditorialState> {
  const { user, profile } = await getCurrentUser()
  if (!user || profile?.role !== "admin") {
    return { error: "Action réservée aux administrateurs." }
  }

  const id = String(formData.get("id") ?? "").trim()
  const name = String(formData.get("name") ?? "").trim()
  const editorialDescription = String(formData.get("editorial_description") ?? "").trim()
  const quizGuidance = String(formData.get("quiz_guidance") ?? "").trim()
  const allowedTopics = parseTopicLines(String(formData.get("allowed_topics") ?? ""))
  const excludedTopics = parseTopicLines(String(formData.get("excluded_topics") ?? ""))
  const active = formData.get("active") === "on"

  if (!id) return { error: "Identifiant univers manquant." }
  if (!name) return { error: "Le nom public est requis." }

  const supabase = await createClient()
  const { error } = await supabase
    .from("universes")
    .update({
      name,
      editorial_description: editorialDescription || null,
      allowed_topics: allowedTopics,
      excluded_topics: excludedTopics,
      quiz_guidance: quizGuidance || null,
      active,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)

  if (error) {
    return {
      error:
        error.message.includes("editorial_description") || error.code === "PGRST204"
          ? "Colonnes éditoriales absentes. Appliquez d'abord la migration 012 dans Supabase."
          : `Échec de la sauvegarde : ${error.message}`,
    }
  }

  revalidatePath("/admin/univers")
  return { ok: true }
}
