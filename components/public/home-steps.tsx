import { ClipboardList, Eye, ShoppingBag } from 'lucide-react'

const steps = [
  {
    icon: ClipboardList,
    title: 'Répondez au questionnaire',
    description:
      'Quelques questions suffisent pour cerner vos goûts, votre niveau et vos envies du moment.',
  },
  {
    icon: Eye,
    title: 'Prévisualisez votre cahier',
    description:
      'Découvrez un aperçu fidèle : univers, jeux et mise en page prennent forme sous vos yeux.',
  },
  {
    icon: ShoppingBag,
    title: 'Commandez et savourez',
    description:
      'Validez votre commande et recevez un cahier fait pour vous, prêt à emporter partout.',
  },
]

export function HomeSteps() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 pb-20 sm:px-6 sm:pb-28">
      <div className="max-w-2xl">
        <h2 className="font-serif text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Trois étapes, un cahier bien à vous
        </h2>
        <p className="mt-3 text-muted-foreground">
          Un parcours simple, du premier clic au cahier entre les mains.
        </p>
      </div>

      <ol className="mt-10 grid gap-5 sm:grid-cols-3">
        {steps.map((step, index) => (
          <li
            key={step.title}
            className="rounded-2xl border border-border bg-card p-6 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                <step.icon className="size-5" />
              </span>
              <span className="font-serif text-sm font-semibold text-muted-foreground">
                Étape {index + 1}
              </span>
            </div>
            <h3 className="mt-4 text-lg font-semibold text-foreground">
              {step.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {step.description}
            </p>
          </li>
        ))}
      </ol>
    </section>
  )
}
