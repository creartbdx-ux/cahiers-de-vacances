"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { createBookProjectAction } from "@/app/(public)/questionnaire/actions"
import { Button } from "@/components/ui/button"
import { clearQuestionnaireDraft } from "@/lib/questionnaire/storage"

export function CreateBookButton() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        size="lg"
        className="rounded-full"
        disabled={pending}
        onClick={() => {
          setError(null)
          startTransition(async () => {
            const result = await createBookProjectAction()
            if (!result.ok) {
              if (result.code === "AUTH_REQUIRED") {
                router.push(`/auth/login?next=${encodeURIComponent("/creer")}`)
                return
              }
              setError(result.error)
              return
            }
            clearQuestionnaireDraft()
            router.push(`/questionnaire?project=${result.projectId}`)
          })
        }}
      >
        {pending ? "Création…" : "Démarrer un nouveau cahier"}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
