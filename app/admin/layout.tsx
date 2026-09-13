import type { Metadata } from "next"
import type { ReactNode } from "react"
import { ShieldAlert } from "lucide-react"
import { AdminSidebar } from "@/components/admin/admin-sidebar"
import { SignOutButton } from "@/components/admin/sign-out-button"
import { getCurrentUser } from "@/lib/auth"

export const metadata: Metadata = {
  title: {
    default: "Administration",
    template: "%s — Administration Carnet",
  },
}

export default async function AdminLayout({ children }: { children: ReactNode }) {
  // The proxy already guarantees a session on /admin; here we enforce the role.
  const { user, profile } = await getCurrentUser()

  if (profile?.role !== "admin") {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-muted/30 p-6">
        <div className="flex max-w-md flex-col items-center gap-4 rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          <span className="flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <ShieldAlert className="size-6" />
          </span>
          <h1 className="font-serif text-xl text-foreground">Accès réservé</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Le compte <span className="font-medium text-foreground">{user?.email}</span> n&apos;a pas les droits
            d&apos;administration. Contactez un administrateur pour obtenir l&apos;accès.
          </p>
          <SignOutButton />
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-muted/30 lg:flex-row">
      <AdminSidebar userEmail={user?.email} />
      <div className="flex-1">
        <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-10 lg:py-12">{children}</main>
      </div>
    </div>
  )
}
