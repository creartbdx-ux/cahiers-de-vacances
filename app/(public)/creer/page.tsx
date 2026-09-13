import type { Metadata } from "next"
import Link from "next/link"
import { CreateBookButton } from "@/components/public/create-book-button"
import { PageIntro } from "@/components/public/page-intro"
import { getCurrentUser } from "@/lib/auth"

export const metadata: Metadata = {
  title: "Créer mon cahier",
}

export default async function CreerPage() {
  const { user } = await getCurrentUser()

  return (
    <PageIntro
      eyebrow="Étape 1"
      title="Créer mon cahier"
      description="Démarrez un nouveau projet. Vos cahiers existants restent intacts — vous pourrez toujours y revenir depuis Mes cahiers."
    >
      <div className="mx-auto flex max-w-lg flex-col gap-4">
        {user ? (
          <CreateBookButton />
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Connectez-vous ou créez un compte pour démarrer un nouveau cahier. Si vous avez déjà
              commencé un questionnaire hors connexion, vos réponses locales seront conservées.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href={`/auth/login?next=${encodeURIComponent("/creer")}`}
                className="inline-flex h-10 items-center justify-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground"
              >
                Se connecter
              </Link>
              <Link
                href={`/auth/sign-up?next=${encodeURIComponent("/creer")}`}
                className="inline-flex h-10 items-center justify-center rounded-full border border-border px-5 text-sm font-medium"
              >
                Créer un compte
              </Link>
            </div>
          </>
        )}
        {user && (
          <p className="text-sm text-muted-foreground">
            Déjà un projet en cours ?{" "}
            <Link href="/mes-cahiers" className="underline">
              Voir Mes cahiers
            </Link>
          </p>
        )}
      </div>
    </PageIntro>
  )
}
