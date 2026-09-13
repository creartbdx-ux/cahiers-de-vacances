"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Check, RotateCcw, X, EyeOff, Eye } from "lucide-react"
import {
  disableAsset,
  enableAsset,
  rejectAsset,
  setAssetDraft,
  validateAsset,
  type ActionResult,
} from "@/app/admin/assets/actions"
import { Button } from "@/components/ui/button"
import type { Asset } from "@/lib/supabase/types"

export function AssetActions({ asset, canValidate }: { asset: Asset; canValidate: boolean }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function run(action: () => Promise<ActionResult>, confirmMessage?: string) {
    if (confirmMessage && !window.confirm(confirmMessage)) return
    setError(null)
    startTransition(async () => {
      const res = await action()
      if (!res.ok) setError(res.error ?? "Une erreur est survenue.")
      else router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {asset.status !== "VALIDATED" && (
          <Button
            disabled={isPending || !canValidate}
            onClick={() => run(() => validateAsset(asset.id))}
          >
            <Check />
            Valider
          </Button>
        )}
        {asset.status !== "REJECTED" && (
          <Button
            variant="destructive"
            disabled={isPending}
            onClick={() => run(() => rejectAsset(asset.id), "Rejeter cet asset ?")}
          >
            <X />
            Rejeter
          </Button>
        )}
        {asset.status !== "DRAFT" && (
          <Button
            variant="outline"
            disabled={isPending}
            onClick={() => run(() => setAssetDraft(asset.id))}
          >
            <RotateCcw />
            Repasser en brouillon
          </Button>
        )}
        {asset.active ? (
          <Button
            variant="outline"
            disabled={isPending}
            onClick={() => run(() => disableAsset(asset.id), "Désactiver cet asset ?")}
          >
            <EyeOff />
            Désactiver
          </Button>
        ) : (
          <Button variant="outline" disabled={isPending} onClick={() => run(() => enableAsset(asset.id))}>
            <Eye />
            Réactiver
          </Button>
        )}
      </div>

      {asset.status !== "VALIDATED" && !canValidate && (
        <p className="text-xs text-muted-foreground">
          La validation est bloquée tant que le contrôle technique n&apos;est pas conforme.
        </p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
