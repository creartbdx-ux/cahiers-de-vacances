import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { BrandLogo } from "@/components/brand-logo"

export default function Page() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-8">
        <div className="flex justify-center">
          <BrandLogo />
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-2xl">Merci pour votre inscription</CardTitle>
            <CardDescription>Confirmez votre adresse e-mail</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Votre compte a bien été créé. Consultez votre boîte de réception et cliquez sur le lien de confirmation
              avant de vous connecter.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
