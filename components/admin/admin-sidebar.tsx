'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowUpRight, Menu, X } from 'lucide-react'
import { useState } from 'react'
import { BrandLogo } from '@/components/brand-logo'
import { SignOutButton } from '@/components/admin/sign-out-button'
import { adminNav } from '@/lib/navigation'
import { cn } from '@/lib/utils'

function isActive(pathname: string, href: string) {
  if (href === '/admin') return pathname === '/admin'
  return pathname === href || pathname.startsWith(`${href}/`)
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()

  return (
    <nav className="flex flex-1 flex-col gap-1" aria-label="Navigation administration">
      {adminNav.map((item) => {
        const active = isActive(pathname, item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
              active
                ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
                : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
            )}
          >
            <item.icon className="size-4 shrink-0" />
            <span className="truncate">{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}

function SidebarFooter({ userEmail }: { userEmail?: string | null }) {
  return (
    <div className="flex flex-col gap-3">
      <Link
        href="/"
        className="flex items-center justify-between gap-2 rounded-xl border border-sidebar-border px-3 py-2.5 text-sm font-medium text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      >
        Voir le site public
        <ArrowUpRight className="size-4" />
      </Link>
      {userEmail && (
        <div className="flex items-center justify-between gap-2 rounded-xl bg-sidebar-accent/40 px-3 py-2">
          <div className="min-w-0">
            <p className="text-xs text-sidebar-foreground/60">Connecté·e</p>
            <p className="truncate text-sm font-medium text-sidebar-foreground">{userEmail}</p>
          </div>
          <SignOutButton />
        </div>
      )}
    </div>
  )
}

export function AdminSidebar({ userEmail }: { userEmail?: string | null }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Mobile top bar */}
      <div className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-sidebar-border bg-sidebar px-4 lg:hidden">
        <BrandLogo href="/admin" />
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex size-10 items-center justify-center rounded-full text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
          aria-label="Ouvrir le menu d'administration"
        >
          <Menu className="size-5" />
        </button>
      </div>

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col gap-6 border-r border-sidebar-border bg-sidebar px-4 py-6 lg:flex">
        <BrandLogo href="/admin" />
        <NavLinks />
        <SidebarFooter userEmail={userEmail} />
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col gap-6 border-r border-sidebar-border bg-sidebar px-4 py-6">
            <div className="flex items-center justify-between">
              <BrandLogo href="/admin" />
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex size-10 items-center justify-center rounded-full text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
                aria-label="Fermer le menu d'administration"
              >
                <X className="size-5" />
              </button>
            </div>
            <NavLinks onNavigate={() => setOpen(false)} />
            <SidebarFooter userEmail={userEmail} />
          </div>
        </div>
      )}
    </>
  )
}
