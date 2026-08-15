'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import { ar } from '@/lib/i18n/ar'
import { en } from '@/lib/i18n/en'

export type Language = 'ar' | 'en'

const dictionaries = { ar, en } as const

type Dictionary = typeof ar

const STORAGE_KEY = 'app_lang'

interface I18nContextValue {
  lang: Language
  dir: 'rtl' | 'ltr'
  t: (key: keyof Dictionary, vars?: Record<string, string | number>) => string
  toggleLang: () => void
}

const I18nContext = createContext<I18nContextValue | null>(null)

function getInitialLang(): Language {
  if (typeof window === 'undefined') return 'ar'
  const saved = window.localStorage.getItem(STORAGE_KEY)
  return saved === 'en' || saved === 'ar' ? saved : 'ar'
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Language>(getInitialLang)

  useEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
    window.localStorage.setItem(STORAGE_KEY, lang)
    const dict = dictionaries[lang]
    document.title = dict.metaTitle
    const desc = document.querySelector('meta[name="description"]')
    if (desc) desc.setAttribute('content', dict.metaDescription)
  }, [lang])

  const toggleLang = useCallback(() => {
    setLang((prev) => (prev === 'ar' ? 'en' : 'ar'))
  }, [])

  const t = useCallback(
    (key: keyof Dictionary, vars?: Record<string, string | number>) => {
      let text: string = dictionaries[lang][key] ?? dictionaries.ar[key] ?? String(key)
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          text = text.replaceAll(`{${k}}`, String(v))
        }
      }
      return text
    },
    [lang],
  )

  const value = useMemo<I18nContextValue>(
    () => ({ lang, dir: lang === 'ar' ? 'rtl' : 'ltr', t, toggleLang }),
    [lang, t, toggleLang],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}
