import { createClient } from "@/lib/supabase/server"
import type { Profile } from "@/lib/supabase/types"

/**
 * Returns the authenticated user and their profile row (which carries the
 * app role), or nulls when there is no session. Always resolve the session
 * with getUser() on the server so the token is verified, never trusted from
 * a cookie alone.
 */
export async function getCurrentUser() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { user: null, profile: null as Profile | null }
  }

  const { data: profile } = await supabase.from("profiles").select("id, role, created_at, updated_at").eq("id", user.id).single()

  return { user, profile: profile ?? null }
}

export async function isAdmin() {
  const { profile } = await getCurrentUser()
  return profile?.role === "admin"
}
