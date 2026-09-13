"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

export function PublicAuthLinks({
  isAuthenticated,
  isAdmin,
}: {
  isAuthenticated: boolean
  isAdmin: boolean
}) {
  const router = useRouter()

  if (!isAuthenticated) {
    return (
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Link href="/auth/login?next=/mes-cahiers" className="underline-offset-4 hover:underline">
          Se connecter
        </Link>
        <Link href="/auth/sign-up?next=/mes-cahiers" className="underline-offset-4 hover:underline">
          Créer un compte
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      {isAdmin && (
        <Link href="/admin" className="underline-offset-4 hover:underline">
          Admin
        </Link>
      )}
      <button
        type="button"
        className="underline-offset-4 hover:underline"
        onClick={async () => {
          const supabase = createClient()
          await supabase.auth.signOut()
          router.push("/")
          router.refresh()
        }}
      >
        Se déconnecter
      </button>
    </div>
  )
}
