"use client"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { BrandLogo } from "@/components/brand-logo"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"

function signUpErrorMessage(error: unknown): string {
  const { code, status } = (error ?? {}) as { code?: string; status?: number }

  if (code === "weak_password") {
    return "Choisissez un mot de passe plus robuste."
  }
  if (code === "email_address_invalid") {
    return "Utilisez une adresse e-mail réelle — les domaines de test ne sont pas acceptés."
  }
  if (code === "email_address_not_authorized") {
    return "Impossible d'envoyer l'e-mail de confirmation à cette adresse. Essayez-en une autre."
  }
  if (code === "validation_failed") {
    return "Veuillez vérifier les informations saisies."
  }
  if (code === "over_email_send_rate_limit" || status === 429) {
    return "Trop de tentatives. Patientez un instant avant de réessayer."
  }
  return "Inscription impossible pour le moment. Veuillez réessayer."
}

export function SignUpForm() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [repeatPassword, setRepeatPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get("next") ?? "/mes-cahiers"

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = createClient()
    setIsLoading(true)
    setError(null)

    if (password !== repeatPassword) {
      setError("Les mots de passe ne correspondent pas.")
      setIsLoading(false)
      return
    }

    try {
      const origin = window.location.origin
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo:
            process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ??
            `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      })
      if (error) throw error
      router.push("/auth/sign-up-success")
    } catch (error: unknown) {
      console.error("Sign-up error:", error)
      setError(signUpErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-8">
        <div className="flex justify-center">
          <BrandLogo />
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-2xl">Créer un compte</CardTitle>
            <CardDescription>Rejoignez l&apos;atelier pour composer vos cahiers.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSignUp}>
              <div className="flex flex-col gap-6">
                <div className="grid gap-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="vous@exemple.com"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="password">Mot de passe</Label>
                  <Input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="repeat-password">Confirmer le mot de passe</Label>
                  <Input
                    id="repeat-password"
                    type="password"
                    required
                    value={repeatPassword}
                    onChange={(e) => setRepeatPassword(e.target.value)}
                  />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Création du compte..." : "Créer mon compte"}
                </Button>
              </div>
              <div className="mt-4 text-center text-sm text-muted-foreground">
                Vous avez déjà un compte ?{" "}
                <Link
                  href={`/auth/login${next !== "/mes-cahiers" ? `?next=${encodeURIComponent(next)}` : ""}`}
                  className="text-foreground underline underline-offset-4"
                >
                  Se connecter
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
