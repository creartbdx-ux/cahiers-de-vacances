import { createClient } from "@/lib/supabase/server"
import type { BookPhoto, BookProject } from "@/lib/supabase/types"
import { BOOK_STATUS } from "@/lib/books/lifecycle"

/**
 * Read helpers for customer book projects. RLS scopes every row to its owner
 * (with an admin override), so no manual user filter is required here — but
 * keep passing user_id explicitly on writes.
 */

export async function getBookProjects(): Promise<BookProject[]> {
  const supabase = await createClient()
  const { data } = await supabase.from("book_projects").select("*").order("updated_at", {
    ascending: false,
  })
  return data ?? []
}

export async function getBookProjectsForUser(userId: string): Promise<BookProject[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("book_projects")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
  return data ?? []
}

export async function getCompletedBookProjects(): Promise<BookProject[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("book_projects")
    .select("*")
    .eq("status", BOOK_STATUS.QUESTIONNAIRE_COMPLETED)
    .order("updated_at", { ascending: false })
  return data ?? []
}

export async function getBookProject(id: string): Promise<BookProject | null> {
  const supabase = await createClient()
  const { data } = await supabase.from("book_projects").select("*").eq("id", id).maybeSingle()
  return data ?? null
}

export async function getBookPhotos(bookProjectId: string): Promise<BookPhoto[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("book_photos")
    .select("*")
    .eq("book_project_id", bookProjectId)
    .order("created_at", { ascending: true })
  return data ?? []
}

export async function insertBookProject(input: {
  userId: string
  status: string
  questionnaireData: Record<string, unknown>
  paletteId: string | null
  styleId: string | null
  recipientFirstName: string | null
}): Promise<{ project: BookProject | null; error: string | null }> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("book_projects")
    .insert({
      user_id: input.userId,
      status: input.status,
      questionnaire_data: input.questionnaireData,
      palette_id: input.paletteId,
      style_id: input.styleId,
      recipient_first_name: input.recipientFirstName,
    })
    .select("*")
    .single()

  if (error) return { project: null, error: error.message }
  return { project: data, error: null }
}

export async function updateBookProject(
  id: string,
  patch: {
    status?: string
    questionnaireData?: Record<string, unknown>
    paletteId?: string | null
    styleId?: string | null
    recipientFirstName?: string | null
  },
): Promise<{ project: BookProject | null; error: string | null }> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("book_projects")
    .update({
      ...(patch.status != null ? { status: patch.status } : {}),
      ...(patch.questionnaireData != null ? { questionnaire_data: patch.questionnaireData } : {}),
      ...(patch.paletteId !== undefined ? { palette_id: patch.paletteId } : {}),
      ...(patch.styleId !== undefined ? { style_id: patch.styleId } : {}),
      ...(patch.recipientFirstName !== undefined
        ? { recipient_first_name: patch.recipientFirstName }
        : {}),
    })
    .eq("id", id)
    .select("*")
    .single()

  if (error) return { project: null, error: error.message }
  return { project: data, error: null }
}

export async function deleteBookProject(
  id: string,
): Promise<{ ok: boolean; error: string | null }> {
  const supabase = await createClient()
  const { error } = await supabase.from("book_projects").delete().eq("id", id)
  if (error) return { ok: false, error: error.message }
  return { ok: true, error: null }
}

export async function insertBookPhoto(input: {
  bookProjectId: string
  storagePath: string
  caption: string | null
  anecdote: string | null
  useAuthorized: boolean
}): Promise<{ photo: BookPhoto | null; error: string | null }> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("book_photos")
    .insert({
      book_project_id: input.bookProjectId,
      storage_path: input.storagePath,
      caption: input.caption,
      anecdote: input.anecdote,
      use_authorized: input.useAuthorized,
    })
    .select("*")
    .single()

  if (error) return { photo: null, error: error.message }
  return { photo: data, error: null }
}
