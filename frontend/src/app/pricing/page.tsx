'use client'

import Link from "next/link";
import { useState } from "react";

import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/lib/i18n";
import { api } from "@/lib/api";
import { Button, Card, Spinner } from "@/components/ui";

interface Plan {
  id: string
  name: string
  price_cents: number
  features: string[]
}

export default function PricingPage() {
  const { user } = useAuth()
  const { t } = useI18n()
  const [plans] = useState<Plan[]>(() => [
    {
      id: "free",
      name: t('planFreeName'),
      price_cents: 0,
      features: [t('featFree1'), t('featFree2'), t('featFree3')],
    },
    {
      id: "pro",
      name: t('planProName'),
      price_cents: 600,
      features: [t('featPro1'), t('featPro2'), t('featPro3'), t('featPro4')],
    },
  ])
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleUpgrade(planId: string) {
    if (!user) return
    setLoading(planId)
    setError(null)
    try {
      const res = await api.post<{ url: string }>('/subscription/checkout')
      window.location.assign(res.url)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('checkoutError'))
      setLoading(null)
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900">{t('pricingTitle')}</h1>
        <p className="mt-2 text-gray-600">{t('pricingSubtitle')}</p>
      </div>

      {error && (
        <p className="mx-auto mt-6 max-w-lg rounded-lg bg-amber-50 px-4 py-3 text-center text-sm text-amber-800">
          {error}
        </p>
      )}

      <div className="mt-10 grid gap-6 md:grid-cols-2">
        {plans.map((plan) => {
          const isCurrent = user?.plan === plan.id
          const popular = plan.id === 'pro'
          return (
            <Card
              key={plan.id}
              className={`p-8 ${
                popular ? 'border-emerald-500 ring-2 ring-emerald-500/30' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">{plan.name}</h2>
                {popular && (
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                    {t('popular')}
                  </span>
                )}
              </div>
              <div className="mt-4 flex items-end gap-1">
                <span className="text-4xl font-bold text-gray-900">
                  {plan.price_cents === 0 ? '0' : `$${(plan.price_cents / 100).toFixed(2)}`}
                </span>
                <span className="mb-1 text-sm text-gray-500">{t('pricingMonthly')}</span>
              </div>
              <ul className="mt-6 space-y-3">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-gray-700">
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-600">
                      ✓
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
              <div className="mt-8">
                {isCurrent ? (
                  <Button
                    disabled
                    className="w-full cursor-default bg-gray-100 text-gray-500"
                  >
                    {t('currentPlan')}
                  </Button>
                ) : plan.id === 'free' ? (
                  <Link
                    href="/register"
                    className="block w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-center text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
                  >
                    {user ? t('freeNow') : t('startFree')}
                  </Link>
                ) : (
                  <Button
                    onClick={() => handleUpgrade(plan.id)}
                    disabled={loading !== null || !user}
                    className="w-full bg-emerald-600 text-white hover:bg-emerald-700"
                  >
                    {loading === plan.id ? (
                      <>
                        <Spinner /> {t('redirecting')}
                      </>
                    ) : user ? (
                      t('upgradePro')
                    ) : (
                      t('signupToUpgrade')
                    )}
                  </Button>
                )}
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
