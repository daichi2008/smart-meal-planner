'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import { useAuth } from '@/hooks/useAuth'
import { useI18n } from '@/lib/i18n'
import { api } from '@/lib/api'
import type { FridgeItem, User } from '@/lib/types'
import { FridgeManager } from '@/components/FridgeManager'
import { MealTracker } from '@/components/MealTracker'
import { RecipeSuggestions } from '@/components/RecipeSuggestions'
import { Button, Card, Field, Input } from '@/components/ui'

export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <DashboardInner />
    </Suspense>
  )
}

function DashboardInner() {
  const { user, loading, refreshUser } = useAuth()
  const { t } = useI18n()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [items, setItems] = useState<FridgeItem[]>([])
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [upgradeNotice, setUpgradeNotice] = useState(false)

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [loading, user, router])

  useEffect(() => {
    if (searchParams.get('upgraded') !== '1') return
    let active = true
    refreshUser().finally(() => {
      if (active) setUpgradeNotice(true)
    })
    return () => {
      active = false
    }
  }, [searchParams, refreshUser])

  if (loading || !user) {
    return <div className="py-24 text-center text-gray-400 dark:text-slate-500">{t('dashLoading')}</div>
  }

  const planPill =
    user.plan === 'pro' ? (
      <span className="badge bg-gradient-to-r from-amber-100 to-orange-100 text-amber-700 dark:from-amber-500/20 dark:to-orange-500/20 dark:text-amber-300">★ Pro</span>
    ) : user.plan === 'weekly' ? (
      <span className="badge bg-teal-50 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300">{t('planWeekly')}</span>
    ) : (
      <span className="badge bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-400">{t('planFree')}</span>
    )

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-slate-100">
              {t('dashGreeting')} {user.full_name ?? user.email.split('@')[0]}
            </h1>
            {planPill}
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">{t('dashSubtitle')}</p>
        </div>
        <Button variant="secondary" onClick={() => setSettingsOpen(!settingsOpen)}>
          ⚙️ {t('dashSettings')}
        </Button>
      </div>

      {upgradeNotice && (
        <div className="mb-6 flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 px-4 py-3 dark:border-emerald-500/30 dark:from-emerald-500/10 dark:to-teal-500/10">
          <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">🎉 {t('upgradeNotice')}</p>
          <button
            onClick={() => setUpgradeNotice(false)}
            className="text-sm text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300"
          >
            {t('close')}
          </button>
        </div>
      )}

      {settingsOpen && <SettingsForm user={user} onSaved={refreshUser} />}

      <div className="space-y-6">
        <MealTracker />
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <FridgeManager onItemsChange={setItems} />
          </div>
          <div className="lg:col-span-3">
            <RecipeSuggestions items={items} defaultCalorieTarget={user.calorie_target} />
          </div>
        </div>
      </div>
    </div>
  )
}

function SettingsForm({ user, onSaved }: { user: User; onSaved: () => Promise<void> }) {
  const { t } = useI18n()
  const [calories, setCalories] = useState(user.calorie_target ? String(user.calorie_target) : '')
  const [preferences, setPreferences] = useState(user.dietary_preferences ?? '')
  const [saving, setSaving] = useState(false)

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await api.patch<User>('/users/me', {
        calorie_target: calories ? parseFloat(calories) : null,
        dietary_preferences: preferences.trim() || null,
      })
      await onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="mb-6 p-6">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-100 text-lg dark:bg-emerald-500/15">🎯</span>
        <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100">{t('settingsTitle')}</h2>
      </div>
      <form onSubmit={saveSettings} className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label={t('settingsCalories')}>
          <Input
            id="cal"
            type="number"
            min="500"
            max="8000"
            dir="ltr"
            value={calories}
            onChange={(e) => setCalories(e.target.value)}
            placeholder="2000"
          />
        </Field>
        <Field label={t('settingsPrefs')}>
          <Input
            id="pref"
            value={preferences}
            onChange={(e) => setPreferences(e.target.value)}
            placeholder={t('settingsPrefsPlaceholder')}
          />
        </Field>
        <div className="sm:col-span-2">
          <Button type="submit" disabled={saving}>
            {saving ? t('settingsSaving') : t('settingsSave')}
          </Button>
        </div>
      </form>
    </Card>
  )
}
