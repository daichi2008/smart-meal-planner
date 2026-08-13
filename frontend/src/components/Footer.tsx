'use client'

import Link from 'next/link'

import { useAuth } from '@/hooks/useAuth'
import { useI18n } from '@/lib/i18n'

export function Footer() {
  const { t } = useI18n()
  const { user } = useAuth()

  return (
    <footer className="border-t border-gray-200/70 bg-white py-10">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 md:grid-cols-3">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-base">
              🥗
            </span>
            <span className="text-base font-bold text-gray-900">{t('appName')}</span>
          </div>
          <p className="mt-3 max-w-xs text-sm text-gray-500">{t('tagline')}</p>
        </div>

        <div className="md:text-center">
          <h3 className="text-sm font-semibold text-gray-900">{t('navPricing')}</h3>
          <ul className="mt-3 space-y-2 text-sm text-gray-500">
            <li>
              <Link href="/pricing" className="transition-colors hover:text-emerald-600">
                {t('pricingTitle')}
              </Link>
            </li>
            {user && (
              <li>
                <Link href="/saved" className="transition-colors hover:text-emerald-600">
                  {t('navSaved')}
                </Link>
              </li>
            )}
          </ul>
        </div>

        <div className="md:text-end">
          <h3 className="text-sm font-semibold text-gray-900">{t('appName')}</h3>
          <p className="mt-3 text-sm text-gray-500">{t('footer')}</p>
        </div>
      </div>

      <div className="mx-auto mt-8 max-w-6xl border-t border-gray-100 px-4 pt-6 text-center text-xs text-gray-400">
        © {new Date().getFullYear()} {t('appName')}
      </div>
    </footer>
  )
}
