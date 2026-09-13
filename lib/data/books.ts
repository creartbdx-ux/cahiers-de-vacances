import { createClient } from "@/lib/supabase/server"
import type { BookProject } from "@/lib/supabase/types"

/**
 * Read helpers for customer book projects. RLS scopes every row to its owner
 * (with an admin override), so no manual user filter is required here — but
 * keep passing user_id explicitly on writes in later steps.
 */

export async function getBookProjects(): Promise<BookProject[]> {
  const supabase = await createClient()
  const { data } = await supabase.from("book_projects").select("*").order("created_at", { ascending: false })
  return data ?? []
}

export async function getBookProject(id: string): Promise<BookProject | null> {
  const supabase = await createClient()
  const { data } = await supabase.from("book_projects").select("*").eq("id", id).maybeSingle()
  return data ?? null
}
