'use client'

import Link from "next/link";
import { useState } from "react";

import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/lib/i18n";
import { Button, Input } from "@/components/ui";

export default function RegisterPage() {
  const { register } = useAuth()
  const { t } = useI18n()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 8) {
      setError(t('registerShortPassword'))
      return
    }
    setSubmitting(true)
    try {
      await register(email, password, fullName || undefined)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('registerError'))
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-12">
      <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900">{t('registerTitle')} 🥗</h1>
        <p className="mt-1 text-sm text-gray-500">
          {t('registerSubtitle')}
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700" htmlFor="name">
              {t('registerName')}
            </label>
            <Input
              id="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Ahmed Mohammed"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700" htmlFor="email">
              {t('registerEmail')}
            </label>
            <Input
              id="email"
              type="email"
              required
              dir="ltr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700" htmlFor="password">
              {t('registerPassword')}
            </label>
            <Input
              id="password"
              type="password"
              required
              dir="ltr"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('registerPasswordHint')}
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}

          <Button
            type="submit"
            disabled={submitting}
            className="w-full bg-emerald-600 text-white hover:bg-emerald-700"
          >
            {submitting ? t('registerSubmitting') : t('registerSubmit')}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          {t('haveAccount')}{' '}
          <Link href="/login" className="font-semibold text-emerald-600 hover:text-emerald-700">
            {t('goLogin')}
          </Link>
        </p>
      </div>
    </div>
  )
}
