'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState } from 'react'
import { usePathname } from 'next/navigation'

import { useAuth } from '@/hooks/useAuth'
import { useI18n } from '@/lib/i18n'

export function Navbar() {
  const { user, logout, loading } = useAuth()
  const { t, toggleLang, lang } = useI18n()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  const navItems = [
    { href: '/', label: t('navHome') },
    ...(user ? [{ href: '/dashboard', label: t('navDashboard') }] : []),
    ...(user ? [{ href: '/saved', label: t('navSaved') }] : []),
    { href: '/pricing', label: t('navPricing') },
  ]

  const linkClass = (path: string) =>
    `rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
      pathname === path
        ? 'bg-emerald-600/10 text-emerald-700'
        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
    }`

  const planBadge =
    user?.plan === 'pro' ? (
      <span className="badge bg-gradient-to-r from-amber-100 to-orange-100 text-amber-700">★ Pro</span>
    ) : user?.plan === 'weekly' ? (
      <span className="badge bg-teal-50 text-teal-700">{t('planWeekly')}</span>
    ) : user ? (
      <span className="badge bg-gray-100 text-gray-600">{t('planFree')}</span>
    ) : null

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200/70 bg-white/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2.5">
          <Image
            src="/logo.svg"
            alt={t('appName')}
            width={36}
            height={36}
            priority
            className="rounded-xl shadow-md shadow-emerald-500/30 transition-transform duration-300 ease-out hover:rotate-3 hover:scale-110"
          />
          <span className="text-lg font-bold tracking-tight text-gray-900">{t('appName')}</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className={linkClass(item.href)}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleLang}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            title={lang === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'}
          >
            {lang === 'ar' ? 'EN' : 'ع'}
          </button>

          {loading ? null : user ? (
            <>
              <span className="hidden sm:inline">{planBadge}</span>
              <Link
                href="/dashboard"
                className="hidden rounded-xl bg-gray-900 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700 md:inline-flex"
              >
                {user.full_name ?? user.email.split('@')[0]}
              </Link>
              <button
                onClick={logout}
                className="hidden rounded-xl px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 md:inline-flex"
              >
                {t('logout')}
              </button>
            </>
          ) : (
            <div className="hidden items-center gap-2 md:flex">
              <Link
                href="/login"
                className="rounded-xl px-3.5 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
              >
                {t('login')}
              </Link>
              <Link href="/register" className="btn-primary px-3.5 py-2">
                {t('startFree')}
              </Link>
            </div>
          )}

          <button
            onClick={() => setOpen(!open)}
            className="grid h-9 w-9 place-items-center rounded-xl border border-gray-200 bg-white text-gray-700 md:hidden"
            aria-label="Menu"
          >
            {open ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-gray-100 bg-white px-4 py-3 md:hidden">
          <nav className="flex flex-col gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={linkClass(item.href)}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="mt-3 flex items-center gap-2 border-t border-gray-100 pt-3">
            {user ? (
              <>
                <span className="text-sm text-gray-500">{planBadge}</span>
                <button
                  onClick={logout}
                  className="ms-auto rounded-xl px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
                >
                  {t('logout')}
                </button>
              </>
            ) : (
              <div className="flex w-full gap-2">
                <Link href="/login" onClick={() => setOpen(false)} className="btn-secondary flex-1">
                  {t('login')}
                </Link>
                <Link href="/register" onClick={() => setOpen(false)} className="btn-primary flex-1">
                  {t('startFree')}
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  )
}
