'use client'

import Link from "next/link";
import { useEffect, useState } from "react";

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

interface PaymentProvider {
  id: string
  name: string
  badge?: string
}

export default function PricingPage() {
  const { user } = useAuth()
  const { t } = useI18n()
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedProvider, setSelectedProvider] = useState<string>("volet")
  const [plansLoading, setPlansLoading] = useState(true)

  const paymentProviders: PaymentProvider[] = [
    { id: "volet", name: "Volet", badge: "المفضل" },
    { id: "advcash", name: "AdvCash" },
  ]

  // Fetch plans from API
  useEffect(() => {
    async function fetchPlans() {
      try {
        const response = await api.get<Plan[]>('/subscription/plans')
        setPlans(response)
      } catch (err) {
        console.error('Failed to fetch plans:', err)
        setError(t('failedToLoadPlans'))
      } finally {
        setPlansLoading(false)
      }
    }

    fetchPlans()
  }, [t])

  async function handleUpgrade(planId: string) {
    if (!user) return
    if (planId === 'free') return
    
    setLoading(planId)
    setError(null)
    try {
      const res = await api.post<{ action_url: string; fields: Record<string, string> }>(
        `/subscription/checkout?plan_id=${planId}&provider=${selectedProvider}`
      )
      submitPaymentForm(res.action_url, res.fields)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('checkoutError'))
      setLoading(null)
    }
  }

  function submitPaymentForm(actionUrl: string, fields: Record<string, string>) {
    const form = document.createElement('form')
    form.method = 'POST'
    form.action = actionUrl
    form.style.display = 'none'
    for (const [name, value] of Object.entries(fields)) {
      const input = document.createElement('input')
      input.type = 'hidden'
      input.name = name
      input.value = value
      form.appendChild(input)
    }
    document.body.appendChild(form)
    form.submit()
  }

  if (plansLoading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-16 text-center">
        <Spinner />
        <p className="mt-4 text-gray-600 dark:text-slate-400">{t('loadingPlans')}</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-slate-100">{t('pricingTitle')}</h1>
        <p className="mt-2 text-gray-600 dark:text-slate-400">{t('pricingSubtitle')}</p>
      </div>

      {error && (
        <p className="mx-auto mt-6 max-w-lg rounded-lg bg-amber-50 px-4 py-3 text-center text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
          {error}
        </p>
      )}

      {/* Payment Provider Selection */}
      <div className="mt-8 flex justify-center gap-4">
        {paymentProviders.map((provider) => (
          <button
            key={provider.id}
            onClick={() => setSelectedProvider(provider.id)}
            className={`relative rounded-lg px-6 py-3 font-semibold transition-all ${
              selectedProvider === provider.id
                ? 'bg-emerald-600 text-white ring-2 ring-emerald-400'
                : 'border border-gray-300 bg-white text-gray-700 hover:border-emerald-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-emerald-500/50'
            }`}
          >
            {provider.name}
            {provider.badge && (
              <span className="absolute -right-3 -top-3 rounded-full bg-amber-400 px-2 py-1 text-xs font-bold text-amber-900">
                {provider.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="mt-10 grid gap-6 md:grid-cols-3">
        {plans.map((plan) => {
          const isCurrent = user?.plan === plan.id
          const isPopular = plan.id === 'pro'
          const isWeekly = plan.id === 'weekly'
          
          return (
            <Card
              key={plan.id}
              className={`relative flex flex-col p-8 ${
                isPopular ? 'border-emerald-500 ring-2 ring-emerald-500/30' : ''
              }`}
            >
              {isPopular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                  {t('popular')}
                </span>
              )}
              
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100">{plan.name}</h2>
              </div>

              <div className="mt-4 flex items-end gap-1">
                <span className="text-4xl font-bold text-gray-900 dark:text-slate-100">
                  {plan.price_cents === 0 ? '0' : `$${(plan.price_cents / 100).toFixed(2)}`}
                </span>
                <span className="mb-1 text-sm text-gray-500 dark:text-slate-400">
                  {isWeekly ? t('weekly') : t('monthly')}
                </span>
              </div>

              <ul className="mt-6 flex-1 space-y-3">
                {plan.features.map((f, idx) => (
                  <li key={idx} className="flex items-center gap-2 text-sm text-gray-700 dark:text-slate-300">
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
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
                    className="w-full cursor-default bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-slate-400"
                  >
                    {t('currentPlan')}
                  </Button>
                ) : plan.id === 'free' ? (
                  <Link
                    href={user ? "/dashboard" : "/register"}
                    className="block w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-center text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    {user ? t('freeNow') : t('startFree')}
                  </Link>
                ) : (
                  <Button
                    onClick={() => handleUpgrade(plan.id)}
                    disabled={loading !== null || !user}
                    className={`w-full text-white ${
                      isPopular
                        ? 'bg-emerald-600 hover:bg-emerald-700'
                        : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    {loading === plan.id ? (
                      <>
                        <Spinner /> {t('redirecting')}
                      </>
                    ) : user ? (
                      isWeekly ? t('subscribeWeekly') : t('upgradePro')
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

      <div className="mt-12 rounded-lg bg-blue-50 p-6 text-center dark:bg-blue-500/10">
        <p className="text-sm text-gray-700 dark:text-slate-300">
          💡 <strong>نصيحة:</strong> {t('paymentSecurityNotice')}
        </p>
      </div>
    </div>
  )
}
