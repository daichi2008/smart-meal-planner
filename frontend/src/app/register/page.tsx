'use client'

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/lib/i18n";
import { Button, Field, Input } from "@/components/ui";

export default function RegisterPage() {
  const { register, user, loading } = useAuth()
  const { t } = useI18n()
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!loading && user) router.replace('/dashboard')
  }, [loading, user, router])

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
    <div className="mx-auto flex min-h-[75vh] max-w-md flex-col justify-center px-4 py-12">
      <div className="card relative overflow-hidden p-8">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
        <div className="mb-6 text-center">
          <Image
            src="/logo.svg"
            alt={t('appName')}
            width={56}
            height={56}
            priority
            className="mx-auto rounded-2xl shadow-lg shadow-emerald-500/30"
          />
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-gray-900 dark:text-slate-100">{t('registerTitle')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">{t('registerSubtitle')}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label={t('registerName')}>
            <Input
              id="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Ahmed Mohammed"
              maxLength={100}
            />
          </Field>
          <Field label={t('registerEmail')}>
            <Input
              id="email"
              type="email"
              required
              dir="ltr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              maxLength={254}
            />
          </Field>
          <Field label={t('registerPassword')} hint={t('registerPasswordHint')}>
            <Input
              id="password"
              type="password"
              required
              dir="ltr"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              maxLength={128}
            />
          </Field>

          {error && (
            <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">{error}</p>
          )}

          <Button type="submit" disabled={submitting} className="w-full py-3">
            {submitting ? t('registerSubmitting') : t('registerSubmit')}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500 dark:text-slate-400">
          {t('haveAccount')}{' '}
          <Link href="/login" className="link">
            {t('goLogin')}
          </Link>
        </p>
      </div>
    </div>
  )
}
