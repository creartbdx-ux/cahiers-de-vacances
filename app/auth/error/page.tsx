import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BrandLogo } from "@/components/brand-logo"

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = await searchParams
  // `error` comes from the URL, so it is attacker-controlled. Render it only
  // when it looks like a Supabase error code, never as free text.
  const code = params?.error
  const isErrorCode = typeof code === "string" && /^[a-z0-9_]{1,64}$/.test(code)

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-8">
        <div className="flex justify-center">
          <BrandLogo />
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-2xl">Une erreur est survenue</CardTitle>
          </CardHeader>
          <CardContent>
            {isErrorCode ? (
              <p className="text-sm text-muted-foreground">Code d&apos;erreur : {code}</p>
            ) : (
              <p className="text-sm text-muted-foreground">Une erreur non spécifiée s&apos;est produite.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
