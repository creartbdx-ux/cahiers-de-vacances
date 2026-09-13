import type { ReactNode } from 'react'
import { SiteFooter } from '@/components/public/site-footer'
import { SiteHeader } from '@/components/public/site-header'
import { getCurrentUser } from '@/lib/auth'

export default async function PublicLayout({ children }: { children: ReactNode }) {
  const { user, profile } = await getCurrentUser()

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader isAuthenticated={Boolean(user)} isAdmin={profile?.role === 'admin'} />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  )
}
