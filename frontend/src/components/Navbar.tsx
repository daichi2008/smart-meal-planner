'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { useAuth } from '@/hooks/useAuth'
import { useI18n } from '@/lib/i18n'

export function Navbar() {
  const { user, logout, loading } = useAuth()
  const { t, toggleLang, lang } = useI18n()
  const pathname = usePathname()

  const linkClass = (path: string) =>
    `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
      pathname === path
        ? 'bg-emerald-50 text-emerald-700'
        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
    }`

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-lg">
            🥗
          </span>
          <span className="text-lg font-bold text-gray-900">{t('appName')}</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          <Link href="/" className={linkClass('/')}>
            {t('navHome')}
          </Link>
          {user && (
            <Link href="/dashboard" className={linkClass('/dashboard')}>
              {t('navDashboard')}
            </Link>
          )}
          {user && (
            <Link href="/saved" className={linkClass('/saved')}>
              {t('navSaved')}
            </Link>
          )}
          <Link href="/pricing" className={linkClass('/pricing')}>
            {t('navPricing')}
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <button
            onClick={toggleLang}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
            title={lang === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'}
          >
            {lang === 'ar' ? 'EN' : 'ع'}
          </button>

          {loading ? null : user ? (
            <>
              <span className="hidden rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 sm:inline">
                {user.plan === 'pro' ? 'Pro' : t('planFree')}
              </span>
              <Link
                href="/dashboard"
                className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700"
              >
                {user.full_name ?? user.email}
              </Link>
              <button
                onClick={logout}
                className="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100"
              >
                {t('logout')}
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-lg px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
              >
                {t('login')}
              </Link>
              <Link
                href="/register"
                className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-700"
              >
                {t('startFree')}
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
