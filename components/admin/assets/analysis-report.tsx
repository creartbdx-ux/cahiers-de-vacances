import { AlertTriangle, Check, X } from "lucide-react"
import { SLOT_LABELS, TECHNICAL_COLORS, TECHNICAL_HEX_TO_SLOT } from "@/lib/svg/colors"
import type { SvgAnalysis } from "@/lib/svg/analyze"

export function AnalysisReport({ analysis }: { analysis: SvgAnalysis }) {
  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-1.5">
        {analysis.checks.map((check) => (
          <li key={check.id} className="flex items-start gap-2 text-sm">
            {check.ok ? (
              <Check className="mt-0.5 size-4 shrink-0 text-chart-4" />
            ) : (
              <X className="mt-0.5 size-4 shrink-0 text-destructive" />
            )}
            <span className={check.ok ? "text-foreground" : "text-destructive"}>
              {check.label}
              {check.detail && <span className="text-muted-foreground"> — {check.detail}</span>}
            </span>
          </li>
        ))}
      </ul>

      {analysis.warnings.length > 0 && (
        <div className="flex flex-col gap-1.5 rounded-lg border border-chart-3/40 bg-chart-3/10 p-3">
          {analysis.warnings.map((w) => (
            <p key={w} className="flex items-start gap-2 text-sm text-foreground">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-chart-3" />
              {w}
            </p>
          ))}
        </div>
      )}

      {analysis.errors.length > 0 && (
        <div className="flex flex-col gap-1.5 rounded-lg border border-destructive/30 bg-destructive/10 p-3">
          {analysis.errors.map((e) => (
            <p key={e} className="flex items-start gap-2 text-sm text-destructive">
              <X className="mt-0.5 size-4 shrink-0" />
              {e}
            </p>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Slots techniques détectés
        </span>
        {analysis.colorSlots.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun slot technique détecté.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {analysis.colorSlots.map((slot) => (
              <span
                key={slot}
                className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-xs text-foreground"
              >
                <span
                  className="size-3 rounded-full border border-border"
                  style={{ backgroundColor: TECHNICAL_COLORS[slot] }}
                />
                {slot} · {SLOT_LABELS[slot]}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Couleurs détectées
        </span>
        {analysis.colorsUsed.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune couleur solide détectée.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {analysis.colorsUsed.map((color) => {
              const known = Boolean(TECHNICAL_HEX_TO_SLOT[color.toUpperCase()])
              return (
                <span
                  key={color}
                  className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-xs"
                  style={{
                    borderColor: known ? "var(--border)" : "var(--destructive)",
                    color: known ? "var(--foreground)" : "var(--destructive)",
                  }}
                >
                  {color.startsWith("#") && (
                    <span
                      className="size-3 rounded-full border border-border"
                      style={{ backgroundColor: color }}
                    />
                  )}
                  {color}
                </span>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
