'use client'

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/lib/i18n";
import { Button, Field, Input } from "@/components/ui";

const MAX_ATTEMPTS = 5
const LOCKOUT_SECONDS = 60

export default function LoginPage() {
  const { login, user, loading } = useAuth()
  const { t } = useI18n()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [attempts, setAttempts] = useState(0)
  const [lockout, setLockout] = useState(0)
  const lockoutRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (lockout > 0) {
      lockoutRef.current = setInterval(() => {
        setLockout((prev) => {
          if (prev <= 1) {
            if (lockoutRef.current) clearInterval(lockoutRef.current)
            setAttempts(0)
            return 0
          }
          return prev - 1
        })
      }, 1000)
      return () => {
        if (lockoutRef.current) clearInterval(lockoutRef.current)
      }
    }
  }, [lockout > 0])

  useEffect(() => {
    if (!loading && user) router.replace('/dashboard')
  }, [loading, user, router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (lockout > 0) {
      setError(`Locked out. Try again in ${lockout}s.`)
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      await login(email, password)
    } catch (err) {
      const newAttempts = attempts + 1
      setAttempts(newAttempts)
      if (newAttempts >= MAX_ATTEMPTS) {
        setLockout(LOCKOUT_SECONDS)
        setError('Too many failed attempts. Locked for 60 seconds.')
      } else {
        setError(err instanceof Error ? err.message : t('loginError'))
      }
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-[75vh] max-w-md flex-col justify-center px-4 py-12">
      <div className="card relative overflow-hidden p-8">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
        <div className="mb-6 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-2xl shadow-lg shadow-emerald-500/30">
            👋
          </span>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-gray-900 dark:text-slate-100">{t('loginTitle')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">{t('loginSubtitle')}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label={t('loginEmail')}>
            <Input
              id="email"
              type="email"
              required
              dir="ltr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              maxLength={254}
              disabled={lockout > 0}
            />
          </Field>
          <Field label={t('loginPassword')}>
            <Input
              id="password"
              type="password"
              required
              dir="ltr"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              maxLength={128}
              disabled={lockout > 0}
            />
          </Field>

          {lockout > 0 && (
            <p className="rounded-xl bg-amber-50 px-3.5 py-2.5 text-sm text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
              Too many attempts. Try again in {lockout}s.
            </p>
          )}

          {error && (
            <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">{error}</p>
          )}

          <Button type="submit" disabled={submitting || lockout > 0} className="w-full py-3">
            {submitting ? t('loginSubmitting') : t('loginSubmit')}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500 dark:text-slate-400">
          {t('noAccount')}{' '}
          <Link href="/register" className="link">
            {t('createAccount')}
          </Link>
        </p>
      </div>
    </div>
  )
}
