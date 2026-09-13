"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { StatusBadge } from "@/components/admin/assets/status-badge"
import { SvgFrame } from "@/components/admin/assets/svg-frame"
import { ASSET_TYPE_LABELS } from "@/lib/svg/labels"
import type { Asset, AssetStatus, AssetType, Style, Universe } from "@/lib/supabase/types"

type Item = { asset: Asset; svg: string | null }

const SELECT_CLASS =
  "h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"

const CHIP_CLASS = "rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"

export function AssetsLibrary({
  items,
  universes,
  styles,
}: {
  items: Item[]
  universes: Universe[]
  styles: Style[]
}) {
  const universeName = useMemo(
    () => Object.fromEntries(universes.map((u) => [u.id, u.name])),
    [universes],
  )
  const styleName = useMemo(() => Object.fromEntries(styles.map((s) => [s.id, s.name])), [styles])

  const [q, setQ] = useState("")
  const [universe, setUniverse] = useState("all")
  const [style, setStyle] = useState("all")
  const [type, setType] = useState("all")
  const [status, setStatus] = useState("all")
  const [activeFilter, setActiveFilter] = useState("all")

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    return items.filter(({ asset }) => {
      if (query && !asset.name.toLowerCase().includes(query) && !asset.id.toLowerCase().includes(query)) {
        return false
      }
      if (universe !== "all" && asset.universe_id !== universe) return false
      if (style !== "all" && asset.style_id !== style) return false
      if (type !== "all" && asset.asset_type !== type) return false
      if (status !== "all" && asset.status !== status) return false
      if (activeFilter === "active" && !asset.active) return false
      if (activeFilter === "inactive" && asset.active) return false
      return true
    })
  }, [items, q, universe, style, type, status, activeFilter])

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher par nom ou identifiant…"
            className="h-9 pl-8"
            aria-label="Recherche texte"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            className={SELECT_CLASS}
            value={universe}
            onChange={(e) => setUniverse(e.target.value)}
            aria-label="Filtrer par univers"
          >
            <option value="all">Tous les univers</option>
            {universes.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
          <select
            className={SELECT_CLASS}
            value={style}
            onChange={(e) => setStyle(e.target.value)}
            aria-label="Filtrer par style"
          >
            <option value="all">Tous les styles</option>
            {styles.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <select
            className={SELECT_CLASS}
            value={type}
            onChange={(e) => setType(e.target.value)}
            aria-label="Filtrer par type"
          >
            <option value="all">Tous les types</option>
            {(Object.keys(ASSET_TYPE_LABELS) as AssetType[]).map((t) => (
              <option key={t} value={t}>
                {ASSET_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
          <select
            className={SELECT_CLASS}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            aria-label="Filtrer par statut"
          >
            <option value="all">Tous les statuts</option>
            <option value="DRAFT">Brouillon</option>
            <option value="VALIDATED">Validé</option>
            <option value="REJECTED">Rejeté</option>
          </select>
          <select
            className={SELECT_CLASS}
            value={activeFilter}
            onChange={(e) => setActiveFilter(e.target.value)}
            aria-label="Filtrer par activité"
          >
            <option value="all">Actifs et inactifs</option>
            <option value="active">Actifs</option>
            <option value="inactive">Inactifs</option>
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex items-center justify-center rounded-2xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
          <p className="max-w-sm text-sm text-muted-foreground">
            {items.length === 0
              ? "La bibliothèque est vide. Ajoutez votre premier asset SVG."
              : "Aucun asset ne correspond aux filtres sélectionnés."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
          {filtered.map(({ asset, svg }) => (
            <Link
              key={asset.id}
              href={`/admin/assets/${asset.id}`}
              className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-colors hover:border-primary/50"
            >
              <div className="relative aspect-square border-b border-border p-6">
                <SvgFrame svg={svg} className="h-full w-full" checker label={asset.name} />
                {!asset.active && (
                  <span className="absolute left-2 top-2 rounded-full bg-foreground/80 px-2 py-0.5 text-xs font-medium text-background">
                    Inactif
                  </span>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-2 p-3">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-serif text-sm font-semibold leading-tight text-foreground text-balance">
                    {asset.name}
                  </h3>
                  <StatusBadge status={asset.status} />
                </div>
                <span className="font-mono text-xs text-muted-foreground">{asset.id}</span>
                <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
                  <span className={CHIP_CLASS}>{ASSET_TYPE_LABELS[asset.asset_type]}</span>
                  {asset.universe_id && universeName[asset.universe_id] && (
                    <span className={CHIP_CLASS}>{universeName[asset.universe_id]}</span>
                  )}
                  {asset.style_id && styleName[asset.style_id] && (
                    <span className={CHIP_CLASS}>{styleName[asset.style_id]}</span>
                  )}
                  <span className={CHIP_CLASS}>P{asset.priority}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
